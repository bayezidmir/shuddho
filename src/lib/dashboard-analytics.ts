export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | '90d'
  | 'this_month'
  | 'all'
  | 'custom';

export type ChartGranularity = 'auto' | 'hour' | 'day';

export interface ResolvedDateRange {
  preset: DateRangePreset;
  from: string | null;
  to: string | null;
  prevFrom: string | null;
  prevTo: string | null;
  label: string;
  comparisonLabel: string | null;
  dayCount: number | null;
  granularity: 'hour' | 'day';
}

export interface TimeSeriesPoint {
  key: string;
  label: string;
  shortLabel: string;
  orders: number;
  validOrders: number;
  sales: number;
  grossSales: number;
  confirmed: number;
  delivered: number;
  cancelled: number;
  aov: number;
}

export interface StatusBreakdownItem {
  status: string;
  label: string;
  count: number;
  revenue: number;
  sharePct: number;
  color: string;
}

export interface PaymentBreakdownItem {
  method: string;
  label: string;
  orders: number;
  total: number;
  paidAmount: number;
  unpaidAmount: number;
  sharePct: number;
  color: string;
}

export interface SourceBreakdownItem {
  source: string;
  label: string;
  orders: number;
  revenue: number;
  sharePct: number;
  color: string;
}

export interface DistrictBreakdownItem {
  district: string;
  orders: number;
  revenue: number;
  sharePct: number;
}

export interface TopProductItem {
  productId: string;
  sku: string;
  name: string;
  category: string;
  units: number;
  orders: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
}

export interface CourierBreakdownItem {
  courier: string;
  label: string;
  orders: number;
  delivered: number;
  returned: number;
  inTransit: number;
  revenue: number;
}

export interface DashboardKpis {
  totalSales: number;
  grossSales: number;
  totalOrders: number;
  validOrders: number;
  awaitingConfirmation: number;
  confirmationRate: number;
  deliveryRate: number;
  returnRate: number;
  aov: number;
  incompleteCount: number;
  customerCount: number;
  paidTotal: number;
  codReceivable: number;
  totalDiscounts: number;
  totalShipping: number;
  deltas: {
    salesPct: number | null;
    ordersPct: number | null;
    aovPct: number | null;
    confirmationRatePts: number | null;
  };
}

export interface DashboardAnalyticsResult {
  range: ResolvedDateRange;
  kpis: DashboardKpis;
  counts: Record<string, number>;
  timeSeries: TimeSeriesPoint[];
  statusBreakdown: StatusBreakdownItem[];
  paymentBreakdown: PaymentBreakdownItem[];
  bySource: SourceBreakdownItem[];
  byDistrict: DistrictBreakdownItem[];
  topProducts: TopProductItem[];
  courierBreakdown: CourierBreakdownItem[];
  filteredPendingIds: string[];
}

const INVALID_REVENUE_STATUSES = new Set(['cancelled', 'fake', 'failed_payment']);
const CONFIRMED_OR_LATER_STATUSES = new Set([
  'confirmed',
  'processing',
  'ready_to_ship',
  'shipped',
  'out_for_delivery',
  'delivered',
  'partially_delivered',
]);

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_META: Record<string, { label: string; color: string; order: number }> = {
  pending: { label: 'Pending', color: '#D97706', order: 1 },
  on_hold: { label: 'On Hold', color: '#F97316', order: 2 },
  confirmed: { label: 'Confirmed', color: '#0E5E6F', order: 3 },
  processing: { label: 'Processing', color: '#0891B2', order: 4 },
  ready_to_ship: { label: 'Ready to Ship', color: '#0284C7', order: 5 },
  shipped: { label: 'Shipped', color: 6, colorHex: '#2563EB' } as any,
  out_for_delivery: { label: 'Out for Delivery', color: '#4F46E5', order: 7 },
  delivered: { label: 'Delivered', color: '#1E9E6A', order: 8 },
  partially_delivered: { label: 'Partial Delivery', color: '#10B981', order: 9 },
  returned: { label: 'Returned', color: '#E11D48', order: 10 },
  cancelled: { label: 'Cancelled', color: '#DC2626', order: 11 },
  refunded: { label: 'Refunded', color: '#9F1239', order: 12 },
  fake: { label: 'Flagged / Fake', color: '#64748B', order: 13 },
  failed_payment: { label: 'Payment Failed', color: '#94A3B8', order: 14 },
};
// Ensure clean hex color on shipped
STATUS_META.shipped = { label: 'Shipped', color: '#2563EB', order: 6 };

