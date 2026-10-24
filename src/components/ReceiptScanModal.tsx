import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  Camera, 
  ShieldCheck, 
  Check, 
  Cpu, 
  FileText, 
  AlertCircle,
  Sparkles,
  ListOrdered,
  Layers,
  BrainCircuit,
  Loader2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Category, FamilyMember, Transaction, DocumentLineItem, DocumentExtraction } from '../types';
import { extractDataFromReceiptText } from '../utils/ocrExtractor';
import { formatMoney } from '../utils/money';
import { CategoryIconSelector } from './CategoryIcon';
import { StorageService } from '../utils/storage';
import { authFetch } from '../utils/auth';
import { useFamily } from '../context/FamilyContext';
import { useModalA11y } from '../hooks/useModalA11y';

interface ReceiptScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  members: FamilyMember[];
  familyId?: string;
  onAddTransaction: (transaction: Transaction) => void;
}

interface SplitLineItem extends DocumentLineItem {
  categoryId: string;
}

interface ServerExtractionData {
  merchant_name?: string;
  merchant_inn?: string;
  receipt_date?: string;
  extracted_total_kopecks?: number;
  confidence_score?: number;
  suggested_category_id?: string;
  raw_ocr_text?: string;
}

export const ReceiptScanModal: React.FC<ReceiptScanModalProps> = ({
  isOpen,
  onClose,
  categories,
  members,
  familyId,
  onAddTransaction,
}) => {
  const { state } = useFamily();
  const effectiveFamilyId = familyId || state.family.id;
  const [pipelineStep, setPipelineStep] = useState<'idle' | 'parsing' | 'review'>('idle');
  const [pastedText, setPastedText] = useState<string>('');
  const [fileNotice, setFileNotice] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrDocId, setOcrDocId] = useState<string | null>(null);
  const [ocrPollingActive, setOcrPollingActive] = useState<boolean>(false);
  const [extractedData, setExtractedData] = useState<DocumentExtraction | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('cat-groceries');
  const [paidByMemberId, setPaidByMemberId] = useState<string>(members[0]?.id || 'mem-01');
  const [splitItemsMode, setSplitItemsMode] = useState<'single' | 'items'>('single');
  const [splitLineItems, setSplitLineItems] = useState<SplitLineItem[]>([]);
  const [rememberMerchantRule, setRememberMerchantRule] = useState<boolean>(true);
  const [isAutoMatched, setIsAutoMatched] = useState<boolean>(false);

  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setOcrPollingActive(false);
  };

  const handleClose = () => {
    stopPolling();
    onClose();
  };

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopPolling();
    }
  }, [isOpen]);

  const { modalRef } = useModalA11y({
    isOpen,
    onClose: handleClose,
  });

  if (!isOpen) return null;

  const finalizeExtraction = (rawOcrText: string, serverExtraction?: ServerExtractionData) => {
    const result = extractDataFromReceiptText(rawOcrText || '', `doc-${Date.now()}`);

    // Merge server extraction if provided by backend OCR worker
    if (serverExtraction) {
      if (serverExtraction.merchant_name) {
        result.merchantName = serverExtraction.merchant_name;
      }
      if (serverExtraction.merchant_inn) {
        result.merchantInn = serverExtraction.merchant_inn;
      }
      if (serverExtraction.extracted_total_kopecks && serverExtraction.extracted_total_kopecks > 0) {
        result.totalAmountKopecks = serverExtraction.extracted_total_kopecks;
      }
      if (serverExtraction.receipt_date) {
        result.receiptDate = serverExtraction.receipt_date;
      }
      if (serverExtraction.suggested_category_id) {
        result.suggestedCategoryId = serverExtraction.suggested_category_id;
      }
      if (serverExtraction.confidence_score) {
        result.confidenceScore = Math.max(result.confidenceScore || 0, serverExtraction.confidence_score);
      }
    }

    // Check learned merchant memory
    let finalCategory = serverExtraction?.suggested_category_id || result.suggestedCategoryId || 'cat-groceries';
    const learnedCat = StorageService.matchMerchantCategory(result.merchantName || rawOcrText);
    if (learnedCat) {
      finalCategory = learnedCat;
      setIsAutoMatched(true);
    } else {
      setIsAutoMatched(false);
    }

    setExtractedData(result);
    setSelectedCategoryId(finalCategory);

    // Populate split line items with default category
    if (result.lineItems && result.lineItems.length > 0) {
      setSplitLineItems(
        result.lineItems.map((item) => ({
          ...item,
          categoryId: finalCategory,
        }))
      );
    } else {
      setSplitLineItems([]);
    }

    setPipelineStep('review');
  };

  const pollDocumentStatus = (docId: string) => {
    stopPolling();
    setOcrPollingActive(true);
    setOcrDocId(docId);
    setOcrError(null);
    setFileNotice(null);
    setPipelineStep('parsing');

    let attempts = 0;
    const maxAttempts = 15; // 15 attempts * 2s = 30 seconds

    const checkStatus = async () => {
      attempts += 1;
      try {
        const resp = await authFetch(`/api/documents/${docId}/status`);
        if (resp.ok) {
          const data = await resp.json();
          const status = data.status;

          if (status === 'review_needed') {
            stopPolling();
            const extraction = data.extraction || {};
            const rawOcr = extraction.raw_ocr_text || '';
            setPastedText(rawOcr);
            finalizeExtraction(rawOcr, extraction);
            return;
          }

          if (status === 'failed') {
            stopPolling();
            setPipelineStep('idle');
            setOcrError(data.error_message || 'Ошибка распознавания чека в локальном OCR воркере');
            return;
          }
        }
      } catch (err) {
        console.warn('OCR status polling error:', err);
      }

      if (attempts >= maxAttempts) {
        stopPolling();
        setPipelineStep('idle');
        setFileNotice('OCR ещё выполняется на сервере. Проверьте результат позже в списке черновиков или введите данные чека вручную.');
      }
    };

    const intervalId = setInterval(checkStatus, 2000);
    pollingIntervalRef.current = intervalId;
  };

  const handleRunParser = (textToProcess: string) => {
    if (!textToProcess.trim()) return;
    setPipelineStep('parsing');
    setFileNotice(null);
    setOcrError(null);

    setTimeout(() => {
      finalizeExtraction(textToProcess);
    }, 350);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrError(null);
    setFileNotice(null);

    if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = () => {
        const text = (reader.result as string) || '';
        setPastedText(text);
        handleRunParser(text);
      };
      reader.readAsText(file);
      return;
    }

    // Image or PDF file: send to backend and poll OCR extraction
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('member_id', paidByMemberId || 'mem-01');

      setPipelineStep('parsing');
      setOcrPollingActive(true);
      setFileNotice(`Файл «${file.name}» загружен на сервер. Запущен локальный Tesseract OCR (rus+eng)...`);

      const resp = await authFetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (resp.ok) {
        const data = await resp.json();
        const docId = data.document_id;
        if (docId) {
          pollDocumentStatus(docId);
          return;
        }
      }

      // Backend did not return document_id
      setOcrPollingActive(false);
      setPipelineStep('idle');
      setFileNotice(`Файл «${file.name}» загружен. Введите текст чека вручную или выберите демонстрационный образец.`);
    } catch (err) {
      console.warn('Backend upload error:', err);
      setOcrPollingActive(false);
      setPipelineStep('idle');
      setFileNotice(`Ошибка отправки файла на сервер. Вы можете вставить текст чека вручную.`);
    }
  };

  const handleConfirmDraft = () => {
    if (!extractedData) return;

    // Auto-learn merchant rule if enabled
    if (rememberMerchantRule && extractedData.merchantName) {
      StorageService.learnMerchantRule(extractedData.merchantName, selectedCategoryId);
    }

    if (splitItemsMode === 'items' && splitLineItems.length > 0) {
      // Create transactions split by individual item categories
      splitLineItems.forEach((item, idx) => {
        const itemTx: Transaction = {
          id: `tx-${Date.now()}-${idx}`,
          familyId: effectiveFamilyId,
          type: 'expense',
          amountKopecks: item.totalKopecks,
          currency: 'RUB',
          categoryId: item.categoryId,
          paidByMemberId: paidByMemberId,
          description: `${extractedData.merchantName || 'Чек'}: ${item.name}`,
          date: extractedData.receiptDate || new Date().toISOString().split('T')[0],
          status: 'confirmed',
          tags: ['чек', 'детализация'],
          createdAt: new Date().toISOString(),
        };
        onAddTransaction(itemTx);
      });
    } else {
      // Single composite transaction
      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        familyId: effectiveFamilyId,
        type: 'expense',
        amountKopecks: extractedData.totalAmountKopecks || 100000,
        currency: 'RUB',
        categoryId: selectedCategoryId,
        paidByMemberId: paidByMemberId,
        description: `Чек: ${extractedData.merchantName || 'Магазин'}`,
        date: extractedData.receiptDate || new Date().toISOString().split('T')[0],
        status: 'confirmed',
        tags: ['чек', 'ocr'],
        createdAt: new Date().toISOString(),
      };
      onAddTransaction(newTx);
    }

    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    handleClose();
  };

  const handleUpdateItemCategory = (itemId: string, newCatId: string) => {
    setSplitLineItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, categoryId: newCatId } : it))
    );
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-scan-title"
        tabIndex={-1}
        className="dark:bg-[#020617] bg-white w-full sm:max-w-2xl rounded-t-[28px] sm:rounded-3xl border-t sm:border dark:border-slate-800/80 border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] animate-in slide-in-from-bottom duration-200 dark:text-white text-slate-900 outline-none"
      >
        {/* iOS Pull indicator for iPhone bottom sheet */}
        <div className="w-12 h-1.5 dark:bg-slate-700/80 bg-slate-300 rounded-full mx-auto mt-2.5 mb-0.5 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="px-4 py-3 sm:p-5 border-b dark:border-slate-800/80 border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl dark:bg-amber-500/10 bg-amber-100 dark:text-amber-400 text-amber-600 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 id="receipt-scan-title" className="font-bold text-sm sm:text-base dark:text-white text-slate-900">
                Парсер текста чеков
              </h3>
              <p className="text-[10px] sm:text-xs dark:text-slate-400 text-slate-500">
                Детерминированный regex-парсер • Извлечение сумм, мерчанта, ИНН и позиций
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Закрыть окно парсера чеков"
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center dark:text-slate-400 text-slate-500 dark:hover:text-white hover:text-slate-900 rounded-xl dark:hover:bg-slate-800/80 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-4 flex-1">
          {/* Privacy guarantee */}
          <div className="flex items-start space-x-2.5 p-3 dark:bg-emerald-950/40 bg-emerald-50 border dark:border-emerald-800/80 border-emerald-200 rounded-xl text-xs dark:text-emerald-300 text-emerald-800">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            <span>
              <strong>Детерминированный парсер:</strong> В браузере работает быстрый regex-алгоритм без внешних облачных API или LLM. Вставьте текст чека (из SMS, ОФД или почты), загрузите файл или выберите готовый образец.
            </span>
          </div>

          {fileNotice && (
            <div className="flex items-start space-x-2 p-3 dark:bg-amber-950/40 bg-amber-50 border dark:border-amber-800/80 border-amber-200 rounded-xl text-xs dark:text-amber-300 text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>{fileNotice}</span>
            </div>
          )}

          {ocrError && (
            <div className="flex items-start space-x-2 p-3 dark:bg-rose-950/40 bg-rose-50 border dark:border-rose-800/80 border-rose-200 rounded-xl text-xs dark:text-rose-300 text-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <div className="flex-1">
                <p className="font-semibold">Ошибка OCR распознавания:</p>
                <p className="mt-0.5">{ocrError}</p>
              </div>
            </div>
          )}

          {pipelineStep === 'idle' ? (
            <div className="space-y-4">
              {/* Direct Text Area Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold dark:text-slate-300 text-slate-700 flex items-center justify-between">
                  <span>Вставьте скопированный текст чека или SMS:</span>
                  <span className="text-[10px] font-normal dark:text-slate-400 text-slate-500">
                    ОФД, банк, SMS или почта
                  </span>
                </label>
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder={`Пример:\nООО "ВКУСВИЛЛ"\nИНН 7734675810\nДата: 2026-09-09\n1. Молоко цельное = 89.00\n2. Хлеб бородинский = 65.00\nИТОГО: 154.00 РУБ`}
                  rows={4}
                  className="w-full p-3 font-mono text-xs dark:bg-slate-900/80 bg-slate-50 border dark:border-slate-800 border-slate-200 rounded-xl dark:text-slate-200 text-slate-800 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  disabled={!pastedText.trim()}
                  onClick={() => handleRunParser(pastedText)}
                  className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-md shadow-amber-600/20 flex items-center justify-center gap-2 transition-all active:scale-98"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Разобрать текст чека</span>
                </button>
              </div>

              {/* Upload file or camera action */}
              <div className="pt-1">
                <p className="text-[10px] font-bold uppercase tracking-wider dark:text-slate-400 text-slate-500 mb-2">
                  Или загрузите файл чека:
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="p-3 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900/60 bg-slate-50 dark:hover:bg-slate-800/80 hover:bg-slate-100 active:scale-98 transition-all flex items-center justify-center gap-2 text-center cursor-pointer shadow-xs">
                    <UploadCloud className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-semibold dark:text-white text-slate-900">Текстовый файл (.txt)</span>
                    <input
                      type="file"
                      accept=".txt,.json,.csv,text/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  <label className="p-3 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900/60 bg-slate-50 dark:hover:bg-slate-800/80 hover:bg-slate-100 active:scale-98 transition-all flex items-center justify-center gap-2 text-center cursor-pointer shadow-xs">
                    <Camera className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-semibold dark:text-white text-slate-900">Фотография чека</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          ) : pipelineStep !== 'review' ? (
            /* Clean Parsing Indicator */
            <div className="py-8 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl dark:bg-amber-500/10 bg-amber-100 dark:text-amber-400 text-amber-600 flex items-center justify-center animate-pulse">
                {ocrPollingActive ? (
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                ) : (
                  <Cpu className="w-8 h-8" />
                )}
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-sm dark:text-white text-slate-900">
                  {ocrPollingActive
                    ? 'Локальный Tesseract OCR распознает чек...'
                    : 'Разбор текста регулярными выражениями...'}
                </h4>
                <p className="text-xs dark:text-slate-400 text-slate-500 max-w-sm mx-auto">
                  {ocrPollingActive
                    ? `Серверный воркер выполняет OCR (rus+eng) и извлекает данные${ocrDocId ? ` (ID: ${ocrDocId.slice(0, 8)}...)` : ''}`
                    : 'Локальное извлечение мерчанта, ИНН, даты, товарных позиций и итоговой суммы'}
                </p>
              </div>

              <div className="w-48 h-1.5 dark:bg-slate-800 bg-slate-200 rounded-full mx-auto overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full w-3/4 animate-pulse" />
              </div>

              {ocrPollingActive && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      stopPolling();
                      setPipelineStep('idle');
                      setFileNotice('Ожидание OCR отменено. Вы можете ввести чек вручную.');
                    }}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline transition-colors"
                  >
                    Отменить ожидание и ввести вручную
                  </button>
                </div>
              )}
            </div>
          ) : extractedData ? (
            /* Review & User Confirmation Step */
            <div className="space-y-4">
              {isAutoMatched && (
                <div className="flex items-center gap-2 p-2.5 dark:bg-blue-950/50 bg-blue-50 border dark:border-blue-800/80 border-blue-200 rounded-xl text-xs dark:text-blue-300 text-blue-800">
                  <BrainCircuit className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>Категория автоматически подобрана по вашим прошлым операциям для этого продавца!</span>
                </div>
              )}

              {/* Mode Switcher: Single or Split by items */}
              {splitLineItems.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5 p-1 dark:bg-slate-900 bg-slate-100 border dark:border-slate-800 border-slate-200 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setSplitItemsMode('single')}
                    className={`py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                      splitItemsMode === 'single'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Единый чек</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitItemsMode('items')}
                    className={`py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                      splitItemsMode === 'items'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'dark:text-slate-400 text-slate-600 dark:hover:text-white hover:text-slate-900'
                    }`}
                  >
                    <ListOrdered className="w-3.5 h-3.5" />
                    <span>Разбить по позициям ({splitLineItems.length})</span>
                  </button>
                </div>
              )}

              <div className="p-4 dark:bg-slate-900/80 bg-slate-50 border dark:border-slate-800 border-slate-200 rounded-2xl space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold dark:text-slate-400 text-slate-500 uppercase tracking-wider">
                    Результат извлечения (Черновик)
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full dark:bg-emerald-950 bg-emerald-100 dark:text-emerald-300 text-emerald-800 border dark:border-emerald-800 border-emerald-200">
                    Уверенность: {Math.round(extractedData.confidenceScore * 100)}%
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="dark:text-slate-400 text-slate-500 block mb-1">Продавец:</label>
                    <input
                      type="text"
                      value={extractedData.merchantName || ''}
                      onChange={(e) =>
                        setExtractedData(prev => prev ? { ...prev, merchantName: e.target.value } : null)
                      }
                      className="w-full p-2 dark:bg-slate-950 bg-white border dark:border-slate-800 border-slate-200 rounded-xl dark:text-white text-slate-900 font-medium"
                    />
                  </div>

                  <div>
                    <label className="dark:text-slate-400 text-slate-500 block mb-1">Общая сумма (₽):</label>
                    <div className="font-mono font-bold text-base p-1.5 dark:text-white text-slate-900">
                      {formatMoney(extractedData.totalAmountKopecks || 0)}
                    </div>
                  </div>

                  {splitItemsMode === 'single' ? (
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] uppercase tracking-wider font-bold dark:text-slate-400 text-slate-500 block">
                          Значок категории расхода:
                        </label>
                        <span className="text-[10px] dark:text-blue-400 text-blue-600 font-mono">
                          {categories.find((c) => c.id === selectedCategoryId)?.name}
                        </span>
                      </div>
                      <CategoryIconSelector
                        categories={categories}
                        selectedCategoryId={selectedCategoryId}
                        onSelect={(id) => setSelectedCategoryId(id)}
                      />
                    </div>
                  ) : (
                    /* Detailed Item Splitting Table */
                    <div className="sm:col-span-2 space-y-2 pt-1">
                      <label className="text-[10px] uppercase tracking-wider font-bold dark:text-slate-400 text-slate-500 block">
                        Позиции чека с индивидуальными категориями:
                      </label>
                      <div className="divide-y dark:divide-slate-800 divide-slate-200 border dark:border-slate-800 border-slate-200 rounded-xl overflow-hidden dark:bg-slate-950/60 bg-white">
                        {splitLineItems.map((item) => (
                          <div key={item.id} className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium dark:text-white text-slate-900 truncate">{item.name}</p>
                              <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">{formatMoney(item.totalKopecks)}</p>
                            </div>
                            <select
                              value={item.categoryId}
                              onChange={(e) => handleUpdateItemCategory(item.id, e.target.value)}
                              className="p-1.5 dark:bg-slate-900 bg-slate-50 border dark:border-slate-700 border-slate-200 rounded-lg text-xs dark:text-slate-200 text-slate-800 focus:outline-none focus:border-blue-500"
                            >
                              {categories.filter(c => c.id !== 'cat-transfer').map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className="dark:text-slate-400 text-slate-500 block mb-1 text-xs">Кто оплатил:</label>
                    <select
                      value={paidByMemberId}
                      onChange={(e) => setPaidByMemberId(e.target.value)}
                      className="w-full p-2.5 dark:bg-slate-950 bg-white border dark:border-slate-800 border-slate-200 rounded-xl text-base sm:text-sm dark:text-white text-slate-900"
                    >
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.avatar} {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Auto-learning toggle checkbox */}
                <div className="pt-2 border-t dark:border-slate-800/80 border-slate-200">
                  <label className="flex items-center space-x-2 text-xs dark:text-slate-300 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMerchantRule}
                      onChange={(e) => setRememberMerchantRule(e.target.checked)}
                      className="w-4 h-4 rounded dark:bg-slate-950 bg-white dark:border-slate-700 border-slate-300 text-blue-600 focus:ring-0"
                    />
                    <span>Запомнить продавца для авто-подстановки категории в будущем</span>
                  </label>
                </div>
              </div>

              {/* Raw text toggle */}
              <details className="text-xs dark:text-slate-400 text-slate-500 cursor-pointer">
                <summary className="font-medium dark:hover:text-white hover:text-slate-900">
                  Показать исходный текст чека
                </summary>
                <pre className="mt-2 p-3 dark:bg-slate-950 bg-slate-100 rounded-xl font-mono text-[11px] whitespace-pre-wrap overflow-x-auto border dark:border-slate-800 border-slate-200 dark:text-slate-300 text-slate-700">
                  {extractedData.rawText}
                </pre>
              </details>
            </div>
          ) : null}
        </div>

        {/* Modal Footer with iPhone Safe Area */}
        <div className="px-4 py-3 sm:p-4 border-t dark:border-slate-800/80 border-slate-200 flex items-center justify-between dark:bg-slate-950/80 bg-slate-50 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-4 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (pipelineStep === 'review') {
                setPipelineStep('idle');
                setExtractedData(null);
              } else {
                handleClose();
              }
            }}
            className="px-3.5 py-2 text-xs font-semibold dark:text-slate-400 text-slate-500 dark:hover:text-white hover:text-slate-900 transition-colors"
          >
            {pipelineStep === 'review' ? 'Сбросить' : 'Отмена'}
          </button>

          {pipelineStep === 'review' && (
            <button
              type="button"
              onClick={handleConfirmDraft}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center space-x-1.5 transition-all active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>{splitItemsMode === 'items' ? `Подтвердить (${splitLineItems.length} поз.)` : 'Подтвердить расход'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceiptScanModal;
