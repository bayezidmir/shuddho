const BANGLA_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBanglaDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => BANGLA_DIGITS[Number(d)] ?? d);
}

export function formatBDT(amount: number, lang: 'en' | 'bn' = 'en', fromPoisha = false): string {
  const taka = fromPoisha ? Math.round(amount / 100) : Math.round(amount);
  const formatted = taka.toLocaleString('en-IN');
  const display = lang === 'bn' ? toBanglaDigits(formatted) : formatted;
  return `৳${display}`;
}

export interface BDPhoneResult {
  valid: boolean;
  normalized: string;
  local: string;
  operator?: string;
  error?: string;
}

const OPERATOR_PREFIXES: Record<string, string> = {
  '013': 'Grameenphone',
  '014': 'Banglalink',
  '015': 'Teletalk',
  '016': 'Airtel',
  '017': 'Grameenphone',
  '018': 'Robi',
  '019': 'Banglalink',
};

export function normalizeBDPhone(raw: string): BDPhoneResult {
  const cleaned = String(raw ?? '').replace(/[\s\-().]/g, '');
  let local = cleaned;

  if (local.startsWith('+880')) {
    local = '0' + local.slice(4);
  } else if (local.startsWith('880')) {
    local = '0' + local.slice(3);
  }

  if (!/^01[3-9]\d{8}$/.test(local)) {
    return {
      valid: false,
      normalized: '',
      local: cleaned,
      error: 'Enter a valid 11-digit Bangladeshi mobile number starting with 013–019 (e.g. 01711482910).',
    };
  }

  return {
    valid: true,
    normalized: `+88${local}`,
    local,
    operator: OPERATOR_PREFIXES[local.slice(0, 3)] ?? 'Mobile',
  };
}

export function countSmsParts(text: string): { encoding: 'GSM-7' | 'Unicode'; chars: number; parts: number } {
  const chars = text.length;
  // Detect non-GSM characters (e.g. Bangla Unicode)
  const isUnicode = /[^\u0000-\u007F]/.test(text);
  if (chars === 0) {
    return { encoding: 'GSM-7', chars: 0, parts: 0 };
  }
  if (isUnicode) {
    const parts = chars <= 70 ? 1 : Math.ceil(chars / 67);
    return { encoding: 'Unicode', chars, parts };
  }
  const parts = chars <= 160 ? 1 : Math.ceil(chars / 153);
  return { encoding: 'GSM-7', chars, parts };
}

export function validateGtmContainerId(id: string): boolean {
  return /^GTM-[A-Z0-9]{5,10}$/i.test(id.trim());
}
