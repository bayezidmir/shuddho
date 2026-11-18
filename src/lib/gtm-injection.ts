export interface TrackingInjectionConfig {
  gtmEnabled?: boolean;
  gtmContainerId?: string;
  overrideHeadCode?: string;
  overrideBodyCode?: string;
  ga4Id?: string;
  metaPixelId?: string;
  tiktokPixelId?: string;
  googleAdsId?: string;
  msUetId?: string;
  consentDefaultAnalytics?: string;
  consentDefaultAds?: string;
}

export function normalizeGtmId(raw: string | null | undefined): string {
  return String(raw || '')
    .trim()
    .toUpperCase();
}

export function isValidGtmId(raw: string | null | undefined): boolean {
  return /^GTM-[A-Z0-9]{4,12}$/i.test(normalizeGtmId(raw));
}

export function computeTrackingSignature(tr: TrackingInjectionConfig): string {
  const enabled = Boolean(tr.gtmEnabled);
  const cid = normalizeGtmId(tr.gtmContainerId);
  const ovh = String(tr.overrideHeadCode || '').trim();
  const ovb = String(tr.overrideBodyCode || '').trim();
  const ga4 = String(tr.ga4Id || '').trim();
  return JSON.stringify({
    enabled,
    cid,
    ovh,
    ovb,
    ga4,
    ca: tr.consentDefaultAnalytics || 'granted',
    cad: tr.consentDefaultAds || 'granted',
  });
}

export function normalizeHeadOverrideHtml(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  // If user pasted HTML tags (<script>, <!-- comment -->, <meta>, <link>), preserve HTML as-is
  if (/^\s*(<!--|<script[\s>]|<meta[\s>]|<link[\s>]|<noscript[\s>])/i.test(trimmed) || /<script[\s>]/i.test(trimmed)) {
    return trimmed;
  }
  // Otherwise user entered raw JavaScript without <script> wrapper
  return `<script>${trimmed}</script>`;
}

export function normalizeBodyOverrideHtml(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/<noscript[\s>]|<iframe[\s>]|<!--/i.test(trimmed)) {
    return trimmed;
  }
  return `<noscript>${trimmed}</noscript>`;
}

export function buildGtmInitScriptBody(): string {
  return `window.dataLayer=window.dataLayer||[];window.dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});function gtag(){dataLayer.push(arguments);}gtag('js',new Date());`;
}

export function buildGtmHeadScriptBody(gtmContainerId: string): string {
  const cid = normalizeGtmId(gtmContainerId);
  return `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${cid}');`;
}

export function buildConsentDefaultScriptBody(tr: TrackingInjectionConfig): string {
  const ads = tr.consentDefaultAds === 'denied' ? 'denied' : 'granted';
  const analytics = tr.consentDefaultAnalytics === 'denied' ? 'denied' : 'granted';
  return `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',{ad_storage:'${ads}',ad_user_data:'${ads}',ad_personalization:'${ads}',analytics_storage:'${analytics}'});`;
}

export function buildHeadTrackingHtml(tr: TrackingInjectionConfig): string {
  const sig = computeTrackingSignature(tr).replace(/"/g, '&quot;');
  const parts: string[] = [];

  parts.push(
    `<script id="shuddho-consent-default">${buildConsentDefaultScriptBody(tr)}</script>`,
  );

  const cid = normalizeGtmId(tr.gtmContainerId);
  const overrideHead = String(tr.overrideHeadCode || '').trim();
  const shouldInjectGtm = Boolean(tr.gtmEnabled) && (Boolean(overrideHead) || isValidGtmId(cid));

  if (shouldInjectGtm) {
    if (overrideHead) {
      parts.push(
        `<!-- Shuddho Custom Head Override -->\n    <meta id="shuddho-gtm-head" name="shuddho-gtm" content="ssr" data-shuddho-gtm="ssr" data-gtm-sig="${sig}" />\n    ${normalizeHeadOverrideHtml(overrideHead)}`,
      );
    } else {
      parts.push(
        `<!-- Google Tag Manager -->\n    <script id="shuddho-gtm-head" async src="https://www.googletagmanager.com/gtm.js?id=${cid}" data-shuddho-gtm="ssr" data-gtm-sig="${sig}"></script>\n    <script id="shuddho-gtm-start">${buildGtmInitScriptBody()}</script>\n    <!-- End Google Tag Manager -->`,
      );
    }
  }

  const ga4Id = String(tr.ga4Id || '').trim();
  if (ga4Id && /^G-[A-Z0-9]+$/i.test(ga4Id)) {
    parts.push(
      `<script async src="https://www.googletagmanager.com/gtag/js?id=${ga4Id}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4Id}');</script>`,
    );
  }

  return parts.join('\n    ');
}

export function buildBodyTrackingHtml(tr: TrackingInjectionConfig): string {
  const cid = normalizeGtmId(tr.gtmContainerId);
  const overrideBody = String(tr.overrideBodyCode || '').trim();
  const shouldInjectGtm = Boolean(tr.gtmEnabled) && (Boolean(overrideBody) || isValidGtmId(cid));
  if (!shouldInjectGtm) return '';

  if (overrideBody) {
    return `<div id="shuddho-gtm-noscript" data-shuddho-gtm="ssr" style="display:none">${normalizeBodyOverrideHtml(overrideBody)}</div>`;
  }
  return `<!-- Google Tag Manager (noscript) -->\n    <noscript id="shuddho-gtm-noscript" data-shuddho-gtm="ssr"><iframe src="https://www.googletagmanager.com/ns.html?id=${cid}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>\n    <!-- End Google Tag Manager (noscript) -->`;
}

export function injectTrackingIntoDocument(html: string, tr: TrackingInjectionConfig): string {
  const headHtml = buildHeadTrackingHtml(tr);
  const bodyHtml = buildBodyTrackingHtml(tr);

  let out = html;
  const dataLayerMarker = '<script>\n      window.dataLayer = window.dataLayer || [];\n    </script>';
  if (headHtml) {
    if (out.includes(dataLayerMarker)) {
      out = out.replace(dataLayerMarker, `${dataLayerMarker}\n    ${headHtml}`);
    } else if (out.includes('</head>')) {
      out = out.replace('</head>', `    ${headHtml}\n  </head>`);
    }
  }

  if (bodyHtml && out.includes('<body>')) {
    out = out.replace('<body>', `<body>\n    ${bodyHtml}`);
  }
  return out;
}
