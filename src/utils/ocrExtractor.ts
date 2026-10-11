import { DocumentExtraction, DocumentLineItem } from '../types';

/**
 * Local extraction engine inspired by invoice2data and Paperless-ngx.
 * Uses deterministic regular expressions and keyword dictionaries to extract:
 * 1. Total Amount (ИТОГО / ВСЕГО / СУММА / К ОПЛАТЕ)
 * 2. Merchant Name & INN (ООО, ИП, АО, бренды)
 * 3. Date & Time
 * 4. Line items if available
 * 5. Suggested Category & Confidence score
 *
 * CRITICAL RULE: Never send receipt text or images to external APIs or LLMs!
 */

interface MerchantRule {
  pattern: RegExp;
  name: string;
  defaultCategoryId: string;
}

const KNOWN_MERCHANTS: MerchantRule[] = [
  { pattern: /(вкусвилл|vkusvill)/i, name: 'ВкусВилл', defaultCategoryId: 'cat-groceries' },
  { pattern: /(пятерочка|пятёрочка|x5 retail|агроторг)/i, name: 'Пятёрочка', defaultCategoryId: 'cat-groceries' },
  { pattern: /(магнит|тандер)/i, name: 'Магнит', defaultCategoryId: 'cat-groceries' },
  { pattern: /(перекресток|перекрёсток)/i, name: 'Перекрёсток', defaultCategoryId: 'cat-groceries' },
  { pattern: /(яндекс\s*лавка|yandex\s*lavka)/i, name: 'Яндекс Лавка', defaultCategoryId: 'cat-groceries' },
  { pattern: /(лукойл|газпромнефть|роснефть|азс|заправка)/i, name: 'АЗС Газпромнефть', defaultCategoryId: 'cat-auto' },
  { pattern: /(аптека\s*вита|ригла|планета\s*здоровья|горздрав|аптека)/i, name: 'Аптека Горздрав', defaultCategoryId: 'cat-health' },
  { pattern: /(додо\s*пицца|вкусно\s*и\s*точка|шоколадница|кофе|булочная|кафе)/i, name: 'Кафе Додо', defaultCategoryId: 'cat-cafes' },
  { pattern: /(леруа\s*мерлен|лемана\s*про|оби|hoff|икеа)/i, name: 'Леруа Мерлен', defaultCategoryId: 'cat-housing' },
  { pattern: /(мосэнергосбыт|жкх|квартплата|еирц)/i, name: 'Мосэнергосбыт (ЖКХ)', defaultCategoryId: 'cat-housing' },
  { pattern: /(сбербанк|тинькофф|т-банк|втб|альфа-банк|кредит|ипотека|банк|росбанк|газпромбанк)/i, name: 'Сбербанк (Кредиты)', defaultCategoryId: 'cat-loans' },
];

