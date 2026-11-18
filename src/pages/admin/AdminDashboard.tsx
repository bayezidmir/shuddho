import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { formatBDT } from '../../lib/bd-validation';

export const AdminDashboard: React.FC<{ onNavigate: (sec: string) => void }> = ({ onNavigate }) => {
  const [data, setData] = useState<any | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const load = async () => {
    const r = await fetch('/api/admin/dashboard');
    if (r.ok) setData(await r.json());
  };

  useEffect(() => {
    load();
  }, []);

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

  if (!data) {
    return <div className="space-y-4"><div className="h-28 rounded-xl bg-white animate-pulse" /><div className="h-64 rounded-xl bg-white animate-pulse" /></div>;
  }

  const { kpis, pendingOrders, lowStockProducts, pendingReviews, failedWebhooks, bySource, byDistrict } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1D2327]">Store Overview</h1>
          <p className="text-xs text-[#646970]">Live operational metrics, confirmation queue, and attribution summary.</p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Sales', value: formatBDT(kpis.totalSales), sub: `${kpis.totalOrders} orders` },
          { label: 'Awaiting Confirmation', value: String(kpis.awaitingConfirmation), sub: 'Pending calls', highlight: kpis.awaitingConfirmation > 0 },
          { label: 'Confirmation Rate', value: `${kpis.confirmationRate}%`, sub: 'Confirmed / total' },
          { label: 'Delivery Success', value: `${kpis.deliveryRate}%`, sub: `Return rate ${kpis.returnRate}%` },
          { label: 'Avg Order Value', value: formatBDT(kpis.aov), sub: 'Gross AOV' },
          { label: 'Incomplete Carts', value: String(kpis.incompleteCount), sub: 'Ready to recover' },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-[#DCDCDE] p-4 space-y-1">
            <div className="text-xs font-medium text-[#646970]">{k.label}</div>
            <div className={`text-2xl font-extrabold tabular-nums ${k.highlight ? 'text-[#FF6B5B]' : 'text-[#1D2327]'}`}>
              {k.value}
            </div>
            <div className="text-[11px] text-[#646970]">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Action List: Pending Confirmation Orders (One-click Confirm!) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-[#DCDCDE] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#DCDCDE] flex items-center justify-between">
            <h2 className="font-bold text-sm">Orders Awaiting Confirmation ({pendingOrders.length})</h2>
            <button type="button" onClick={() => onNavigate('orders')} className="text-xs font-semibold text-[#0E5E6F] hover:underline inline-flex items-center gap-1">
              All Orders <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {pendingOrders.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#646970]">All pending orders have been confirmed!</div>
          ) : (
            <div className="divide-y divide-[#F0F0F1]">
              {pendingOrders.map((o: any) => (
                <div key={o.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm hover:bg-[#F6F7F7]">
                  <div className="min-w-0">
                    <div className="font-bold">
                      <button type="button" onClick={() => onNavigate(`order:${o.id}`)} className="text-[#0E5E6F] hover:underline">
                        #{o.order_number}
                      </button>{' '}
                      — {o.customer_name}
                    </div>
                    <div className="text-xs text-[#646970]">{o.customer_phone} · {o.district}</div>
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

        {/* Right: Sales by Source & Top Districts */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-xl border border-[#DCDCDE] p-4 space-y-3">
            <h2 className="font-bold text-sm">Sales by Attribution Source</h2>
            <div className="space-y-2">
              {bySource.map((s: any) => (
                <div key={s.source} className="flex items-center justify-between text-xs">
                  <span className="capitalize font-semibold">{s.source}</span>
                  <span className="tabular-nums text-[#646970]">{s.orders} orders · <strong className="text-[#1D2327]">{formatBDT(s.revenue)}</strong></span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#DCDCDE] p-4 space-y-3">
            <h2 className="font-bold text-sm">Top Districts</h2>
            <div className="space-y-2">
              {byDistrict.map((d: any) => (
                <div key={d.district} className="flex items-center justify-between text-xs">
                  <span className="font-semibold">{d.district}</span>
                  <span className="tabular-nums text-[#646970]">{d.orders} orders · <strong className="text-[#1D2327]">{formatBDT(d.revenue)}</strong></span>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts: Low Stock & Failed Webhooks */}
          {(lowStockProducts.length > 0 || failedWebhooks.length > 0 || pendingReviews.length > 0) && (
            <div className="bg-white rounded-xl border border-[#DCDCDE] p-4 space-y-2">
              <h2 className="font-bold text-sm flex items-center gap-1.5 text-[#A3271B]">
                <AlertTriangle className="w-4 h-4" /> Attention Needed
              </h2>
              {lowStockProducts.map((p: any) => (
                <div key={p.id} className="text-xs flex justify-between">
                  <span>Low stock: <strong>{p.name_en}</strong> ({p.sku})</span>
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
