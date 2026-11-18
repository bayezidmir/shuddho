export interface ClickIds {
  fbc: string | null;
  fbp: string | null;
  fbclid: string | null;
  ttclid: string | null;
  ttp: string | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  msclkid: string | null;
  twclid: string | null;
  li_fat_id: string | null;
  ScCid: string | null;
  epik: string | null;
}

export interface AttributionData {
  click_ids: ClickIds;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  utm_id: string | null;
  landing_page: string | null;
  last_landing_page: string | null;
  referrer: string | null;
  first_touch_at: string | null;
  last_touch_at: string | null;
}

/**
 * Builds Meta _fbc cookie value according to Meta & Section 9.3 spec:
 * Format: fb.1.<unix_ms_when_first_seen>.<fbclid>
 * If the same fbclid arrives again, preserves the original timestamp.
 * If a new fbclid arrives, rebuilds with nowMs. Never modifies fbclid.
 */
export function buildFbc(
  fbclid: string | null | undefined,
  existingFbc: string | null | undefined,
  nowMs: number = Date.now(),
): string | null {
  if (!fbclid) {
    return existingFbc || null;
  }
  if (existingFbc) {
    const parts = existingFbc.split('.');
    // fb.1.<ts>.<fbclid...> (fbclid itself might theoretically contain dots, so slice from index 3)
    if (parts.length >= 4 && parts[0] === 'fb' && parts[1] === '1') {
      const existingClickId = parts.slice(3).join('.');
      if (existingClickId === fbclid) {
        return existingFbc;
      }
    }
  }
  return `fb.1.${nowMs}.${fbclid}`;
}

export function generateFbp(nowMs: number = Date.now(), rand10?: string): string {
  const digits = rand10 ?? String(Math.floor(1000000000 + Math.random() * 9000000000));
  return `fb.1.${nowMs}.${digits}`;
}

export function extractAttributionFromParams(
  search: string,
  cookies: Record<string, string> = {},
  existing: Partial<AttributionData> = {},
  context: { url?: string; referrer?: string; nowMs?: number } = {},
): AttributionData {
  const nowMs = context.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);

  const rawFbclid = params.get('fbclid') || existing.click_ids?.fbclid || null;
  const fbc = buildFbc(params.get('fbclid'), cookies._fbc || existing.click_ids?.fbc, nowMs);
  const fbp = cookies._fbp || existing.click_ids?.fbp || generateFbp(nowMs);

  const click_ids: ClickIds = {
    fbc,
    fbp,
    fbclid: rawFbclid,
    ttclid: params.get('ttclid') || cookies.ttclid || existing.click_ids?.ttclid || null,
    ttp: cookies._ttp || cookies.ttp || existing.click_ids?.ttp || null,
    gclid: params.get('gclid') || cookies._gcl_aw || existing.click_ids?.gclid || null,
    gbraid: params.get('gbraid') || cookies._gcl_gb || existing.click_ids?.gbraid || null,
    wbraid: params.get('wbraid') || existing.click_ids?.wbraid || null,
    msclkid: params.get('msclkid') || cookies._uetmsclkid || existing.click_ids?.msclkid || null,
    twclid: params.get('twclid') || existing.click_ids?.twclid || null,
    li_fat_id: params.get('li_fat_id') || existing.click_ids?.li_fat_id || null,
    ScCid: params.get('ScCid') || cookies._scid || existing.click_ids?.ScCid || null,
    epik: params.get('epik') || cookies._epik || existing.click_ids?.epik || null,
  };

  return {
    click_ids,
    utm_source: params.get('utm_source') || existing.utm_source || null,
    utm_medium: params.get('utm_medium') || existing.utm_medium || null,
    utm_campaign: params.get('utm_campaign') || existing.utm_campaign || null,
    utm_content: params.get('utm_content') || existing.utm_content || null,
    utm_term: params.get('utm_term') || existing.utm_term || null,
    utm_id: params.get('utm_id') || existing.utm_id || null,
    landing_page: existing.landing_page || context.url || null,
    last_landing_page: context.url || existing.last_landing_page || null,
    referrer: existing.referrer || context.referrer || null,
    first_touch_at: existing.first_touch_at || nowIso,
    last_touch_at: nowIso,
  };
}

const ATTRIBUTION_STORAGE_KEY = 'shuddho_attribution_v1';
const COOKIE_DAYS = 90;

function parseBrowserCookies(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  const map: Record<string, string> = {};
  for (const part of document.cookie.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const key = part.slice(0, idx).trim();
      const val = decodeURIComponent(part.slice(idx + 1).trim());
      map[key] = val;
    }
  }
  return map;
}

function setFirstPartyCookie(name: string, value: string | null, days = COOKIE_DAYS) {
  if (typeof document === 'undefined' || !value) return;
  const expires = new Date(Date.now() + days * 86400 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function captureAttributionOnLanding(): AttributionData {
  if (typeof window === 'undefined') {
    return extractAttributionFromParams('');
  }
  const cookies = parseBrowserCookies();
  let existing: Partial<AttributionData> = {};
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (raw) existing = JSON.parse(raw);
  } catch {
    // ignore storage errors
  }

  const next = extractAttributionFromParams(window.location.search, cookies, existing, {
    url: window.location.href,
    referrer: document.referrer || undefined,
  });

  // Persist first-party cookies for 90 days
  setFirstPartyCookie('_fbc', next.click_ids.fbc);
  setFirstPartyCookie('_fbp', next.click_ids.fbp);
  setFirstPartyCookie('ttclid', next.click_ids.ttclid);
  setFirstPartyCookie('_gcl_aw', next.click_ids.gclid);
  setFirstPartyCookie('_gcl_gb', next.click_ids.gbraid);
  setFirstPartyCookie('wbraid', next.click_ids.wbraid);
  setFirstPartyCookie('_uetmsclkid', next.click_ids.msclkid);
  setFirstPartyCookie('twclid', next.click_ids.twclid);
  setFirstPartyCookie('li_fat_id', next.click_ids.li_fat_id);
  setFirstPartyCookie('_scid', next.click_ids.ScCid);
  setFirstPartyCookie('_epik', next.click_ids.epik);

  try {
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }

  return next;
}

export function getStoredAttribution(): AttributionData {
  if (typeof window === 'undefined') return extractAttributionFromParams('');
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return captureAttributionOnLanding();
}
