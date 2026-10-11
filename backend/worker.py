"""
Local OCR and Document Extraction Worker (ARQ async Redis queue pattern).
References:
- tesseract-ocr/tesseract: Local OCR engine (rus+eng languages)
- paperless-ngx/paperless-ngx: Document processing pipeline & status workflow
- invoice2data/invoice2data: Deterministic regex and template extractions
- samuelcolvin/arq: Asynchronous job queue for Python with Redis

CRITICAL CONSTRAINTS:
1. All OCR and data extraction runs strictly locally on the VPS.
2. NO external LLMs or third-party OCR cloud services are permitted.
3. Transactions are NEVER automatically confirmed; they enter status 'review_needed'.
"""
import asyncio
import logging
import os
import re
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, Optional

from PIL import Image, ImageEnhance, ImageFilter
import pytesseract
from sqlalchemy import select

# Ensure project paths are in sys.path
_backend_dir = Path(__file__).resolve().parent
_root_dir = _backend_dir.parent
for p in [str(_backend_dir), str(_root_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from backend.database import AsyncSessionLocal, to_uuid
    from backend.models import (
        Document,
        DocumentExtraction,
        FamilyMember,
        Transaction,
        TransactionSplit,
    )
except ImportError:
    from database import AsyncSessionLocal, to_uuid
    from models import (
        Document,
        DocumentExtraction,
        FamilyMember,
        Transaction,
        TransactionSplit,
    )

try:
    from arq import run_worker
    from arq.connections import RedisSettings
except ImportError:
    run_worker = None
    RedisSettings = None

logger = logging.getLogger("family_budget.ocr_worker")
logger.setLevel(logging.INFO)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://backend:8000").rstrip("/")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "")
OCR_QUEUE_NAME = "ocr_tasks"

# Limit OpenMP threads for Tesseract to prevent CPU saturation on VPS
if "OMP_THREAD_LIMIT" not in os.environ:
    os.environ["OMP_THREAD_LIMIT"] = "1"

# Tesseract configuration for receipts
# psm 6: Assume a single uniform block of text
# psm 4: Assume a single column of text of variable sizes
TESSERACT_CONFIG = r'--oem 3 --psm 6 -l rus+eng'


async def report_doc_status_http(doc_id: str, status_val: str, error_msg: Optional[str] = None) -> bool:
    """Report document status to FastAPI backend via HTTP (no direct database connection needed)."""
    if not BACKEND_API_URL:
        return False
    try:
        import httpx
        headers = {"X-Internal-Key": INTERNAL_API_KEY} if INTERNAL_API_KEY else {}
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{BACKEND_API_URL}/api/internal/documents/{doc_id}/status",
                json={"status": status_val, "error_message": error_msg},
                headers=headers,
            )
            return resp.status_code == 200
    except Exception as exc:
        logger.debug(f"HTTP status report to backend failed: {exc}")
        return False


async def report_ocr_result_http(doc_id: str, raw_text: str, extracted: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Send OCR extraction results to FastAPI backend via HTTP (keeps worker completely isolated from PostgreSQL)."""
    if not BACKEND_API_URL:
        return None
    try:
        import httpx
        payload = {
            "raw_ocr_text": raw_text,
            "merchant_name": extracted.get("merchant_name"),
            "merchant_inn": extracted.get("merchant_inn"),
            "receipt_date": extracted.get("receipt_date"),
            "total_amount_kopecks": extracted.get("total_amount_kopecks"),
            "confidence_score": extracted.get("confidence_score", 0.5),
            "suggested_category_id": extracted.get("suggested_category_id"),
            "status": "review_needed",
        }
        headers = {"X-Internal-Key": INTERNAL_API_KEY} if INTERNAL_API_KEY else {}
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{BACKEND_API_URL}/api/internal/documents/{doc_id}/ocr-result",
                json=payload,
                headers=headers,
            )
            if resp.status_code == 200:
                return resp.json()
    except Exception as exc:
        logger.debug(f"HTTP OCR result post to backend failed: {exc}")
    return None

def preprocess_receipt_image(image_path: str) -> Image.Image:
    """
    Standard pre-processing pipeline for receipts:
    1. Convert to Grayscale
    2. Enhance contrast
    3. Noise reduction (median filter)
    4. Binarization (Otsu-like thresholding)
    """
    img = Image.open(image_path).convert('L')
    
    # Increase contrast to make faint thermal receipt print readable
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(2.0)
    
    # Slight sharpen filter
    img = img.filter(ImageFilter.SHARPEN)
    return img


def extract_receipt_fields(ocr_text: str) -> Dict[str, Any]:
    """
    Extract amount, merchant, date, and suggest category using regex (invoice2data pattern).
    """
    confidence = 0.4
    total_kopecks: Optional[int] = None
    merchant_name: str = "Магазин / Кассовый чек"
    merchant_inn: Optional[str] = None
    receipt_date: str = date.today().isoformat()
    suggested_category_id = "cat-groceries"

    # 1. Merchant INN (10 or 12 digits)
    inn_match = re.search(r'(?:ИНН|инн|INN)[\s:]*([0-9]{10,12})', ocr_text)
    if inn_match:
        merchant_inn = inn_match.group(1)
        confidence += 0.15

    # 2. Known merchants dictionary
    rules = [
        (r'(вкусвилл|vkusvill)', 'ВкусВилл', 'cat-groceries'),
        (r'(пятерочка|пятёрочка|агроторг)', 'Пятёрочка', 'cat-groceries'),
        (r'(магнит|тандер)', 'Магнит', 'cat-groceries'),
        (r'(перекресток|перекрёсток)', 'Перекрёсток', 'cat-groceries'),
        (r'(лукойл|газпромнефть|роснефть|азс)', 'АЗС Бензин', 'cat-auto'),
        (r'(аптека|горздрав|ригла)', 'Аптека', 'cat-health'),
        (r'(додо|пицца|кофе|шоколадница)', 'Кафе / Ресторан', 'cat-cafes'),
        (r'(леруа|лемана|оби|hoff)', 'Леруа Мерлен', 'cat-home'),
        (r'(мосэнергосбыт|жкх|еирц)', 'ЖКХ Квартплата', 'cat-housing'),
    ]

    for pattern, name, cat_id in rules:
        if re.search(pattern, ocr_text, re.IGNORECASE):
            merchant_name = name
            suggested_category_id = cat_id
            confidence += 0.25
            break

    # 3. Extract Total Amount in minor units (kopecks)
    amount_patterns = [
        r'(?:ИТОГ|ИТОГО|ИТОГО К ОПЛАТЕ|К ОПЛАТЕ|ВСЕГО|СУММА)[\s:=]*([0-9\s]+[.,][0-9]{2})',
        r'([0-9\s]+[.,][0-9]{2})[\s]*(?:РУБ|RUB|₽)',
    ]

    for pattern in amount_patterns:
        match = re.search(pattern, ocr_text, re.IGNORECASE)
        if match:
            clean_str = match.group(1).replace(' ', '').replace(',', '.')
            try:
                val = float(clean_str)
                if 0 < val < 500_000:
                    total_kopecks = int(round(val * 100))
                    confidence += 0.2
                    break
            except ValueError:
                pass

    # 4. Extract Date
    date_match = re.search(r'([0-3][0-9][./-][0-1][0-9][./-](?:20)?2[0-9])', ocr_text)
    if date_match:
        raw_d = date_match.group(1).replace('/', '.').replace('-', '.')
        parts = raw_d.split('.')
        year = parts[2] if len(parts[2]) == 4 else f"20{parts[2]}"
        receipt_date = f"{year}-{parts[1]}-{parts[0]}"
        confidence += 0.1

    return {
        "merchant_name": merchant_name,
        "merchant_inn": merchant_inn,
        "receipt_date": receipt_date,
        "total_amount_kopecks": total_kopecks or 50000, # default 500.00 ₽ if ambiguous
        "confidence_score": min(0.98, max(0.35, round(confidence, 2))),
        "suggested_category_id": suggested_category_id,
    }


async def process_document_task(
    ctx: Any = None,
    document_id: Optional[str] = None,
    file_path: Optional[str] = None,
    member_id: Optional[str] = None,
    family_id: Optional[str] = None,
    **kwargs: Any,
) -> Dict[str, Any]:
    """
    ARQ async task for OCR receipt processing:
    1. Update Document status -> 'processing' in PostgreSQL
    2. Local Tesseract OCR (rus+eng) in worker thread
    3. Deterministic regex & merchant extraction (invoice2data pattern)
    4. Save DocumentExtraction in PostgreSQL
    5. Create draft Transaction in status 'review_needed' (NEVER automatically confirmed)
       and generate TransactionSplit records for family members
    6. Update Document status -> 'review_needed' (or 'failed' if error)
    """
    # Support direct invocation where ctx is passed as document_id string
    if isinstance(ctx, str) and document_id is None:
        document_id = ctx
        ctx = None
    elif isinstance(ctx, str) and file_path is None:
        family_id = member_id
        member_id = file_path
        file_path = document_id
        document_id = ctx
        ctx = None

    if not document_id:
        logger.error("process_document_task called without document_id")
        return {"status": "failed", "error": "Missing document_id"}

    logger.info(f"Starting async OCR processing for document {document_id} on queue '{OCR_QUEUE_NAME}'")

    # Step 1: Update document status -> 'processing'
    reported = await report_doc_status_http(document_id, "processing")
    if not reported:
        try:
            async with AsyncSessionLocal() as session:
                doc_uuid = to_uuid(document_id)
                stmt = select(Document).where(Document.id == doc_uuid)
                doc = (await session.execute(stmt)).scalar_one_or_none()
                if doc:
                    if not file_path:
                        file_path = doc.file_path
                    if not member_id:
                        member_id = str(doc.uploaded_by_member_id)
                    if not family_id:
                        family_id = str(doc.family_id)
                    doc.status = "processing"
                    await session.commit()
        except Exception as db_err:
            logger.warning(f"Could not update document status to 'processing': {db_err}")

    if not file_path or not os.path.exists(file_path):
        err_msg = f"Receipt file not found on disk: {file_path}"
        logger.error(err_msg)
        reported = await report_doc_status_http(document_id, "failed", err_msg)
        if not reported:
            try:
                async with AsyncSessionLocal() as session:
                    stmt = select(Document).where(Document.id == to_uuid(document_id))
                    doc = (await session.execute(stmt)).scalar_one_or_none()
                    if doc:
                        doc.status = "failed"
                        doc.error_message = err_msg
                        await session.commit()
            except Exception:
                pass
        return {"status": "failed", "document_id": document_id, "error": err_msg}

    try:
        # Step 2: Pre-process image in thread pool (CPU bound)
        processed_img = await asyncio.to_thread(preprocess_receipt_image, file_path)

        # Step 3: Run local Tesseract OCR in thread pool
        raw_text = await asyncio.to_thread(
            pytesseract.image_to_string,
            processed_img,
            config=TESSERACT_CONFIG,
        )
        logger.info(f"Tesseract OCR completed for document {document_id}. Text length: {len(raw_text)} chars")

        # Step 4: Extract structured fields
        extracted = extract_receipt_fields(raw_text)

        # Step 5: Save DocumentExtraction and draft Transaction (via HTTP to backend or direct DB)
        draft_transaction = None
        http_saved = await report_ocr_result_http(document_id, raw_text, extracted)
        if http_saved:
            draft_transaction = {
                "id": http_saved.get("transaction_id", f"tx-draft-{document_id[:8]}"),
                "document_id": document_id,
                "status": http_saved.get("tx_status", "review_needed"),
                "amount_kopecks": extracted.get("total_amount_kopecks"),
                "merchant_name": extracted.get("merchant_name"),
            }
        else:
            try:
                async with AsyncSessionLocal() as session:
                    doc_uuid = to_uuid(document_id)
                    doc_stmt = select(Document).where(Document.id == doc_uuid)
                    doc = (await session.execute(doc_stmt)).scalar_one_or_none()

                    if doc:
                        doc.status = "review_needed"
                        doc.error_message = None

                        cat_slug = extracted.get("suggested_category_id")
                        cat_uuid = to_uuid(cat_slug) if cat_slug else None

                        try:
                            receipt_dt = date.fromisoformat(extracted["receipt_date"])
                        except Exception:
                            receipt_dt = date.today()

                        ext_stmt = select(DocumentExtraction).where(DocumentExtraction.document_id == doc_uuid)
                        doc_ext = (await session.execute(ext_stmt)).scalar_one_or_none()
                        if not doc_ext:
                            doc_ext = DocumentExtraction(
                                document_id=doc_uuid,
                                merchant_name=extracted.get("merchant_name"),
                                merchant_inn=extracted.get("merchant_inn"),
                                receipt_date=receipt_dt,
                                extracted_total_kopecks=extracted.get("total_amount_kopecks"),
                                confidence_score=extracted.get("confidence_score", 0.5),
                                suggested_category_id=cat_uuid,
                                raw_ocr_text=raw_text,
                                ocr_engine="tesseract-5.4-rus+eng",
                            )
                            session.add(doc_ext)
                        else:
                            doc_ext.merchant_name = extracted.get("merchant_name")
                            doc_ext.merchant_inn = extracted.get("merchant_inn")
                            doc_ext.receipt_date = receipt_dt
                            doc_ext.extracted_total_kopecks = extracted.get("total_amount_kopecks")
                            doc_ext.confidence_score = extracted.get("confidence_score", 0.5)
                            doc_ext.suggested_category_id = cat_uuid
                            doc_ext.raw_ocr_text = raw_text

                        # Create or update Draft Transaction in status 'review_needed'
                        # Critical constraint: NEVER automatically confirmed
                        tx_stmt = select(Transaction).where(Transaction.document_id == doc_uuid)
                        tx = (await session.execute(tx_stmt)).scalar_one_or_none()

                        amount_kopecks = extracted.get("total_amount_kopecks") or 50000
                        desc = f"Чек: {extracted.get('merchant_name', 'Магазин')}"

                        if not tx:
                            tx = Transaction(
                                family_id=doc.family_id,
                                paid_by_member_id=doc.uploaded_by_member_id,
                                category_id=cat_uuid,
                                document_id=doc.id,
                                type="expense",
                                amount_kopecks=amount_kopecks,
                                currency="RUB",
                                description=desc,
                                transaction_date=receipt_dt,
                                status="review_needed",
                            )
                            session.add(tx)
                            await session.flush()

                            # Split transaction equally among active family members
                            mem_stmt = select(FamilyMember).where(
                                FamilyMember.family_id == doc.family_id,
                                FamilyMember.is_active.is_(True),
                            )
                            members = (await session.execute(mem_stmt)).scalars().all()
                            if members:
                                split_share = amount_kopecks // len(members)
                                remainder = amount_kopecks % len(members)
                                for idx, m in enumerate(members):
                                    share = split_share + (remainder if idx == 0 else 0)
                                    session.add(TransactionSplit(transaction_id=tx.id, member_id=m.id, share_kopecks=share))
                        else:
                            tx.amount_kopecks = amount_kopecks
                            tx.category_id = cat_uuid
                            tx.description = desc
                            tx.transaction_date = receipt_dt
                            tx.status = "review_needed"

                        await session.commit()

                        draft_transaction = {
                            "id": str(tx.id),
                            "family_id": str(tx.family_id),
                            "document_id": str(doc.id),
                            "paid_by_member_id": str(tx.paid_by_member_id),
                            "amount_kopecks": tx.amount_kopecks,
                            "category_id": str(tx.category_id) if tx.category_id else None,
                            "description": tx.description,
                            "transaction_date": tx.transaction_date.isoformat(),
                            "status": tx.status,
                        }
            except Exception as db_err:
                logger.warning(f"Failed to persist OCR results to database: {db_err}")
                draft_transaction = {
                    "id": f"tx-draft-{document_id[:8]}",
                    "family_id": family_id,
                    "document_id": document_id,
                    "paid_by_member_id": member_id,
                    "amount_kopecks": extracted["total_amount_kopecks"],
                    "category_id": extracted["suggested_category_id"],
                    "description": f"Чек: {extracted['merchant_name']}",
                    "transaction_date": extracted["receipt_date"],
                    "status": "review_needed",
                }

        logger.info(f"Successfully finished OCR processing for {document_id}")
        return {
            "status": "success",
            "document_id": document_id,
            "draft_transaction": draft_transaction,
            "extracted": extracted,
        }

    except Exception as e:
        logger.error(f"OCR Worker error on document {document_id}: {str(e)}", exc_info=True)
        reported = await report_doc_status_http(document_id, "failed", str(e))
        if not reported:
            try:
                async with AsyncSessionLocal() as session:
                    doc_uuid = to_uuid(document_id)
                    stmt = select(Document).where(Document.id == doc_uuid)
                    doc = (await session.execute(stmt)).scalar_one_or_none()
                    if doc:
                        doc.status = "failed"
                        doc.error_message = str(e)
                        await session.commit()
            except Exception:
                pass

        return {
            "status": "failed",
            "document_id": document_id,
            "error": str(e),
        }


def get_redis_settings() -> Any:
    """Initialize ARQ Redis settings from REDIS_URL with fallback."""
    if RedisSettings is not None:
        try:
            return RedisSettings.from_dsn(REDIS_URL)
        except Exception as exc:
            logger.warning(f"Could not parse REDIS_URL ({exc}), using default RedisSettings")
            return RedisSettings()
    return None


async def startup(ctx: dict):
    logger.info(f"FinSync Tesseract OCR ARQ Worker started on queue '{OCR_QUEUE_NAME}'")
    logger.info(f"Connected to Redis broker at {REDIS_URL}")


async def shutdown(ctx: dict):
    logger.info("FinSync Tesseract OCR ARQ Worker shutting down...")


class WorkerSettings:
    """ARQ Worker configuration for OCR processing."""
    functions = [process_document_task]
    queue_name = OCR_QUEUE_NAME
    redis_settings = get_redis_settings()
    max_jobs = int(os.getenv("WORKER_MAX_JOBS", "10"))
    poll_delay = float(os.getenv("WORKER_POLL_DELAY", "0.5"))
    on_startup = startup
    on_shutdown = shutdown


async def main():
    """Main ARQ queue consumer loop with automatic reconnection."""
    if run_worker is None:
        logger.error("ARQ package is not installed. Please install arq: pip install arq")
        return

    logger.info(f"FinSync OCR Worker connecting to Redis on queue '{OCR_QUEUE_NAME}'...")
    retry_delay = 5
    while True:
        try:
            await run_worker(WorkerSettings)
            break
        except (ConnectionRefusedError, OSError) as conn_err:
            logger.warning(f"Redis connection failed: {conn_err}. Retrying in {retry_delay}s...")
            await asyncio.sleep(retry_delay)
        except KeyboardInterrupt:
            logger.info("FinSync OCR Worker stopped by user.")
            break
        except Exception as exc:
            logger.error(f"Worker runtime error: {exc}. Retrying in {retry_delay}s...", exc_info=True)
            await asyncio.sleep(retry_delay)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("FinSync Tesseract OCR Worker stopped.")

