import React, { useEffect, useState } from 'react';
import { Phone, MessageSquare, ArrowRightCircle, Trash2, Send, RefreshCw } from 'lucide-react';
import { formatBDT } from '../../lib/bd-validation';

export const AdminIncompleteOrders: React.FC<{ onConvertedOrder: (orderId: string) => void }> = ({
  onConvertedOrder,
}) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const load = async () => {
    setLoading(true);
    const r = await fetch('/api/admin/incomplete-orders');
    if (r.ok) {
      const d = await r.json();
      setRows(d.incompleteOrders || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const convertToOrder = async (id: string) => {
    setBusyId(id);
    const r = await fetch(`/api/admin/incomplete-orders/${id}/convert`, { method: 'POST' });
    setBusyId(null);
    if (r.ok) {
      const d = await r.json();
      onConvertedOrder(d.orderId);
    }
  };

  const sendRecoverySms = async (id: string) => {
    setBusyId(id);
    const r = await fetch(`/api/admin/incomplete-orders/${id}/sms`, { method: 'POST' });
    setBusyId(null);
    if (r.ok) {
      setToast('Recovery SMS dispatched with PURE10 checkout link.');
      load();
    }
  };

  const removeDraft = async (id: string) => {
    await fetch(`/api/admin/incomplete-orders/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1D2327]">Incomplete Orders (Abandoned Checkouts)</h1>
          <p className="text-xs text-[#646970]">
            Auto-captured as soon as a shopper enters a valid Bangladesh mobile number on checkout.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="px-3 py-1.5 rounded-lg bg-white border border-[#DCDCDE] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#F6F7F7]"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {toast && (
        <div className="p-3 rounded-xl bg-[#E6F7EF] border border-[#B6E8D1] text-[#1E9E6A] text-xs font-semibold flex justify-between">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast('')} className="underline">Dismiss</button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#DCDCDE] overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-[#F6F7F7] border-b border-[#DCDCDE] text-[#646970]">
            <tr>
              <th className="p-3">Customer</th>
              <th className="p-3">District / Address</th>
              <th className="p-3">Cart Items</th>
              <th className="p-3">Courier Fraud Check</th>
              <th className="p-3">Attribution</th>
              <th className="p-3 text-right">Subtotal</th>
              <th className="p-3 text-right">Recovery Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F1]">
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-[#646970]">Loading captured checkouts...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="p-10 text-center text-[#646970]">No abandoned checkouts currently waiting.</td></tr>
            ) : (
              rows.map((row) => {
                const f = row.fraud || { deliveredParcels: 0, totalParcels: 0, successRate: 100 };
                const attr = row.attributionObj || {};
                const src = attr.utm_source || (attr.click_ids?.fbclid ? 'facebook' : attr.click_ids?.gclid ? 'google' : 'direct');
                const waPhone = String(row.phone || '').replace(/^\+/, '');
                return (
                  <tr key={row.id} className="hover:bg-[#F9FAFB]">
                    <td className="p-3">
                      <div className="font-bold text-[#1D2327]">{row.name || 'Unnamed Shopper'}</div>
                      <div className="font-mono text-[#0E5E6F]">{row.phone}</div>
                      <div className="text-[11px] text-[#646970]">Updated {String(row.updated_at).slice(0, 16)}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold">{row.district} {row.area ? `· ${row.area}` : ''}</div>
                      <div className="text-[11px] text-[#646970] max-w-[200px] truncate">{row.address || 'Address not typed yet'}</div>
                    </td>
                    <td className="p-3">
                      {(row.items || []).map((it: any, idx: number) => (
                        <div key={idx} className="text-[11px]">
                          {it.name || it.name_en || 'Item'} × {it.quantity || 1}
                        </div>
                      ))}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${
                          f.successRate >= 80
                            ? 'bg-[#E6F7EF] text-[#1E9E6A]'
                            : f.successRate >= 50
                              ? 'bg-[#FFF4E5] text-[#B45309]'
                              : 'bg-[#FFE3DF] text-[#A3271B]'
                        }`}
                      >
                        {f.deliveredParcels} of {f.totalParcels} ({f.successRate}%)
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="capitalize font-medium">{src}</div>
                      {attr.click_ids?.fbc && <span className="font-mono text-[10px] text-[#0E5E6F]">fbc</span>}
                    </td>
                    <td className="p-3 text-right font-bold tabular-nums">{formatBDT(row.subtotal || 0)}</td>
                    <td className="p-3 text-right whitespace-nowrap space-x-1">
                      <a
                        href={`tel:${row.phone}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#DCDCDE] hover:bg-[#F6F7F7]"
                        title="Call Customer"
                      >
                        <Phone className="w-3 h-3" /> Call
                      </a>
                      <a
                        href={`https://wa.me/${waPhone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#DCDCDE] text-[#1E9E6A] hover:bg-[#E6F7EF]"
                        title="WhatsApp"
                      >
                        <MessageSquare className="w-3 h-3" /> WA
                      </a>
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => sendRecoverySms(row.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#DCDCDE] hover:bg-[#F6F7F7]"
                      >
                        <Send className="w-3 h-3" /> {row.recovery_sms_sent ? 'SMS Sent' : 'SMS'}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => convertToOrder(row.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0E5E6F] text-white font-bold hover:opacity-95"
                      >
                        <ArrowRightCircle className="w-3 h-3" /> Convert to Order
                      </button>
                      <button
                        type="button"
                        onClick={() => removeDraft(row.id)}
                        className="inline-flex items-center p-1 rounded text-[#A3271B] hover:bg-[#FFE3DF]"
                        aria-label="Delete draft"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
