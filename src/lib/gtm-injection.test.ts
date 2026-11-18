import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHeadTrackingHtml,
  buildBodyTrackingHtml,
  injectTrackingIntoDocument,
  normalizeHeadOverrideHtml,
} from './gtm-injection';

const SAMPLE_HTML = `<!doctype html>
<html>
  <head>
    <title>Shuddho</title>
    <script>
      window.dataLayer = window.dataLayer || [];
    </script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

test('injectTrackingIntoDocument embeds modern async GTM head script, gtag init, and noscript tags inside valid head/body', () => {
  const html = injectTrackingIntoDocument(SAMPLE_HTML, {
    gtmEnabled: true,
    gtmContainerId: 'gtm-plshptxj',
    consentDefaultAnalytics: 'granted',
    consentDefaultAds: 'granted',
  });

  const headCloseIdx = html.indexOf('</head>');
  const gtmHeadIdx = html.indexOf('https://www.googletagmanager.com/gtm.js?id=GTM-PLSHPTXJ');
  assert.ok(gtmHeadIdx > 0 && gtmHeadIdx < headCloseIdx, 'GTM script must be inside <head>');
  assert.match(html, /<script id="shuddho-gtm-head" async src="https:\/\/www\.googletagmanager\.com\/gtm\.js\?id=GTM-PLSHPTXJ"/);
  assert.match(html, /gtag\('js',new Date\(\)\)/);
  assert.match(html, /https:\/\/www\.googletagmanager\.com\/ns\.html\?id=GTM-PLSHPTXJ/);
  assert.match(html, /gtag\('consent','default'/);
  assert.equal(html.includes('<span id="shuddho-gtm-head"'), false);
});

test('injectTrackingIntoDocument does not inject GTM script when gtmEnabled is false', () => {
  const html = injectTrackingIntoDocument(SAMPLE_HTML, {
    gtmEnabled: false,
    gtmContainerId: 'GTM-PLSHPTXJ',
  });

  assert.equal(html.includes('googletagmanager.com/gtm.js'), false);
  assert.equal(html.includes('googletagmanager.com/ns.html'), false);
  assert.match(html, /shuddho-consent-default/);
});

test('normalizeHeadOverrideHtml preserves script tags and comments and wraps bare JS cleanly', () => {
  const fullTag = `<script async src="https://www.googletagmanager.com/gtm.js?id=GTM-PLSHPTXJ"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n</script>`;
  assert.equal(normalizeHeadOverrideHtml(fullTag), fullTag);

  const bareJs = 'console.log("custom tag");';
  assert.equal(normalizeHeadOverrideHtml(bareJs), '<script>console.log("custom tag");</script>');
});

test('buildHeadTrackingHtml and buildBodyTrackingHtml honor custom overrides using valid <meta> head marker', () => {
  const head = buildHeadTrackingHtml({
    gtmEnabled: true,
    overrideHeadCode:
      '<script async src="https://www.googletagmanager.com/gtm.js?id=GTM-PLSHPTXJ"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());</script>',
  });
  assert.match(head, /<meta id="shuddho-gtm-head"/);
  assert.match(head, /https:\/\/www\.googletagmanager\.com\/gtm\.js\?id=GTM-PLSHPTXJ/);
  assert.equal(head.includes('<span'), false);

  const body = buildBodyTrackingHtml({
    gtmEnabled: true,
    overrideBodyCode: '<noscript><iframe src="https://sgtm.shuddho.com.bd/ns.html"></iframe></noscript>',
  });
  assert.match(body, /https:\/\/sgtm\.shuddho\.com\.bd\/ns\.html/);
});
