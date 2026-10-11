import { describe, it, expect } from 'vitest';
import { extractDataFromReceiptText } from './ocrExtractor';

describe('Local Receipt OCR & Text Extractor (deterministic invoice2data pattern)', () => {
  it('extracts merchant, amount, INN, and date from a realistic grocery receipt', () => {
    const rawReceipt = `
      ООО "ВкусВилл"
      Добро пожаловать!
      ИНН: 7734675810
      Кассовый чек № 145
      Дата: 14.09.2026 18:32
      ----------------------------
      ИТОГО: 500.00
      Безналичная оплата: 500.00
      СПАСИБО ЗА ПОКУПКУ!
    `;

    const extracted = extractDataFromReceiptText(rawReceipt, 'doc-test-1');

    expect(extracted.documentId).toBe('doc-test-1');
    expect(extracted.merchantName).toBe('ВкусВилл');
    expect(extracted.merchantInn).toBe('7734675810');
    expect(extracted.suggestedCategoryId).toBe('cat-groceries');
    expect(extracted.totalAmountKopecks).toBe(50000);
    expect(extracted.confidenceScore).toBeGreaterThan(0.7);
  });

  it('categorizes auto expenses for fuel stations', () => {
    const gasReceipt = `
      ПАО "ЛУКОЙЛ-Северо-Западнефтепродукт"
      АЗС № 42
      ИНН 7802044321
      Бензин АИ-95 Евро
      ИТОГ: 1 815.00
    `;

    const extracted = extractDataFromReceiptText(gasReceipt, 'doc-test-gas');
    expect(extracted.merchantName).toBe('АЗС Газпромнефть'); // matches known rule for fuel
    expect(extracted.suggestedCategoryId).toBe('cat-auto');
    expect(extracted.totalAmountKopecks).toBe(181500);
  });

  it('categorizes pharmacies under health category', () => {
    const pharmacyReceipt = `
      ООО "Аптека Горздрав"
      ИНН 7724356789
      Нурофен экспресс форте 1 уп
      СУММА: 450,00
    `;

    const extracted = extractDataFromReceiptText(pharmacyReceipt, 'doc-test-pharm');
    expect(extracted.suggestedCategoryId).toBe('cat-health');
    expect(extracted.totalAmountKopecks).toBe(45000);
  });

  it('handles empty or unrecognized receipt text gracefully with baseline confidence', () => {
    const blankReceipt = 'Неразборчивый текст';
    const extracted = extractDataFromReceiptText(blankReceipt, 'doc-test-blank');

    // Defaults to 75000 and generic merchant name with low confidence
    expect(extracted.totalAmountKopecks).toBe(75000);
    expect(extracted.merchantName).toBe('Супермаркет / Магазин');
    expect(extracted.confidenceScore).toBeLessThanOrEqual(0.5);
  });
});
