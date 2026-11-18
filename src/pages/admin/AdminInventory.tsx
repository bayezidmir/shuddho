import React, { useEffect, useState } from 'react';
import { Boxes, PlusCircle, AlertTriangle } from 'lucide-react';
import { formatBDT } from '../../lib/bd-validation';

export const AdminInventory: React.FC = () => {
  const [data, setData] = useState<any | null>(null);
  const [tab, setTab] = useState<'stock' | 'batches' | 'movements' | 'pos'>('stock');
  const [adjustTarget, setAdjustTarget] = useState<{ productId: string; name: string } | null>(null);
  const [delta, setDelta] = useState(10);
  const [reason, setReason] = useState('restock_received');

  const load = async () => {
    const r = await fetch('/api/admin/inventory');
    if (r.ok) setData(await r.json());
  };

  useEffect(() => {
    load();
  }, []);

  const submitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    await fetch('/api/admin/inventory/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: adjustTarget.productId, delta, reason }),
    });
    setAdjustTarget(null);
    load();
  };

  if (!data) return <div className="h-64 bg-white rounded-xl animate-pulse" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#1D2327]">Inventory, Batches & Suppliers</h1>
        <div className="flex rounded-lg bg-white border border-[#DCDCDE] p-0.5 text-xs">
          {[
            { id: 'stock', label: 'Stock Levels' },
            { id: 'batches', label: `Batches / Expiry (${data.batches.length})` },
            { id: 'movements', label: 'Stock Movements' },
            { id: 'pos', label: `Suppliers & POs (${data.purchaseOrders.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as any)}
              className={`px-3 py-1.5 rounded-md font-semibold ${tab === t.id ? 'bg-[#0E5E6F] text-white' : 'text-[#646970]'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'stock' && (
        <div className="bg-white rounded-xl border border-[#DCDCDE] overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#F6F7F7] border-b border-[#DCDCDE] text-[#646970]">
              <tr>
                <th className="p-3">Product</th>
                <th className="p-3">SKU</th>
                <th className="p-3 text-right">On-Hand</th>
                <th className="p-3 text-right">Reserved</th>
                <th className="p-3 text-right">Available</th>
                <th className="p-3 text-right">Unit COGS</th>
                <th className="p-3 text-right">Adjust</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F1]">
              {data.products.map((p: any) => {
                const avail = Math.max(0, p.stock - p.reserved_stock);
                const low = avail <= p.low_stock_threshold;
                return (
                  <tr key={p.id} className="hover:bg-[#F9FAFB]">
                    <td className="p-3 font-bold flex items-center gap-2">
                      <Boxes className="w-4 h-4 text-[#0E5E6F]" />
                      <span>{p.name_en}</span>
                      {low && <AlertTriangle className="w-3.5 h-3.5 text-[#E5483A]" />}
                    </td>
                    <td className="p-3 font-mono">{p.sku}</td>
                    <td className="p-3 text-right tabular-nums font-semibold">{p.stock}</td>
                    <td className="p-3 text-right tabular-nums text-[#B45309]">{p.reserved_stock}</td>
                    <td className="p-3 text-right tabular-nums font-bold">{avail}</td>
                    <td className="p-3 text-right tabular-nums">{formatBDT(p.cost_price)}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => setAdjustTarget({ productId: p.id, name: p.name_en })}
                        className="px-2.5 py-1 rounded border border-[#DCDCDE] inline-flex items-center gap-1 hover:bg-[#F6F7F7] font-semibold"
                      >
                        <PlusCircle className="w-3.5 h-3.5 text-[#0E5E6F]" /> Adjust Stock
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'batches' && (
        <div className="bg-white rounded-xl border border-[#DCDCDE] overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F7F7] border-b">
              <tr><th className="p-3">Batch Code</th><th className="p-3">Product</th><th className="p-3">Harvest Date</th><th className="p-3">Expiry Date</th><th className="p-3 text-right">Qty</th></tr>
            </thead>
            <tbody className="divide-y">
              {data.batches.map((b: any) => (
                <tr key={b.id}><td className="p-3 font-mono font-bold">{b.batch_code}</td><td className="p-3">{b.product_name}</td><td className="p-3">{b.received_at?.slice(0, 10) || '2026-10-01'}</td><td className="p-3 text-[#B45309] font-semibold">{b.expiry_date}</td><td className="p-3 text-right tabular-nums font-bold">{b.quantity}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'movements' && (
        <div className="bg-white rounded-xl border border-[#DCDCDE] overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F7F7] border-b">
              <tr><th className="p-3">Date</th><th className="p-3">Product ID</th><th className="p-3">Delta</th><th className="p-3">Reason</th><th className="p-3">Staff</th></tr>
            </thead>
            <tbody className="divide-y">
              {data.movements.map((m: any) => (
                <tr key={m.id}>
                  <td className="p-3">{String(m.created_at).slice(0, 16)}</td>
                  <td className="p-3 font-mono">{m.product_id}</td>
                  <td className={`p-3 font-bold tabular-nums ${m.delta >= 0 ? 'text-[#1E9E6A]' : 'text-[#E5483A]'}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</td>
                  <td className="p-3 capitalize">{String(m.reason).replace(/_/g, ' ')} {m.reference_id ? `(#${m.reference_id})` : ''}</td>
                  <td className="p-3">{m.staff_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'pos' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-[#DCDCDE] p-4 space-y-2">
            <h2 className="font-bold text-sm">Harvest & Artisan Suppliers</h2>
            {data.suppliers.map((s: any) => (
              <div key={s.id} className="p-3 rounded-lg bg-[#F6F7F7] text-xs flex justify-between">
                <div><div className="font-bold">{s.name}</div><div className="text-[#646970]">{s.region}</div></div>
                <div className="font-mono text-[#0E5E6F]">{s.phone}</div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-[#DCDCDE] p-4 space-y-2">
            <h2 className="font-bold text-sm">Purchase Orders</h2>
            {data.purchaseOrders.map((po: any) => (
              <div key={po.id} className="p-3 rounded-lg bg-[#F6F7F7] text-xs flex justify-between">
                <div><div className="font-bold">{po.po_number} — {po.supplier_name}</div><div className="text-[#646970] capitalize">Status: {po.status}</div></div>
                <div className="font-bold tabular-nums">{formatBDT(po.total_cost)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAdjustTarget(null)}>
          <form onSubmit={submitAdjust} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-xl bg-white p-5 space-y-3 shadow-2xl text-xs">
            <h3 className="font-bold text-base">Adjust Stock — {adjustTarget.name}</h3>
            <div>
              <label className="block font-semibold mb-1">Delta Quantity (+ to add, - to deduct)</label>
              <input type="number" required value={delta} onChange={(e) => setDelta(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Reason</label>
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3 py-2 rounded-lg border">
                <option value="restock_received">Restock / Harvest Received</option>
                <option value="damaged_spoiled">Damaged / Spoiled</option>
                <option value="stocktake_correction">Stocktake Correction</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setAdjustTarget(null)} className="px-3 py-1.5 rounded-lg border">Cancel</button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-[#0E5E6F] text-white font-bold">Apply Adjustment</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