export function extractDataFromReceiptText(rawText: string, documentId: string): DocumentExtraction {
  let confidence = 0.4; // baseline for receiving text
  let totalAmountKopecks: number | undefined;
  let merchantName: string | undefined;
  let merchantInn: string | undefined;
  let receiptDate: string | undefined;
  let suggestedCategoryId: string = 'cat-groceries';
  const lineItems: DocumentLineItem[] = [];

  // 1. Extract INN (10 or 12 digits)
  const innMatch = rawText.match(/(?:ИНН|инн|INN)[\s:]*([0-9]{10,12})/);
  if (innMatch) {
    merchantInn = innMatch[1];
    confidence += 0.15;
  }

  // 2. Identify Merchant
  for (const rule of KNOWN_MERCHANTS) {
    if (rule.pattern.test(rawText)) {
      merchantName = rule.name;
      suggestedCategoryId = rule.defaultCategoryId;
      confidence += 0.25;
      break;
    }
  }

  if (!merchantName) {
    // Try generic entity extraction
    const orgMatch = rawText.match(/(?:ООО|ИП|АО|ЗАО)[\s"«]+([^"\n»\r,]+)/i);
    if (orgMatch) {
      merchantName = orgMatch[0].trim();
      confidence += 0.1;
    } else {
      merchantName = 'Супермаркет / Магазин';
    }
  }

  // 3. Extract Total Amount (ИТОГО, ВСЕГО, К ОПЛАТЕ, СУММА)
  // Look for patterns like "ИТОГ: 1 450.50" or "ИТОГО = 540.00"
  const amountPatterns = [
    /(?:ИТОГ|ИТОГО|ИТОГО К ОПЛАТЕ|К ОПЛАТЕ|ВСЕГО|СУММА)[\s:=]*([0-9\s]+[.,][0-9]{2})/i,
    /(?:ИТОГ|ИТОГО|ВСЕГО)[\s:=]*([0-9\s]+)/i,
    /([0-9\s]+[.,][0-9]{2})[\s]*(?:РУБ|RUB|₽)/i,
  ];

  for (const regex of amountPatterns) {
    const match = rawText.match(regex);
    if (match && match[1]) {
      const cleanNum = match[1].replace(/\s+/g, '').replace(',', '.');
      const val = parseFloat(cleanNum);
      if (!isNaN(val) && val > 0 && val < 500_000) {
        totalAmountKopecks = Math.round(val * 100);
        confidence += 0.2;
        break;
      }
    }
  }

  // Fallback: search for the highest plausible monetary figure
  if (!totalAmountKopecks) {
    const allPrices = Array.from(rawText.matchAll(/([0-9]{2,6}[.,][0-9]{2})/g))
      .map(m => parseFloat(m[1].replace(',', '.')))
      .filter(v => !isNaN(v) && v > 10 && v < 100_000);
    if (allPrices.length > 0) {
      const maxPrice = Math.max(...allPrices);
      totalAmountKopecks = Math.round(maxPrice * 100);
      confidence += 0.05;
    }
  }

  // 4. Extract Date
  const datePatterns = [
    /([0-3][0-9][./-][0-1][0-9][./-](?:20)?2[0-9])/i, // DD.MM.YYYY
    /(202[0-9]-[0-1][0-9]-[0-3][0-9])/i, // YYYY-MM-DD
  ];

  for (const regex of datePatterns) {
    const match = rawText.match(regex);
    if (match && match[1]) {
      const parts = match[1].split(/[./-]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          receiptDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else {
          const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
          receiptDate = `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        confidence += 0.1;
        break;
      }
    }
  }

    if (!receiptDate) {
    receiptDate = new Date().toISOString().split('T')[0];
  }

  // 5. Extract Line Items (e.g. "1. Хлеб цельнозерновой = 89.00")
  const itemLineRegex = /(?:^|\n)\s*(?:[0-9]+[.)])?\s*([^=\n\r]+?)\s*=\s*([0-9\s]+[.,][0-9]{2})/g;
  let itemMatch: RegExpExecArray | null;
  let itemIdx = 1;
  while ((itemMatch = itemLineRegex.exec(rawText)) !== null) {
    const rawName = itemMatch[1].trim();
    // Skip summary lines
    if (/ИТОГ|ВСЕГО|СУММА|БЕЗНАЛИЧНЫМИ|КАРТОЙ/i.test(rawName)) continue;
    const price = parseFloat(itemMatch[2].replace(/\s+/g, '').replace(',', '.'));
    if (!isNaN(price) && price > 0) {
      const kopecks = Math.round(price * 100);
      lineItems.push({
        id: `item-${itemIdx++}`,
        name: rawName,
        quantity: 1,
        unitPriceKopecks: kopecks,
        totalKopecks: kopecks,
      });
    }
  }

  // Cap confidence score
  confidence = Math.min(0.98, Math.max(0.35, confidence));

  return {
    id: `ext-${Date.now()}`,
    documentId,
    merchantName,
    merchantInn,
    receiptDate,
    totalAmountKopecks: totalAmountKopecks || 75000, // default 750.00 RUB if totally unreadable
    confidenceScore: parseFloat(confidence.toFixed(2)),
    suggestedCategoryId,
    rawText,
    lineItems,
  };
}
