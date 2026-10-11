import React, { useState } from 'react';
import { X, Copy, Check, Database, Terminal, FileCode, Server, ShieldCheck, HardDrive, KeyRound, Rocket } from 'lucide-react';
import { useModalA11y } from '../hooks/useModalA11y';

interface ArchitectureViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureViewerModal: React.FC<ArchitectureViewerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'vps' | 'sql' | 'fastapi' | 'bot' | 'worker' | 'docker' | 'backup' | 'env'>('vps');
  const [copied, setCopied] = useState(false);

  const { modalRef } = useModalA11y({
    isOpen,
    onClose,
  });

  if (!isOpen) return null;

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="architecture-viewer-title"
        tabIndex={-1}
        className="bg-slate-900 text-slate-100 w-full max-w-4xl h-[92dvh] sm:h-[85vh] rounded-t-[28px] sm:rounded-3xl border-t sm:border border-slate-800 shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-200 outline-none"
      >
        {/* iOS Pull indicator */}
        <div className="w-12 h-1 bg-slate-700/80 rounded-full mx-auto mt-2.5 mb-0.5 sm:hidden shrink-0" />

        {/* Header */}
        <div className="px-4 py-3 sm:p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 id="architecture-viewer-title" className="font-bold text-sm sm:text-base text-white">
                Архитектура & Исходный код бэкенда
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-400">
                16 таблиц PostgreSQL, FastAPI, aiogram 3, Celery Tesseract Worker
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно архитектуры"
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center space-x-1 p-2 bg-slate-950 border-b border-slate-800 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('vps')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center space-x-1.5 ${
              activeTab === 'vps' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Rocket className="w-3.5 h-3.5" />
            <span>Развертывание на VPS & .env</span>
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center space-x-1.5 ${
              activeTab === 'sql' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>PostgreSQL (16 таблиц)</span>
          </button>
          <button
            onClick={() => setActiveTab('fastapi')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center space-x-1.5 ${
              activeTab === 'fastapi' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>FastAPI Backend</span>
          </button>
          <button
            onClick={() => setActiveTab('bot')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center space-x-1.5 ${
              activeTab === 'bot' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>aiogram 3 Bot</span>
          </button>
          <button
            onClick={() => setActiveTab('worker')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center space-x-1.5 ${
              activeTab === 'worker' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Tesseract OCR Worker</span>
          </button>
          <button
            onClick={() => setActiveTab('docker')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center space-x-1.5 ${
              activeTab === 'docker' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Docker Compose</span>
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center space-x-1.5 ${
              activeTab === 'backup' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Бэкап скрипт</span>
          </button>
          <button
            onClick={() => setActiveTab('env')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center space-x-1.5 ${
              activeTab === 'env' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>.env.example</span>
          </button>
        </div>

        {/* Code Content */}
        <div className="flex-1 p-4 overflow-y-auto bg-slate-950 font-mono text-xs">
          {activeTab === 'vps' && (
            <div className="space-y-4 font-sans text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-blue-400" />
                    Пошаговое развертывание на VPS (с аудитом не нового сервера)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Полный файл руководства: <code className="text-blue-300 font-mono">DEPLOY_VPS.md</code>
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(`./scripts/vps_check_and_setup.sh`)}
                  className="self-start sm:self-auto px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Скопировать команду скрипта</span>
                </button>
              </div>

              {/* Step 1 */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-xs">1</span>
                  <span>Аудит сервера перед установкой (VPS не новый)</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Проверьте свободную память, Swap и сетевые порты, чтобы не конфликтовать с существующими сайтами и не вызвать OOM при сборке Tesseract OCR и Vite:
                </p>
                <pre className="p-2.5 rounded-lg bg-slate-950 font-mono text-[11px] text-slate-300 overflow-x-auto">
{`# 1. Свободное место (нужно >= 5 GB):
df -h /

# 2. Память и Swap (если RAM <= 1.5GB и Swap=0, создайте 2GB swap во избежание OOM):
free -h
# Создать Swap (если нет):
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile

# 3. Проверка занятых портов (80, 443, 3000, 8000, 5432, 6379):
sudo ss -tulpn | grep -E ':(80|443|3000|8000|5432|6379)'`}
                </pre>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs">2</span>
                  <span>Клонирование с GitHub и автодиагностика</span>
                </div>
                <pre className="p-2.5 rounded-lg bg-slate-950 font-mono text-[11px] text-slate-300 overflow-x-auto">
{`sudo mkdir -p /opt/finsync && sudo chown $USER:$USER /opt/finsync && cd /opt/finsync
git clone <URL_ВАШЕГО_РЕПОЗИТОРИЯ> .

# Запуск встроенного скрипта проверки VPS и генерации .env:
chmod +x scripts/vps_check_and_setup.sh
./scripts/vps_check_and_setup.sh`}
                </pre>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-blue-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-xs">3</span>
                  <span>Секреты и настройка файла .env</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Генерация стойких паролей прямо в консоли и назначение безопасных прав:
                </p>
                <pre className="p-2.5 rounded-lg bg-slate-950 font-mono text-[11px] text-slate-300 overflow-x-auto">
{`cp .env.example .env

# Сгенерировать пароли для PostgreSQL, Redis и ключ JWT:
openssl rand -hex 16   # Для POSTGRES_PASSWORD
openssl rand -hex 16   # Для REDIS_PASSWORD
openssl rand -hex 32   # Для SECRET_KEY

# Установить права чтения только владельцу:
chmod 600 .env`}
                </pre>
                <p className="text-slate-400 text-[11px]">
                  Не забудьте вписать в <code className="text-amber-300 font-mono">.env</code>: <br />
                  • <b>TELEGRAM_BOT_TOKEN</b> (от @BotFather) <br />
                  • <b>TELEGRAM_ADMIN_CHAT_IDS</b> (ваш ID из @userinfobot) <br />
                  • <b>DOMAIN_NAME</b> и <b>APP_URL</b>
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-purple-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center text-xs">4</span>
                  <span>Запуск всех микросервисов в Docker</span>
                </div>
                <pre className="p-2.5 rounded-lg bg-slate-950 font-mono text-[11px] text-slate-300 overflow-x-auto">
{`# Сборка образов и фоновый запуск:
docker compose up -d --build

# Проверка статуса контейнеров:
docker compose ps

# Логи Telegram-бота в реальном времени:
docker compose logs -f telegram_bot`}
                </pre>
              </div>

              {/* Step 5 */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-cyan-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs">5</span>
                  <span>Внешний Nginx и бесплатный SSL (Let's Encrypt)</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Проксируйте запросы через Nginx хоста на порт 3000 (PWA) и 8000 (API):
                </p>
                <pre className="p-2.5 rounded-lg bg-slate-950 font-mono text-[11px] text-slate-300 overflow-x-auto">
{`# Выпуск бесплатного SSL-сертификата одной командой:
sudo certbot --nginx -d budget.yourdomain.ru`}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                <span>backend/schema.sql (16 таблиц, индексы, minor units)</span>
                <span className="text-[11px] text-emerald-400 font-sans">
                  Паттерны: Firefly-III, Beancount, Paperless-ngx, iHateMoney
                </span>
              </div>
              <pre className="text-slate-300 leading-relaxed overflow-x-auto whitespace-pre">
{`-- 1. users
-- 2. family
-- 3. family_members
-- 4. categories
-- 5. tags
-- 6. documents
-- 7. document_extractions
-- 8. document_line_items
-- 9. transactions (BIGINT amount_kopecks, CHECK status IN ('draft', 'review_needed', 'confirmed'))
-- 10. transaction_splits (iHateMoney pattern)
-- 11. transaction_tags
-- 12. budgets (ActualBudget plan/fact)
-- 13. document_comments
-- 14. recurring_rules
-- 15. scheduled_payments
-- 16. funds`}
              </pre>
            </div>
          )}

          {activeTab === 'fastapi' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                <span>backend/main.py (FastAPI endpoints)</span>
              </div>
              <pre className="text-slate-300 leading-relaxed overflow-x-auto whitespace-pre">
{`@app.post("/api/auth/telegram")
@app.get("/api/family/current")
@app.get("/api/family/members")
@app.post("/api/family/join")
@app.get("/api/categories")
@app.get("/api/budgets/{month}")
@app.get("/api/transactions")
@app.post("/api/transactions")
@app.post("/api/transactions/{draft_id}/confirm")  # Пользовательское подтверждение!
@app.post("/api/documents/upload")                # Сохранение на VPS для Tesseract OCR
@app.get("/api/dashboard/summary")
@app.get("/api/dashboard/forecast")               # Линейный расчет темпа трат`}
              </pre>
            </div>
          )}

          {activeTab === 'bot' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                <span>backend/bot.py (aiogram 3.x Telegram Bot)</span>
              </div>
              <pre className="text-slate-300 leading-relaxed overflow-x-auto whitespace-pre">
{`@dp.message(CommandStart())
async def cmd_start(...)

@dp.message(Command("dashboard"))
async def cmd_dashboard(...)

@dp.message(F.photo)
async def handle_receipt_photo(...)  # Передача чека в очередь Tesseract OCR

@dp.callback_query(F.data.startswith("tx_confirm:"))
async def callback_confirm(...)      # Подтверждение инлайн-кнопкой!

@dp.message(F.text)
async def handle_quick_expense(...)  # Быстрый ввод "540 кофе"`}
              </pre>
            </div>
          )}

          {activeTab === 'worker' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                <span>backend/worker.py (Tesseract rus+eng + invoice2data regex)</span>
              </div>
              <pre className="text-slate-300 leading-relaxed overflow-x-auto whitespace-pre">
{`TESSERACT_CONFIG = r'--oem 3 --psm 6 -l rus+eng'

def preprocess_receipt_image(image_path: str):
    # Grayscale, Contrast 2.0x, Sharpen filter

def extract_receipt_fields(ocr_text: str):
    # Regex extraction of INN, Merchant, Date, Total amount
    # Confidence scoring (0.0 - 1.0)
    # Draft created with status 'review_needed'`}
              </pre>
            </div>
          )}

          {activeTab === 'docker' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                <span>docker-compose.yml (VPS Self-Hosted Production)</span>
              </div>
              <pre className="text-slate-300 leading-relaxed overflow-x-auto whitespace-pre">
{`services:
  postgres:      # PostgreSQL 16
  redis:         # Redis 7 broker
  backend:       # FastAPI Core API
  ocr_worker:    # Celery + Tesseract OCR (rus+eng)
  telegram_bot:  # aiogram 3 bot
  dashboard:     # Next.js / PWA`}
              </pre>
            </div>
          )}

          {activeTab === 'backup' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                <span>scripts/backup.sh (pg_dump + media tar.gz + 14-day retention)</span>
              </div>
              <pre className="text-slate-300 leading-relaxed overflow-x-auto whitespace-pre">
{`# 1. pg_dump -U budget_admin -d family_budget | gzip -9 > backup.sql.gz
# 2. tar -czf receipts.tar.gz /app/storage/uploads
# 3. find backups older than 14 days and remove`}
              </pre>
            </div>
          )}

          {activeTab === 'env' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                <span>.env.example (Полная конфигурация VPS / Self-Hosted)</span>
                <button
                  onClick={() => handleCopy(`# ---------- Общие настройки ----------
APP_ENV=production
APP_DEBUG=false
APP_LOG_LEVEL=INFO
TZ=Europe/Moscow

# ---------- Домен ----------
DOMAIN_NAME=finance.yourdomain.ru
APP_URL=https://finance.yourdomain.ru

# ---------- PostgreSQL ----------
POSTGRES_DB=finsync
POSTGRES_USER=finsync_user
POSTGRES_PASSWORD=generate_super_strong_password_here
POSTGRES_PORT=5432
POSTGRES_HOST=postgres

# ---------- Redis ----------
REDIS_URL=redis://redis:6379/0
REDIS_HOST=redis
REDIS_PORT=6379

# ---------- Telegram ----------
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
TELEGRAM_ADMIN_CHAT_IDS=123456789,987654321
TELEGRAM_BOT_MODE=long_polling

# ---------- JWT / Auth ----------
SECRET_KEY=generate_random_64_character_hex_key_here
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30
JWT_ALGORITHM=HS256

# ---------- Storage ----------
STORAGE_PATH=/app/storage
MAX_UPLOAD_SIZE_MB=20
ALLOWED_EXTENSIONS=jpg,jpeg,png,webp,tiff,pdf

# ---------- OCR ----------
OCR_ENGINE=tesseract
TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata/
OCR_LANGUAGES=rus+eng
OCR_DPI=300
OCR_CONFIDENCE_THRESHOLD=60

# ---------- Currencies ----------
BASE_CURRENCY=RUB
SUPPORTED_CURRENCIES=RUB,USD,EUR
EXCHANGE_RATE_PROVIDER=cbr
EXCHANGE_RATE_CACHE_HOURS=6

# ---------- Frontend / PWA ----------
VITE_API_BASE_URL=https://finance.yourdomain.ru/api
VITE_WS_URL=wss://finance.yourdomain.ru/ws
VITE_APP_NAME=FinSync
VITE_THEME_COLOR=#0f172a

# ---------- CORS ----------
CORS_ORIGINS=https://finance.yourdomain.ru,http://localhost:3000
RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_BURST=10

# ---------- Backup ----------
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 3 * * *
BACKUP_RETENTION_DAYS=30
BACKUP_PATH=/app/backups`)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded flex items-center space-x-1 transition text-[11px]"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Скопировано' : 'Копировать .env'}</span>
                </button>
              </div>
              <pre className="text-slate-300 leading-relaxed overflow-x-auto whitespace-pre">
{`# ---------- Общие настройки ----------
APP_ENV=production
APP_DEBUG=false
APP_LOG_LEVEL=INFO
TZ=Europe/Moscow

# ---------- Домен ----------
DOMAIN_NAME=finance.yourdomain.ru
APP_URL=https://finance.yourdomain.ru

# ---------- PostgreSQL ----------
POSTGRES_DB=finsync
POSTGRES_USER=finsync_user
POSTGRES_PASSWORD=generate_super_strong_password_here
POSTGRES_PORT=5432
POSTGRES_HOST=postgres

# ---------- Redis ----------
REDIS_URL=redis://redis:6379/0
REDIS_HOST=redis
REDIS_PORT=6379

# ---------- Telegram ----------
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
TELEGRAM_ADMIN_CHAT_IDS=123456789,987654321
TELEGRAM_BOT_MODE=long_polling

# ---------- JWT / Auth ----------
SECRET_KEY=generate_random_64_character_hex_key_here
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30
JWT_ALGORITHM=HS256

# ---------- Storage ----------
STORAGE_PATH=/app/storage
MAX_UPLOAD_SIZE_MB=20
ALLOWED_EXTENSIONS=jpg,jpeg,png,webp,tiff,pdf

# ---------- OCR ----------
OCR_ENGINE=tesseract
TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata/
OCR_LANGUAGES=rus+eng
OCR_DPI=300
OCR_CONFIDENCE_THRESHOLD=60

# ---------- Currencies ----------
BASE_CURRENCY=RUB
SUPPORTED_CURRENCIES=RUB,USD,EUR
EXCHANGE_RATE_PROVIDER=cbr
EXCHANGE_RATE_CACHE_HOURS=6

# ---------- Frontend / PWA ----------
VITE_API_BASE_URL=https://finance.yourdomain.ru/api
VITE_WS_URL=wss://finance.yourdomain.ru/ws
VITE_APP_NAME=FinSync
VITE_THEME_COLOR=#0f172a

# ---------- CORS ----------
CORS_ORIGINS=https://finance.yourdomain.ru,http://localhost:3000
RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_BURST=10

# ---------- Backup ----------
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 3 * * *
BACKUP_RETENTION_DAYS=30
BACKUP_PATH=/app/backups`}
              </pre>
            </div>
          )}
        </div>

        {/* Footer with iPhone safe area */}
        <div className="px-4 py-3 sm:p-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between text-xs pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-3 shrink-0">
          <span className="text-slate-400 flex items-center text-[11px] sm:text-xs">
            <ShieldCheck className="w-4 h-4 mr-1 text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">Все файлы сохранены в проекте: </span>
            <code className="text-slate-200 ml-1">/backend/</code>, <code className="text-slate-200 ml-1">docker-compose.yml</code>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition-colors shrink-0 ml-2"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default ArchitectureViewerModal;
