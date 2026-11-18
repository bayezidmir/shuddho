import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveDateRange,
  parseUtcTimestamp,
  isTimestampInRange,
  computeDashboardAnalytics,
} from './dashboard-analytics';

const FIXED_NOW = new Date('2026-11-18T12:00:00Z');

test('resolveDateRange computes presets and previous comparison windows accurately', () => {
  const today = resolveDateRange({ preset: 'today', now: FIXED_NOW });
  assert.equal(today.from, '2026-11-18');
  assert.equal(today.to, '2026-11-18');
  assert.equal(today.prevFrom, '2026-11-17');
  assert.equal(today.prevTo, '2026-11-17');
  assert.equal(today.dayCount, 1);
  assert.equal(today.granularity, 'hour');

  const sevenDays = resolveDateRange({ preset: '7d', now: FIXED_NOW });
  assert.equal(sevenDays.from, '2026-11-12');
  assert.equal(sevenDays.to, '2026-11-18');
  assert.equal(sevenDays.prevFrom, '2026-11-05');
  assert.equal(sevenDays.prevTo, '2026-11-11');
  assert.equal(sevenDays.dayCount, 7);
  assert.equal(sevenDays.granularity, 'day');

  const thisMonth = resolveDateRange({ preset: 'this_month', now: FIXED_NOW });
  assert.equal(thisMonth.from, '2026-11-01');
  assert.equal(thisMonth.to, '2026-11-18');
  assert.equal(thisMonth.dayCount, 18);

  const all = resolveDateRange({ preset: 'all', now: FIXED_NOW });
  assert.equal(all.from, null);
  assert.equal(all.to, null);
  assert.equal(all.prevFrom, null);
});

test('resolveDateRange swaps reversed custom dates and respects explicit granularity', () => {
  const custom = resolveDateRange({
    preset: 'custom',
    from: '2026-11-18',
    to: '2026-11-16',
    now: FIXED_NOW,
  });
  assert.equal(custom.from, '2026-11-16');
  assert.equal(custom.to, '2026-11-18');
  assert.equal(custom.dayCount, 3);
  assert.equal(custom.prevFrom, '2026-11-13');
  assert.equal(custom.prevTo, '2026-11-15');
  assert.equal(custom.granularity, 'day');

  const singleCustomDaily = resolveDateRange({
    preset: 'custom',
    from: '2026-11-17',
    to: '2026-11-17',
    granularity: 'day',
    now: FIXED_NOW,
  });
  assert.equal(singleCustomDaily.granularity, 'day');
});

test('parseUtcTimestamp & isTimestampInRange handle ISO and SQLite timestamps', () => {
  const d1 = parseUtcTimestamp('2026-11-18T08:30:00Z');
  const d2 = parseUtcTimestamp('2026-11-18 10:32:16');
  assert.ok(d1);
  assert.ok(d2);
  assert.equal(d2.getUTCHours(), 10);

  assert.equal(isTimestampInRange('2026-11-16T23:59:59Z', '2026-11-16', '2026-11-17'), true);
  assert.equal(isTimestampInRange('2026-11-18 00:00:01', '2026-11-16', '2026-11-17'), false);
  assert.equal(isTimestampInRange('2026-11-18 00:00:01', null, null), true);
});

