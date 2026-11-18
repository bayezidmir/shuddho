import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Calendar,
  Download,
  TrendingUp,
  TrendingDown,
  RotateCcw,
} from 'lucide-react';
import { formatBDT } from '../../lib/bd-validation';
import type { DateRangePreset, DashboardAnalyticsResult } from '../../lib/dashboard-analytics';
import {
  RevenueTrendChart,
  OrderStatusDonutChart,
  AttributionBarChart,
  PaymentMixChart,
  DistrictBarChart,
  TopProductsCard,
  CourierPerformanceCard,
} from '../../components/admin/DashboardCharts';

interface DashboardApiResponse extends DashboardAnalyticsResult {
  pendingOrders: any[];
  globalPendingCount: number;
  lowStockProducts: any[];
  pendingReviews: any[];
  failedWebhooks: any[];
}

const PRESET_OPTIONS: Array<{ id: DateRangePreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: '90d', label: '90 Days' },
  { id: 'this_month', label: 'This Month' },
  { id: 'all', label: 'All Time' },
];

const DeltaReadout: React.FC<{ value: number | null; unit?: string; comparisonLabel: string | null }> = ({
  value,
  unit = '%',
  comparisonLabel,
}) => {
  if (value === null || !comparisonLabel) return null;
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums ${
        positive ? 'text-[#1E9E6A]' : 'text-[#E5483A]'
      }`}
    >
      <Icon className="w-3 h-3" />
      <span>
        {positive ? '+' : ''}
        {value}
        {unit}
      </span>
    </span>
  );
};

export const AdminDashboard: React.FC<{ onNavigate: (sec: string) => void }> = ({ onNavigate }) => {
  const [preset, setPreset] = useState<DateRangePreset>('7d');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [granularity, setGranularity] = useState<'auto' | 'hour' | 'day'>('auto');

  const [data, setData] = useState<DashboardApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: {
      nextPreset?: DateRangePreset;
      nextFrom?: string;
      nextTo?: string;
      nextGranularity?: 'auto' | 'hour' | 'day';
    }) => {
      const p = opts?.nextPreset ?? preset;
      const f = opts?.nextFrom ?? customFrom;
      const t = opts?.nextTo ?? customTo;
      const g = opts?.nextGranularity ?? granularity;

      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        params.set('preset', p);
        if (p === 'custom' && f && t) {
          params.set('from', f);
          params.set('to', t);
        }
        if (g !== 'auto') {
          params.set('granularity', g);
        }
        const r = await fetch(`/api/admin/dashboard?${params.toString()}`);
        if (!r.ok) {
          setError('Unable to load dashboard analytics.');
          setLoading(false);
          return;
        }
        const json = (await r.json()) as DashboardApiResponse;
        setData(json);
        if (json.range?.from && json.range?.to) {
          setCustomFrom(json.range.from);
          setCustomTo(json.range.to);
        } else if (p === 'all') {
          setCustomFrom('');
          setCustomTo('');
        }
      } catch {
        setError('Network error loading dashboard.');
      } finally {
        setLoading(false);
      }
    },
    [preset, customFrom, customTo, granularity],
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectPreset = (nextPreset: DateRangePreset) => {
    setPreset(nextPreset);
    setGranularity('auto');
    load({ nextPreset, nextGranularity: 'auto' });
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFrom || !customTo) return;
    setPreset('custom');
    setGranularity('auto');
    load({ nextPreset: 'custom', nextFrom: customFrom, nextTo: customTo, nextGranularity: 'auto' });
  };

  const handleGranularityChange = (g: 'hour' | 'day') => {
    setGranularity(g);
    load({ nextGranularity: g });
  };

  const quickConfirm = async (orderId: string) => {
    setConfirmingId(orderId);
    await fetch(`/api/admin/orders/${orderId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    });
    setConfirmingId(null);
    load();
  };

  const exportDashboardCsv = () => {
    if (!data) return;
    const lines = [
      `Shuddho Dashboard Export (${data.range.label})`,
      'Period,Orders,ValidOrders,ValidSalesBDT,GrossSalesBDT,Confirmed,Delivered,Cancelled,AOV_BDT',
      ...data.timeSeries.map(
        (pt) =>
          `"${pt.label}",${pt.orders},${pt.validOrders},${pt.sales},${pt.grossSales},${pt.confirmed},${pt.delivered},${pt.cancelled},${pt.aov}`,
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shuddho-dashboard-${data.range.preset}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!data && loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 rounded-xl bg-white border border-[#DCDCDE] animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-white border border-[#DCDCDE] animate-pulse" />
          ))}
        </div>
        <div className="h-80 rounded-xl bg-white border border-[#DCDCDE] animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-xl border border-[#DCDCDE] p-8 text-center space-y-3">
        <p className="text-sm font-semibold text-[#A3271B]">{error || 'Dashboard failed to load.'}</p>
        <button
          type="button"
          onClick={() => load()}
          className="px-4 py-2 rounded-lg bg-[#0E5E6F] text-white text-xs font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  const {
    range,
    kpis,
    timeSeries,
    statusBreakdown,
    paymentBreakdown,
    pendingOrders,
    globalPendingCount,
    lowStockProducts,
    pendingReviews,
    failedWebhooks,
    bySource,
    byDistrict,
    topProducts,
    courierBreakdown,
  } = data;

  return (
    <div className={`space-y-6 transition-opacity duration-150 ${loading ? 'opacity-70' : 'opacity-100'}`}>
      {/* Header + Comprehensive Date Filter Controls */}
      <div className="bg-white rounded-xl border border-[#DCDCDE] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1D2327]">Store Overview</h1>
            <p className="text-xs text-[#646970] tabular-nums">
              {range.label}
              {range.from && range.to ? ` · ${range.from} to ${range.to}` : ''}
              {range.comparisonLabel ? ` · Compared ${range.comparisonLabel}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportDashboardCsv}
              className="px-3 py-1.5 rounded-lg border border-[#DCDCDE] bg-white text-xs font-semibold text-[#1D2327] hover:bg-[#F6F7F7] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('7d')}
              className="px-3 py-1.5 rounded-lg border border-[#DCDCDE] bg-white text-xs font-semibold text-[#646970] hover:text-[#1D2327] hover:bg-[#F6F7F7] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Filter Bar: Presets + Custom Date Range Picker */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#F0F0F1]">
          <div
            className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#F0F2F4] border border-[#DCDCDE]"
            role="group"
            aria-label="Date range presets"
          >
            {PRESET_OPTIONS.map((opt) => {
              const active = preset === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectPreset(opt.id)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    active ? 'bg-white text-[#0E5E6F] font-bold shadow-xs' : 'text-[#646970] hover:text-[#1D2327]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleApplyCustom} className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 text-xs text-[#646970]">
              <Calendar className="w-3.5 h-3.5 text-[#0E5E6F]" />
              <label htmlFor="dash-date-from" className="font-medium">
                From
              </label>
              <input
                id="dash-date-from"
                aria-label="Start date"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-[#DCDCDE] bg-[#F8FAFC] text-xs font-medium text-[#1D2327] tabular-nums"
              />
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs text-[#646970]">
              <label htmlFor="dash-date-to" className="font-medium">
                To
              </label>
              <input
                id="dash-date-to"
                aria-label="End date"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-[#DCDCDE] bg-[#F8FAFC] text-xs font-medium text-[#1D2327] tabular-nums"
              />
            </div>
            <button
              type="submit"
              disabled={!customFrom || !customTo}
              className="px-3.5 py-1.5 rounded-lg bg-[#0E5E6F] text-white text-xs font-semibold hover:opacity-95 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              Apply Range
            </button>
          </form>
        </div>
      </div>

      {/* 6-Card KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3" data-testid="dashboard-kpis">
        {[
          {
            label: 'Valid Sales',
            value: formatBDT(kpis.totalSales),
            sub: `${kpis.validOrders} valid of ${kpis.totalOrders} orders`,
            delta: <DeltaReadout value={kpis.deltas.salesPct} comparisonLabel={range.comparisonLabel} />,
          },
          {
            label: 'Total Orders',
            value: String(kpis.totalOrders),
            sub: `${kpis.customerCount} new customers`,
            delta: <DeltaReadout value={kpis.deltas.ordersPct} comparisonLabel={range.comparisonLabel} />,
          },
          {
            label: 'Awaiting Confirmation',
            value: String(kpis.awaitingConfirmation),
            sub: globalPendingCount > kpis.awaitingConfirmation ? `${globalPendingCount} total live pending` : 'Pending calls',
            highlight: kpis.awaitingConfirmation > 0,
          },
          {
            label: 'Confirmation Rate',
            value: `${kpis.confirmationRate}%`,
            sub: 'Confirmed / total',
            delta: <DeltaReadout value={kpis.deltas.confirmationRatePts} unit="pp" comparisonLabel={range.comparisonLabel} />,
          },
          {
            label: 'Delivery Success',
            value: `${kpis.deliveryRate}%`,
            sub: `Return rate ${kpis.returnRate}%`,
          },
          {
            label: 'Avg Order Value',
            value: formatBDT(kpis.aov),
            sub: `${kpis.incompleteCount} incomplete carts`,
            delta: <DeltaReadout value={kpis.deltas.aovPct} comparisonLabel={range.comparisonLabel} />,
          },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-[#DCDCDE] p-4 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#646970]">{k.label}</span>
              {k.delta}
            </div>
            <div className={`text-2xl font-extrabold tabular-nums ${k.highlight ? 'text-[#FF6B5B]' : 'text-[#1D2327]'}`}>
              {k.value}
            </div>
            <div className="text-[11px] text-[#646970] tabular-nums">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Primary Graphical Analytics Row: Revenue/Order Trend + Order Status Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <RevenueTrendChart
            series={timeSeries}
            granularity={range.granularity}
            onGranularityChange={handleGranularityChange}
            rangeLabel={range.label}
            onResetFilter={() => handleSelectPreset('7d')}
          />
        </div>
        <div className="lg:col-span-4">
          <OrderStatusDonutChart
            breakdown={statusBreakdown}
            totalOrders={kpis.totalOrders}
            confirmationRate={kpis.confirmationRate}
            onNavigateOrders={() => onNavigate('orders')}
          />
        </div>
      </div>

      {/* Secondary Graphical Breakdown Row: Attribution, Payment Mix, Top Districts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <AttributionBarChart bySource={bySource} totalSales={kpis.totalSales} />
        </div>
        <div className="lg:col-span-4">
          <PaymentMixChart
            paymentBreakdown={paymentBreakdown}
            paidTotal={kpis.paidTotal}
            codReceivable={kpis.codReceivable}
          />
        </div>
        <div className="lg:col-span-4">
          <DistrictBarChart byDistrict={byDistrict} />
        </div>
      </div>

      {/* Bottom Operational Row: Queue & Couriers + Top Products & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          {/* Action List: Pending Confirmation Orders */}
          <div className="bg-white rounded-xl border border-[#DCDCDE] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#DCDCDE] flex items-center justify-between gap-2">
              <div>
                <h2 className="font-bold text-sm text-[#1D2327]">
                  Orders Awaiting Confirmation ({pendingOrders.length})
                </h2>
                {globalPendingCount > pendingOrders.length && (
                  <p className="text-[11px] text-[#646970]">
                    {globalPendingCount} pending orders exist across all dates
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onNavigate('orders')}
                className="text-xs font-semibold text-[#0E5E6F] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                All Orders <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {pendingOrders.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#646970] space-y-2">
                <p>No pending orders awaiting confirmation in this date range.</p>
                {globalPendingCount > 0 && (
                  <button
                    type="button"
                    onClick={() => onNavigate('orders')}
                    className="text-xs font-semibold text-[#0E5E6F] hover:underline"
                  >
                    View {globalPendingCount} live pending orders →
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[#F0F0F1]">
                {pendingOrders.map((o: any) => (
                  <div key={o.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm hover:bg-[#F6F7F7]">
                    <div className="min-w-0">
                      <div className="font-bold">
                        <button
                          type="button"
                          onClick={() => onNavigate(`order:${o.id}`)}
                          className="text-[#0E5E6F] hover:underline"
                        >
                          #{o.order_number}
                        </button>{' '}
                        — {o.customer_name}
                      </div>
                      <div className="text-xs text-[#646970]">
                        {o.customer_phone} · {o.district}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold tabular-nums">{formatBDT(o.total)}</span>
                      <button
                        type="button"
                        disabled={confirmingId === o.id}
                        onClick={() => quickConfirm(o.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#1E9E6A] text-white text-xs font-semibold inline-flex items-center gap-1 hover:opacity-95"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{confirmingId === o.id ? 'Confirming...' : 'Confirm'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <CourierPerformanceCard couriers={courierBreakdown} onNavigateCouriers={() => onNavigate('couriers')} />
        </div>

        <div className="lg:col-span-5 space-y-6">
          <TopProductsCard products={topProducts} onNavigateProducts={() => onNavigate('products')} />

          {/* Alerts: Low Stock & Failed Webhooks */}
          {(lowStockProducts.length > 0 || failedWebhooks.length > 0 || pendingReviews.length > 0) && (
            <div className="bg-white rounded-xl border border-[#DCDCDE] p-4 space-y-2">
              <h2 className="font-bold text-sm flex items-center gap-1.5 text-[#A3271B]">
                <AlertTriangle className="w-4 h-4" /> Attention Needed
              </h2>
              {lowStockProducts.map((p: any) => (
                <div key={p.id} className="text-xs flex justify-between">
                  <span>
                    Low stock: <strong>{p.name_en}</strong> ({p.sku})
                  </span>
                  <span className="text-[#E5483A] font-bold tabular-nums">{p.stock} left</span>
                </div>
              ))}
              {pendingReviews.length > 0 && (
                <div className="text-xs text-[#646970]">{pendingReviews.length} customer reviews awaiting moderation.</div>
              )}
              {failedWebhooks.length > 0 && (
                <div className="text-xs text-[#E5483A]">{failedWebhooks.length} failed conversion webhook deliveries.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
