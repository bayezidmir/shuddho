import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBDPhone, formatBDT, countSmsParts, validateGtmContainerId } from './bd-validation';
import { buildFbc, extractAttributionFromParams } from './attribution';
import { calculateCartTotals } from './pricing';
import { hasPermission } from './rbac';
import { BD_DISTRICTS } from './districts';

test('normalizeBDPhone validates and normalizes Bangladeshi mobile numbers', () => {
  const valid1 = normalizeBDPhone('01711482910');
  assert.equal(valid1.valid, true);
  assert.equal(valid1.normalized, '+8801711482910');
  assert.equal(valid1.local, '01711482910');

  const valid2 = normalizeBDPhone('+880 1819-223344');
  assert.equal(valid2.valid, true);
  assert.equal(valid2.normalized, '+8801819223344');

  const invalid = normalizeBDPhone('01234567890');
  assert.equal(invalid.valid, false);
});

test('formatBDT formats EN and BN numerals cleanly', () => {
  assert.equal(formatBDT(1850, 'en'), '৳1,850');
  assert.equal(formatBDT(1850, 'bn'), '৳১,৮৫০');
});

test('countSmsParts computes GSM-7 and Bangla Unicode SMS parts', () => {
  assert.deepEqual(countSmsParts('Hello order confirmed'), { encoding: 'GSM-7', chars: 21, parts: 1 });
  const bn = countSmsParts('আপনার অর্ডার কনফার্ম হয়েছে');
  assert.equal(bn.encoding, 'Unicode');
  assert.equal(bn.parts, 1);
});

test('validateGtmContainerId accepts valid GTM container IDs', () => {
  assert.equal(validateGtmContainerId('GTM-ABC1234'), true);
  assert.equal(validateGtmContainerId('UA-12345'), false);
});

test('buildFbc creates and preserves timestamp for matching fbclid and rebuilds on new fbclid', () => {
  const first = buildFbc('IwAR2First', null, 1763455648123);
  assert.equal(first, 'fb.1.1763455648123.IwAR2First');

  // Same fbclid must preserve original timestamp
  const same = buildFbc('IwAR2First', first, 1763999999999);
  assert.equal(same, 'fb.1.1763455648123.IwAR2First');

  // New fbclid must rebuild with new timestamp
  const changed = buildFbc('IwAR2NewClick', first, 1763999999999);
  assert.equal(changed, 'fb.1.1763999999999.IwAR2NewClick');
});

test('extractAttributionFromParams captures fbclid, ttclid, gclid, gbraid, wbraid, msclkid', () => {
  const attr = extractAttributionFromParams(
    '?fbclid=ABC&ttclid=TT1&gclid=GC1&gbraid=GB1&wbraid=WB1&msclkid=MS1&utm_source=facebook',
    {},
    {},
    { nowMs: 1763455648123 },
  );
  assert.equal(attr.click_ids.fbc, 'fb.1.1763455648123.ABC');
  assert.equal(attr.click_ids.ttclid, 'TT1');
  assert.equal(attr.click_ids.gclid, 'GC1');
  assert.equal(attr.click_ids.gbraid, 'GB1');
  assert.equal(attr.click_ids.wbraid, 'WB1');
  assert.equal(attr.click_ids.msclkid, 'MS1');
  assert.equal(attr.utm_source, 'facebook');
});

test('calculateCartTotals computes discount, free shipping threshold, and totals accurately', () => {
  const res = calculateCartTotals({
    items: [{ productId: 'p1', unitPrice: 850, quantity: 2 }],
    coupon: { code: 'PURE10', type: 'percentage', value: 10, minSpend: 1000, maxDiscount: 200 },
    shipping: { zoneId: 'inside_dhaka', zoneName: 'Inside Dhaka', baseFee: 70, freeThreshold: 2000 },
  });
  assert.equal(res.subtotal, 1700);
  assert.equal(res.discount, 170);
  assert.equal(res.shipping, 70);
  assert.equal(res.total, 1600);
  assert.equal(res.freeShippingProgress.unlocked, false);
  assert.equal(res.freeShippingProgress.remaining, 470);
});

test('RBAC enforces confirmation agent restrictions', () => {
  assert.equal(hasPermission('agent', 'orders.confirm'), true);
  assert.equal(hasPermission('agent', 'settings.edit'), false);
  assert.equal(hasPermission('agent', 'reports.view'), false);
  assert.equal(hasPermission('owner', 'tracking.code_inject'), true);
});

test('BD_DISTRICTS seeds all 64 districts of Bangladesh', () => {
  assert.equal(BD_DISTRICTS.length, 64);
});