test('computeDashboardAnalytics filters orders, fills missing chart days, and excludes cancelled sales', () => {
  const sampleOrders = [
    {
      id: 'o1',
      status: 'delivered',
      total: 1870,
      discount: 0,
      shipping_fee: 70,
      payment_method: 'cod',
      payment_status: 'paid',
      paid_amount: 1870,
      district: 'Dhaka',
      courier_code: 'pathao',
      attribution: JSON.stringify({ utm_source: 'facebook' }),
      created_at: '2026-11-16T08:56:15Z',
    },
    {
      id: 'o2',
      status: 'cancelled',
      total: 999,
      discount: 0,
      shipping_fee: 70,
      payment_method: 'cod',
      payment_status: 'unpaid',
      paid_amount: 0,
      district: 'Dhaka',
      courier_code: '',
      attribution: JSON.stringify({ utm_source: 'direct' }),
      created_at: '2026-11-17T09:42:00Z',
    },
    {
      id: 'o3',
      status: 'pending',
      total: 1600,
      discount: 100,
      shipping_fee: 130,
      payment_method: 'bkash',
      payment_status: 'paid',
      paid_amount: 1600,
      district: 'Sylhet',
      courier_code: '',
      attribution: JSON.stringify({ click_ids: { ttclid: 'TT1' } }),
      created_at: '2026-11-18 08:30:00',
    },
    // Prior period order (Nov 14)
    {
      id: 'o0',
      status: 'delivered',
      total: 1000,
      discount: 0,
      shipping_fee: 70,
      payment_method: 'cod',
      payment_status: 'paid',
      paid_amount: 1000,
      district: 'Dhaka',
      courier_code: 'steadfast',
      attribution: '{}',
      created_at: '2026-11-14T10:00:00Z',
    },
  ];

  const sampleItems = [
    { order_id: 'o1', product_id: 'p1', sku: 'HN-500', name: 'Sundarban Honey', category: 'Honey', unit_price: 850, cost_price: 500, quantity: 2 },
    { order_id: 'o2', product_id: 'p2', sku: 'GH-500', name: 'Cancelled Ghee', category: 'Ghee', unit_price: 929, cost_price: 600, quantity: 1 },
    { order_id: 'o3', product_id: 'p3', sku: 'DT-500', name: 'Ajwa Dates', category: 'Dates', unit_price: 1570, cost_price: 1000, quantity: 1 },
  ];

  const range = resolveDateRange({ preset: 'custom', from: '2026-11-16', to: '2026-11-18', now: FIXED_NOW });
  const res = computeDashboardAnalytics({
    orders: sampleOrders,
    orderItems: sampleItems,
    incompleteOrders: [{ id: 'i1', created_at: '2026-11-18 09:00:00' }],
    customers: [{ id: 'c1', created_at: '2026-11-17T10:00:00Z' }],
    resolvedRange: range,
  });

  // Valid sales = 1870 + 1600 = 3470 (excludes cancelled 999 and out-of-range 1000)
  assert.equal(res.kpis.totalSales, 3470);
  assert.equal(res.kpis.totalOrders, 3);
  assert.equal(res.kpis.validOrders, 2);
  assert.equal(res.kpis.awaitingConfirmation, 1);
  assert.equal(res.kpis.incompleteCount, 1);
  assert.equal(res.kpis.customerCount, 1);
  // Prior 3 days (Nov 13-15) had o0 (1000) -> +247%
  assert.equal(res.kpis.deltas.salesPct, 247);

  // 3 continuous days in timeSeries
  assert.equal(res.timeSeries.length, 3);
  assert.equal(res.timeSeries[0].key, '2026-11-16');
  assert.equal(res.timeSeries[0].sales, 1870);
  assert.equal(res.timeSeries[1].key, '2026-11-17');
  assert.equal(res.timeSeries[1].sales, 0);
  assert.equal(res.timeSeries[1].cancelled, 1);
  assert.equal(res.timeSeries[2].key, '2026-11-18');
  assert.equal(res.timeSeries[2].sales, 1600);

  // Top products excludes cancelled order o2
  assert.equal(res.topProducts.length, 2);
  assert.equal(res.topProducts[0].sku, 'HN-500');
  assert.equal(res.topProducts[0].profit, 700);
});

test('computeDashboardAnalytics builds 24 hourly points for single-day ranges', () => {
  const range = resolveDateRange({ preset: 'today', now: FIXED_NOW });
  const res = computeDashboardAnalytics({
    orders: [
      { id: 'o1', status: 'confirmed', total: 1200, payment_method: 'cod', payment_status: 'unpaid', created_at: '2026-11-18T05:12:00Z' },
      { id: 'o2', status: 'pending', total: 800, payment_method: 'bkash', payment_status: 'paid', paid_amount: 800, created_at: '2026-11-18T05:45:00Z' },
    ],
    orderItems: [],
    incompleteOrders: [],
    customers: [],
    resolvedRange: range,
  });

  assert.equal(res.timeSeries.length, 24);
  assert.equal(res.timeSeries[5].key, '05');
  assert.equal(res.timeSeries[5].orders, 2);
  assert.equal(res.timeSeries[5].sales, 2000);
});