const PAYMENT_META: Record<string, { label: string; color: string }> = {
  cod: { label: 'Cash on Delivery', color: '#0E5E6F' },
  bkash: { label: 'bKash', color: '#D12053' },
  nagad: { label: 'Nagad', color: '#EA580C' },
  sslcommerz: { label: 'SSLCommerz / Card', color: '#2563EB' },
  bank_transfer: { label: 'Bank Transfer', color: '#475569' },
};

const SOURCE_META: Record<string, { label: string; color: string }> = {
  facebook: { label: 'Facebook Ads', color: '#1877F2' },
  tiktok: { label: 'TikTok Ads', color: '#0F172A' },
  google: { label: 'Google Ads', color: '#0E5E6F' },
  direct: { label: 'Direct / Organic', color: '#1E9E6A' },
  instagram: { label: 'Instagram', color: '#DB2777' },
  youtube: { label: 'YouTube', color: '#DC2626' },
};

const COURIER_LABELS: Record<string, string> = {
  pathao: 'Pathao Courier',
  steadfast: 'Steadfast Courier',
  redx: 'REDX Delivery',
  paperfly: 'Paperfly',
  unassigned: 'Unassigned',
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(val: string | null | undefined): val is string {
  if (!val || !ISO_DATE_RE.test(val)) return false;
  const [y, m, d] = val.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function formatDateIsoUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addUtcDays(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return formatDateIsoUtc(dt);
}

export function diffDaysInclusive(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const start = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

export function formatShortDateLabel(isoDate: string): string {
  if (!isValidIsoDate(isoDate)) return isoDate;
  const [, m, d] = isoDate.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

export function formatFullDateLabel(isoDate: string): string {
  if (!isValidIsoDate(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

export function parseUtcTimestamp(raw: string | null | undefined): Date | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (ISO_DATE_RE.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  }
  // Handle SQLite CURRENT_TIMESTAMP "YYYY-MM-DD HH:MM:SS"
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(trimmed)
    ? `${trimmed.replace(' ', 'T')}Z`
    : trimmed;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isTimestampInRange(
  rawTimestamp: string | null | undefined,
  from: string | null,
  to: string | null,
): boolean {
  if (!from && !to) return true;
  const parsed = parseUtcTimestamp(rawTimestamp);
  if (!parsed) return false;
  const ms = parsed.getTime();
  if (from && isValidIsoDate(from)) {
    const [y, m, d] = from.split('-').map(Number);
    const startMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
    if (ms < startMs) return false;
  }
  if (to && isValidIsoDate(to)) {
    const [y, m, d] = to.split('-').map(Number);
    const endMs = Date.UTC(y, m - 1, d, 23, 59, 59, 999);
    if (ms > endMs) return false;
  }
  return true;
}

export function resolveDateRange(options: {
  preset?: string | null;
  from?: string | null;
  to?: string | null;
  granularity?: string | null;
  now?: Date;
} = {}): ResolvedDateRange {
  const now = options.now ?? new Date();
  const todayIso = formatDateIsoUtc(now);
  const rawPreset = (options.preset || '7d') as DateRangePreset;
  const requestedGranularity: ChartGranularity =
    options.granularity === 'hour' || options.granularity === 'day' ? options.granularity : 'auto';

  let preset: DateRangePreset = rawPreset;
  let from: string | null = null;
  let to: string | null = null;
  let label = '';

  const validFrom = isValidIsoDate(options.from) ? options.from : null;
  const validTo = isValidIsoDate(options.to) ? options.to : null;

  if (preset === 'custom' || (validFrom && validTo && !['today', 'yesterday', '7d', '30d', '90d', 'this_month', 'all'].includes(rawPreset))) {
    preset = 'custom';
    const a = validFrom || todayIso;
    const b = validTo || a;
    if (a <= b) {
      from = a;
      to = b;
    } else {
      from = b;
      to = a;
    }
    label = from === to ? formatFullDateLabel(from) : `${formatFullDateLabel(from)} – ${formatFullDateLabel(to)}`;
  } else {
    switch (preset) {
      case 'today':
        from = todayIso;
        to = todayIso;
        label = `Today (${formatFullDateLabel(todayIso)})`;
        break;
      case 'yesterday': {
        const yest = addUtcDays(todayIso, -1);
        from = yest;
        to = yest;
        label = `Yesterday (${formatFullDateLabel(yest)})`;
        break;
      }
      case '7d':
        from = addUtcDays(todayIso, -6);
        to = todayIso;
        label = 'Last 7 Days';
        break;
      case '30d':
        from = addUtcDays(todayIso, -29);
        to = todayIso;
        label = 'Last 30 Days';
        break;
      case '90d':
        from = addUtcDays(todayIso, -89);
        to = todayIso;
        label = 'Last 90 Days';
        break;
      case 'this_month':
        from = `${todayIso.slice(0, 7)}-01`;
        to = todayIso;
        label = `${MONTHS_SHORT[Number(todayIso.slice(5, 7)) - 1]} ${todayIso.slice(0, 4)} (MTD)`;
        break;
      case 'all':
        from = null;
        to = null;
        label = 'All Time';
        break;
      default:
        preset = '7d';
        from = addUtcDays(todayIso, -6);
        to = todayIso;
        label = 'Last 7 Days';
        break;
    }
  }

  let dayCount: number | null = null;
  let prevFrom: string | null = null;
  let prevTo: string | null = null;
  let comparisonLabel: string | null = null;

  if (from && to) {
    dayCount = diffDaysInclusive(from, to);
    prevTo = addUtcDays(from, -1);
    prevFrom = addUtcDays(prevTo, -(dayCount - 1));
    comparisonLabel =
      dayCount === 1
        ? `vs ${formatShortDateLabel(prevFrom)}`
        : `vs prior ${dayCount} days (${formatShortDateLabel(prevFrom)}–${formatShortDateLabel(prevTo)})`;
  }

  const effectiveGranularity: 'hour' | 'day' =
    requestedGranularity === 'hour' || (requestedGranularity === 'auto' && dayCount === 1)
      ? 'hour'
      : 'day';

  return {
    preset,
    from,
    to,
    prevFrom,
    prevTo,
    label,
    comparisonLabel,
    dayCount,
    granularity: effectiveGranularity,
  };
}

function calcDeltaPct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function extractSource(order: Record<string, any>): string {
  let attr: Record<string, any> = {};
  if (typeof order.attribution === 'string') {
    try {
      attr = JSON.parse(order.attribution || '{}');
    } catch {
      attr = {};
    }
  } else if (order.attribution && typeof order.attribution === 'object') {
    attr = order.attribution;
  }
  const raw = String(
    attr.utm_source ||
      (attr.click_ids?.fbclid ? 'facebook' : attr.click_ids?.ttclid ? 'tiktok' : attr.click_ids?.gclid ? 'google' : 'direct'),
  )
    .trim()
    .toLowerCase();
  return raw || 'direct';
}

export function computeDashboardAnalytics(params: {
  orders: Record<string, any>[];
  orderItems: Record<string, any>[];
  incompleteOrders: Record<string, any>[];
  customers: Record<string, any>[];
  resolvedRange: ResolvedDateRange;
}): DashboardAnalyticsResult {
  const { orders, orderItems, incompleteOrders, customers, resolvedRange } = params;
  const { from, to, prevFrom, prevTo, granularity } = resolvedRange;

  const currentOrders = orders.filter((o) => isTimestampInRange(o.created_at, from, to));
  const prevOrders = prevFrom && prevTo ? orders.filter((o) => isTimestampInRange(o.created_at, prevFrom, prevTo)) : [];

  const counts: Record<string, number> = { all: currentOrders.length };
  for (const o of currentOrders) {
    counts[o.status] = (counts[o.status] || 0) + 1;
  }

  const validCurrent = currentOrders.filter((o) => !INVALID_REVENUE_STATUSES.has(o.status));
  const validPrev = prevOrders.filter((o) => !INVALID_REVENUE_STATUSES.has(o.status));

  const totalSales = validCurrent.reduce((s, o) => s + Number(o.total || 0), 0);
  const grossSales = currentOrders.reduce((s, o) => s + Number(o.total || 0), 0);
  const prevSales = validPrev.reduce((s, o) => s + Number(o.total || 0), 0);

  const confirmedCurrent = currentOrders.filter((o) => CONFIRMED_OR_LATER_STATUSES.has(o.status)).length;
  const confirmedPrev = prevOrders.filter((o) => CONFIRMED_OR_LATER_STATUSES.has(o.status)).length;

  const deliveredCount = counts.delivered || 0;
  const returnedCount = counts.returned || 0;

  const confirmationRate = currentOrders.length ? Math.round((confirmedCurrent / currentOrders.length) * 100) : 0;
  const prevConfirmationRate = prevOrders.length ? Math.round((confirmedPrev / prevOrders.length) * 100) : 0;
  const deliveryRate =
    deliveredCount + returnedCount > 0 ? Math.round((deliveredCount / (deliveredCount + returnedCount)) * 100) : confirmedCurrent > 0 ? 100 : 0;

  const aov = validCurrent.length ? Math.round(totalSales / validCurrent.length) : 0;
  const prevAov = validPrev.length ? Math.round(prevSales / validPrev.length) : 0;

  const paidTotal = validCurrent.reduce((s, o) => {
    if (o.payment_status === 'paid') return s + Number(o.paid_amount || o.total || 0);
    return s + Number(o.paid_amount || 0);
  }, 0);
  const codReceivable = Math.max(0, totalSales - paidTotal);
  const totalDiscounts = validCurrent.reduce((s, o) => s + Number(o.discount || 0), 0);
  const totalShipping = validCurrent.reduce((s, o) => s + Number(o.shipping_fee || 0), 0);

  const incompleteCount = incompleteOrders.filter((inc) =>
    isTimestampInRange(inc.updated_at || inc.created_at, from, to),
  ).length;
  const customerCount = customers.filter((c) => isTimestampInRange(c.created_at, from, to)).length;

  // Time series generation
  const timeSeries: TimeSeriesPoint[] = [];
  if (granularity === 'hour') {
    const hourBuckets: TimeSeriesPoint[] = Array.from({ length: 24 }, (_, h) => {
      const hh = String(h).padStart(2, '0');
      return {
        key: hh,
        label: `${hh}:00 – ${hh}:59`,
        shortLabel: `${hh}:00`,
        orders: 0,
        validOrders: 0,
        sales: 0,
        grossSales: 0,
        confirmed: 0,
        delivered: 0,
        cancelled: 0,
        aov: 0,
      };
    });
    for (const o of currentOrders) {
      const dt = parseUtcTimestamp(o.created_at);
      if (!dt) continue;
      const b = hourBuckets[dt.getUTCHours()];
      const amt = Number(o.total || 0);
      b.orders++;
      b.grossSales += amt;
      if (!INVALID_REVENUE_STATUSES.has(o.status)) {
        b.validOrders++;
        b.sales += amt;
      } else {
        b.cancelled++;
      }
      if (CONFIRMED_OR_LATER_STATUSES.has(o.status)) b.confirmed++;
      if (o.status === 'delivered') b.delivered++;
    }
    for (const b of hourBuckets) {
      b.aov = b.validOrders > 0 ? Math.round(b.sales / b.validOrders) : 0;
    }
    timeSeries.push(...hourBuckets);
  } else {
    let startIso = from;
    let endIso = to;
    if (!startIso || !endIso) {
      const dates = currentOrders
        .map((o) => parseUtcTimestamp(o.created_at))
        .filter((d): d is Date => Boolean(d))
        .map(formatDateIsoUtc)
        .sort();
      if (dates.length > 0) {
        endIso = dates[dates.length - 1];
        const minSpanStart = addUtcDays(endIso, -6);
        startIso = dates[0] < minSpanStart ? dates[0] : minSpanStart;
      } else {
        const today = formatDateIsoUtc(new Date());
        startIso = addUtcDays(today, -6);
        endIso = today;
      }
    }

    const totalDays = diffDaysInclusive(startIso, endIso);
    const dayMap = new Map<string, TimeSeriesPoint>();
    // Prevent unbounded axis memory on extreme custom spans > 366 days by grouping or keeping up to 366 days
    const stepDays = totalDays > 120 ? Math.ceil(totalDays / 60) : 1;

    if (stepDays === 1) {
      for (let i = 0; i < totalDays; i++) {
        const iso = addUtcDays(startIso, i);
        dayMap.set(iso, {
          key: iso,
          label: formatFullDateLabel(iso),
          shortLabel: formatShortDateLabel(iso),
          orders: 0,
          validOrders: 0,
          sales: 0,
          grossSales: 0,
          confirmed: 0,
          delivered: 0,
          cancelled: 0,
          aov: 0,
        });
      }
      for (const o of currentOrders) {
        const dt = parseUtcTimestamp(o.created_at);
        if (!dt) continue;
        const iso = formatDateIsoUtc(dt);
        const b = dayMap.get(iso);
        if (!b) continue;
        const amt = Number(o.total || 0);
        b.orders++;
        b.grossSales += amt;
        if (!INVALID_REVENUE_STATUSES.has(o.status)) {
          b.validOrders++;
          b.sales += amt;
        } else {
          b.cancelled++;
        }
        if (CONFIRMED_OR_LATER_STATUSES.has(o.status)) b.confirmed++;
        if (o.status === 'delivered') b.delivered++;
      }
      for (const b of dayMap.values()) {
        b.aov = b.validOrders > 0 ? Math.round(b.sales / b.validOrders) : 0;
        timeSeries.push(b);
      }
    } else {
      // Multi-day bucketed fallback for very long ranges (> 120 days)
      const buckets: TimeSeriesPoint[] = [];
      for (let i = 0; i < totalDays; i += stepDays) {
        const bStart = addUtcDays(startIso, i);
        const bEndOffset = Math.min(totalDays - 1, i + stepDays - 1);
        const bEnd = addUtcDays(startIso, bEndOffset);
        buckets.push({
          key: `${bStart}_${bEnd}`,
          label: `${formatShortDateLabel(bStart)} – ${formatShortDateLabel(bEnd)}`,
          shortLabel: formatShortDateLabel(bStart),
          orders: 0,
          validOrders: 0,
          sales: 0,
          grossSales: 0,
          confirmed: 0,
          delivered: 0,
          cancelled: 0,
          aov: 0,
        });
      }
      const [sy, sm, sd] = startIso.split('-').map(Number);
      const startMs = Date.UTC(sy, sm - 1, sd);
      for (const o of currentOrders) {
        const dt = parseUtcTimestamp(o.created_at);
        if (!dt) continue;
        const dayIdx = Math.floor((dt.getTime() - startMs) / 86_400_000);
        const bucketIdx = Math.min(buckets.length - 1, Math.max(0, Math.floor(dayIdx / stepDays)));
        const b = buckets[bucketIdx];
        if (!b) continue;
        const amt = Number(o.total || 0);
        b.orders++;
        b.grossSales += amt;
        if (!INVALID_REVENUE_STATUSES.has(o.status)) {
          b.validOrders++;
          b.sales += amt;
        } else {
          b.cancelled++;
        }
        if (CONFIRMED_OR_LATER_STATUSES.has(o.status)) b.confirmed++;
        if (o.status === 'delivered') b.delivered++;
      }
      for (const b of buckets) {
        b.aov = b.validOrders > 0 ? Math.round(b.sales / b.validOrders) : 0;
        timeSeries.push(b);
      }
    }
  }

  // Status breakdown
  const statusAgg: Record<string, { count: number; revenue: number }> = {};
  for (const o of currentOrders) {
    if (!statusAgg[o.status]) statusAgg[o.status] = { count: 0, revenue: 0 };
    statusAgg[o.status].count++;
    statusAgg[o.status].revenue += Number(o.total || 0);
  }
  const statusBreakdown: StatusBreakdownItem[] = Object.entries(statusAgg)
    .map(([status, agg]) => {
      const meta = STATUS_META[status] || { label: status.replace(/_/g, ' '), color: '#64748B', order: 99 };
      return {
        status,
        label: meta.label,
        count: agg.count,
        revenue: agg.revenue,
        sharePct: currentOrders.length ? Math.round((agg.count / currentOrders.length) * 100) : 0,
        color: meta.color,
        _order: meta.order,
      };
    })
    .sort((a, b) => a._order - b._order)
    .map(({ _order, ...rest }) => rest);

  // Payment breakdown
  const payAgg: Record<string, { orders: number; total: number; paidAmount: number; unpaidAmount: number }> = {};
  for (const o of validCurrent) {
    const method = String(o.payment_method || 'cod').toLowerCase();
    if (!payAgg[method]) payAgg[method] = { orders: 0, total: 0, paidAmount: 0, unpaidAmount: 0 };
    const amt = Number(o.total || 0);
    const paid = o.payment_status === 'paid' ? Number(o.paid_amount || amt) : Number(o.paid_amount || 0);
    payAgg[method].orders++;
    payAgg[method].total += amt;
    payAgg[method].paidAmount += paid;
    payAgg[method].unpaidAmount += Math.max(0, amt - paid);
  }
  const paymentBreakdown: PaymentBreakdownItem[] = Object.entries(payAgg)
    .map(([method, agg]) => {
      const meta = PAYMENT_META[method] || { label: method.toUpperCase(), color: '#475569' };
      return {
        method,
        label: meta.label,
        orders: agg.orders,
        total: agg.total,
        paidAmount: agg.paidAmount,
        unpaidAmount: agg.unpaidAmount,
        sharePct: totalSales > 0 ? Math.round((agg.total / totalSales) * 100) : 0,
        color: meta.color,
      };
    })
    .sort((a, b) => b.total - a.total);

  // Source breakdown
  const srcAgg: Record<string, { orders: number; revenue: number }> = {};
  for (const o of validCurrent) {
    const src = extractSource(o);
    if (!srcAgg[src]) srcAgg[src] = { orders: 0, revenue: 0 };
    srcAgg[src].orders++;
    srcAgg[src].revenue += Number(o.total || 0);
  }
  const bySource: SourceBreakdownItem[] = Object.entries(srcAgg)
    .map(([source, agg]) => {
      const meta = SOURCE_META[source] || { label: source.charAt(0).toUpperCase() + source.slice(1), color: '#64748B' };
      return {
        source,
        label: meta.label,
        orders: agg.orders,
        revenue: agg.revenue,
        sharePct: totalSales > 0 ? Math.round((agg.revenue / totalSales) * 100) : 0,
        color: meta.color,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // District breakdown
  const distAgg: Record<string, { orders: number; revenue: number }> = {};
  for (const o of validCurrent) {
    const dist = o.district || 'Unknown';
    if (!distAgg[dist]) distAgg[dist] = { orders: 0, revenue: 0 };
    distAgg[dist].orders++;
    distAgg[dist].revenue += Number(o.total || 0);
  }
  const byDistrict: DistrictBreakdownItem[] = Object.entries(distAgg)
    .map(([district, agg]) => ({
      district,
      orders: agg.orders,
      revenue: agg.revenue,
      sharePct: validCurrent.length > 0 ? Math.round((agg.orders / validCurrent.length) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders)
    .slice(0, 8);

  // Top products in filtered valid orders
  const validOrderIds = new Set(validCurrent.map((o) => o.id));
  const prodAgg: Record<
    string,
    { productId: string; sku: string; name: string; category: string; units: number; orderIds: Set<string>; revenue: number; cost: number }
  > = {};
  for (const it of orderItems) {
    if (!validOrderIds.has(it.order_id)) continue;
    const key = it.product_id || it.sku || it.name;
    if (!prodAgg[key]) {
      prodAgg[key] = {
        productId: it.product_id || key,
        sku: it.sku || '',
        name: it.name || 'Product',
        category: it.category || 'General',
        units: 0,
        orderIds: new Set(),
        revenue: 0,
        cost: 0,
      };
    }
    const qty = Number(it.quantity || 1);
    prodAgg[key].units += qty;
    prodAgg[key].orderIds.add(it.order_id);
    prodAgg[key].revenue += Number(it.unit_price || 0) * qty;
    prodAgg[key].cost += Number(it.cost_price || 0) * qty;
  }
  const topProducts: TopProductItem[] = Object.values(prodAgg)
    .map((p) => {
      const profit = Math.max(0, p.revenue - p.cost);
      const marginPct = p.revenue > 0 ? Math.round((profit / p.revenue) * 100) : 0;
      return {
        productId: p.productId,
        sku: p.sku,
        name: p.name,
        category: p.category,
        units: p.units,
        orders: p.orderIds.size,
        revenue: p.revenue,
        cost: p.cost,
        profit,
        marginPct,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  // Courier breakdown
  const courierAgg: Record<string, { orders: number; delivered: number; returned: number; inTransit: number; revenue: number }> = {};
  for (const o of currentOrders) {
    const code = (o.courier_code || 'unassigned').toLowerCase();
    if (!courierAgg[code]) courierAgg[code] = { orders: 0, delivered: 0, returned: 0, inTransit: 0, revenue: 0 };
    courierAgg[code].orders++;
    courierAgg[code].revenue += Number(o.total || 0);
    if (o.status === 'delivered') courierAgg[code].delivered++;
    else if (o.status === 'returned') courierAgg[code].returned++;
    else if (['shipped', 'out_for_delivery', 'ready_to_ship'].includes(o.status)) courierAgg[code].inTransit++;
  }
  const courierBreakdown: CourierBreakdownItem[] = Object.entries(courierAgg)
    .map(([courier, agg]) => ({
      courier,
      label: COURIER_LABELS[courier] || courier.toUpperCase(),
      ...agg,
    }))
    .sort((a, b) => b.orders - a.orders);

  const filteredPendingIds = currentOrders.filter((o) => o.status === 'pending').map((o) => o.id);

  return {
    range: resolvedRange,
    kpis: {
      totalSales,
      grossSales,
      totalOrders: currentOrders.length,
      validOrders: validCurrent.length,
      awaitingConfirmation: counts.pending || 0,
      confirmationRate,
      deliveryRate,
      returnRate: deliveredCount + returnedCount > 0 ? 100 - deliveryRate : 0,
      aov,
      incompleteCount,
      customerCount,
      paidTotal,
      codReceivable,
      totalDiscounts,
      totalShipping,
      deltas: {
        salesPct: prevFrom ? calcDeltaPct(totalSales, prevSales) : null,
        ordersPct: prevFrom ? calcDeltaPct(currentOrders.length, prevOrders.length) : null,
        aovPct: prevFrom ? calcDeltaPct(aov, prevAov) : null,
        confirmationRatePts: prevFrom && prevOrders.length > 0 ? confirmationRate - prevConfirmationRate : null,
      },
    },
    counts,
    timeSeries,
    statusBreakdown,
    paymentBreakdown,
    bySource,
    byDistrict,
    topProducts,
    courierBreakdown,
    filteredPendingIds,
  };
}
