import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Truck,
  Printer,
  Send,
  PhoneCall,
  RefreshCw,
  Ban,
  Eye,
} from 'lucide-react';
import { formatBDT } from '../../lib/bd-validation';
import { statusColor } from './AdminOrders';

export const AdminOrderEdit: React.FC<{ orderId: string; onBack: () => void }> = ({ orderId, onBack }) => {
  const [order, setOrder] = useState<any | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState<'private' | 'customer'>('private');
  const [callOutcome, setCallOutcome] = useState('answered');
  const [callNote, setCallNote] = useState('');
  const [courierCode, setCourierCode] = useState('steadfast');
  const [payloadModal, setPayloadModal] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const r = await fetch(`/api/admin/orders/${orderId}`);
    if (r.ok) {
      const d = await r.json();
      setOrder(d.order);
    }
  };

  useEffect(() => {
    load();
  }, [orderId]);

  if (!order) {
    return <div className="h-96 bg-white rounded-xl animate-pulse" />;
  }

  const changeStatus = async (status: string, reason = '') => {
    setBusy(true);
    await fetch(`/api/admin/orders/${order.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reason }),
    });
    setBusy(false);
    load();
  };

  const bookCourier = async () => {
    setBusy(true);
    await fetch('/api/admin/couriers/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id, courierCode }),
    });
    setBusy(false);
    load();
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    await fetch(`/api/admin/orders/${order.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: noteType, content: noteText }),
    });
    setNoteText('');
    load();
  };

  const logCall = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`/api/admin/orders/${order.id}/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome: callOutcome, note: callNote, autoHold: callOutcome === 'no_answer' }),
    });
    setCallNote('');
    load();
  };

  const resendConversion = async () => {
    setBusy(true);
    await fetch(`/api/admin/orders/${order.id}/resend-conversion`, { method: 'POST' });
    setBusy(false);
    load();
  };

  const saveCustomerEdits = async () => {
    await fetch(`/api/admin/orders/${order.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        district: order.district,
        address: order.address,
        shipping_fee: order.shipping_fee,
        discount: order.discount,
      }),
    });
    load();
  };

  const attr = order.attributionObj || {};
  const clickIds = attr.click_ids || {};
  const fraud = order.fraud;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="p-2 rounded-lg bg-white border border-[#DCDCDE] hover:bg-[#F6F7F7]">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Order #{order.order_number}</h1>
              <span className={`px-2.5 py-0.5 rounded-full border text-xs font-semibold capitalize ${statusColor(order.status)}`}>
                {String(order.status).replace(/_/g, ' ')}
              </span>
            </div>
            <div className="text-xs text-[#646970]">Placed {order.created_at} · Invoice {order.invoice_number || 'Pending'}</div>
          </div>
        </div>
        <button type="button" onClick={() => window.print()} className="px-3.5 py-2 rounded-lg bg-white border border-[#DCDCDE] text-xs font-semibold inline-flex items-center gap-1.5">
          <Printer className="w-3.5 h-3.5" /> Print Invoice
        </button>
      </div>

      {/* Main 2-Column WooCommerce Edit Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Left Column */}
        <div className="lg:col-span-8 space-y-5">
          {/* Customer & Shipping Details Box */}
          <div className="bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm">Customer & Shipping Details</h2>
              <button type="button" onClick={saveCustomerEdits} className="px-3 py-1 rounded-lg bg-[#0E5E6F] text-white text-xs font-semibold">
                Save Changes
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[#646970] mb-1">Full Name</label>
                <input type="text" value={order.customer_name} onChange={(e) => setOrder({ ...order, customer_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[#DCDCDE]" />
              </div>
              <div>
                <label className="block text-[#646970] mb-1">Phone</label>
                <input type="text" value={order.customer_phone} onChange={(e) => setOrder({ ...order, customer_phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[#DCDCDE] font-mono" />
              </div>
              <div>
                <label className="block text-[#646970] mb-1">District</label>
                <input type="text" value={order.district} onChange={(e) => setOrder({ ...order, district: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[#DCDCDE]" />
              </div>
            </div>
            <div className="text-xs">
              <label className="block text-[#646970] mb-1">Full Address</label>
              <input type="text" value={order.address} onChange={(e) => setOrder({ ...order, address: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[#DCDCDE]" />
            </div>
          </div>

          {/* Order Items & Totals */}
          <div className="bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-4">
            <h2 className="font-bold text-sm">Order Items</h2>
            <table className="w-full text-xs">
              <thead className="border-b text-[#646970]">
                <tr><th className="py-2 text-left">Product</th><th className="py-2 text-right">Price</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Total</th></tr>
              </thead>
              <tbody className="divide-y">
                {order.items.map((it: any) => (
                  <tr key={it.id}>
                    <td className="py-2.5">
                      <div className="font-semibold">{it.name}</div>
                      <div className="text-[11px] text-[#646970]">SKU: {it.sku} · {it.variant_label}</div>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{formatBDT(it.unit_price)}</td>
                    <td className="py-2.5 text-right tabular-nums">{it.quantity}</td>
                    <td className="py-2.5 text-right font-bold tabular-nums">{formatBDT(it.unit_price * it.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t pt-3 space-y-1 text-xs max-w-xs ml-auto">
              <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums font-semibold">{formatBDT(order.subtotal)}</span></div>
              <div className="flex justify-between"><span>Discount</span><span className="tabular-nums text-[#1E9E6A]">−{formatBDT(order.discount)}</span></div>
              <div className="flex justify-between"><span>Shipping</span><span className="tabular-nums">{formatBDT(order.shipping_fee)}</span></div>
              <div className="flex justify-between text-base font-extrabold border-t pt-2"><span>Total</span><span className="tabular-nums">{formatBDT(order.total)}</span></div>
            </div>
          </div>

          {/* Marketing Attribution & Click IDs Box */}
          <div className="bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-3">
            <h2 className="font-bold text-sm">Marketing Attribution & Click IDs</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded bg-[#F6F7F7]"><span className="text-[#646970]">utm_source:</span> <strong>{attr.utm_source || '—'}</strong></div>
              <div className="p-2 rounded bg-[#F6F7F7]"><span className="text-[#646970]">utm_campaign:</span> <strong>{attr.utm_campaign || '—'}</strong></div>
              <div className="p-2 rounded bg-[#F6F7F7]"><span className="text-[#646970]">IP:</span> <strong className="font-mono">{order.client_ip || '103.112.55.21'}</strong></div>
              {Object.entries(clickIds).filter(([, v]) => Boolean(v)).map(([k, v]) => (
                <div key={k} className="p-2 rounded bg-[#EEF5F5] border border-[#D3E3E5] col-span-2 sm:col-span-3 flex justify-between gap-2">
                  <span className="font-mono font-bold text-[#0E5E6F]">{k}</span>
                  <span className="font-mono truncate">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Conversion Webhook Deliveries */}
          <div className="bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm">Conversion Webhook Deliveries</h2>
              <button type="button" onClick={resendConversion} disabled={busy} className="px-3 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 hover:bg-[#F6F7F7]">
                <RefreshCw className="w-3.5 h-3.5" /> Resend Purchase Event
              </button>
            </div>
            {order.deliveries.length === 0 ? (
              <p className="text-xs text-[#646970]">No conversion webhooks dispatched yet (fires when order is Confirmed).</p>
            ) : (
              <div className="divide-y text-xs">
                {order.deliveries.map((d: any) => (
                  <div key={d.id} className="py-2 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-bold">{d.event_name}</span> · <span className="font-mono text-[#646970]">{d.event_id}</span>
                      <div className="text-[11px] text-[#646970]">{d.endpoint_url} · HTTP {d.http_status || 'Err'} · {d.duration_ms}ms</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${d.status === 'delivered' ? 'bg-[#E6F7EF] text-[#1E9E6A]' : 'bg-[#FFE3DF] text-[#A3271B]'}`}>
                        {d.status}
                      </span>
                      <button type="button" onClick={() => setPayloadModal(d)} className="px-2 py-1 rounded border text-[11px] inline-flex items-center gap-1">
                        <Eye className="w-3 h-3" /> Payload
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Call Log & Order Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-[#DCDCDE] p-4 space-y-3">
              <h2 className="font-bold text-sm flex items-center gap-1.5"><PhoneCall className="w-4 h-4 text-[#0E5E6F]" /> Call Log</h2>
              <form onSubmit={logCall} className="space-y-2 text-xs">
                <select value={callOutcome} onChange={(e) => setCallOutcome(e.target.value)} className="w-full px-2.5 py-1.5 rounded border">
                  <option value="answered">Answered — Confirmed</option>
                  <option value="no_answer">No Answer (Auto Hold)</option>
                  <option value="switched_off">Switched Off</option>
                  <option value="wrong_number">Wrong Number</option>
                </select>
                <div className="flex gap-2">
                  <input type="text" value={callNote} onChange={(e) => setCallNote(e.target.value)} placeholder="Call remarks..." className="flex-1 px-2.5 py-1.5 rounded border" />
                  <button type="submit" className="px-3 py-1.5 rounded bg-[#0E5E6F] text-white font-semibold">Log</button>
                </div>
              </form>
              <div className="space-y-1.5 max-h-40 overflow-y-auto text-xs">
                {order.callLogs.map((c: any) => (
                  <div key={c.id} className="p-2 rounded bg-[#F6F7F7]">
                    <div className="font-semibold capitalize">{c.outcome.replace(/_/g, ' ')} — {c.staff_name}</div>
                    {c.note && <div className="text-[#646970]">{c.note}</div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#DCDCDE] p-4 space-y-3">
              <h2 className="font-bold text-sm">Order Notes</h2>
              <form onSubmit={addNote} className="space-y-2 text-xs">
                <select value={noteType} onChange={(e) => setNoteType(e.target.value as any)} className="w-full px-2.5 py-1.5 rounded border">
                  <option value="private">Private Staff Note</option>
                  <option value="customer">Note to Customer (Sends SMS)</option>
                </select>
                <div className="flex gap-2">
                  <input type="text" value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Write note..." className="flex-1 px-2.5 py-1.5 rounded border" />
                  <button type="submit" className="px-3 py-1.5 rounded bg-[#0E5E6F] text-white font-semibold"><Send className="w-3.5 h-3.5" /></button>
                </div>
              </form>
              <div className="space-y-1.5 max-h-40 overflow-y-auto text-xs">
                {order.notes.map((n: any) => (
                  <div key={n.id} className={`p-2 rounded ${n.type === 'system' ? 'bg-gray-50 text-[#646970]' : 'bg-[#EEF5F5]'}`}>
                    <div className="font-semibold">{n.staff_name} ({n.type})</div>
                    <div>{n.content}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Side Boxes Column (WooCommerce style) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Order Actions Side Box */}
          <div className="bg-white rounded-xl border border-[#DCDCDE] p-4 space-y-3">
            <h2 className="font-bold text-sm">Order Actions</h2>
            {order.status !== 'confirmed' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => changeStatus('confirmed')}
                className="w-full py-2.5 px-4 rounded-lg bg-[#1E9E6A] text-white text-sm font-bold flex items-center justify-center gap-2 hover:opacity-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Order & Fire Purchase</span>
              </button>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button type="button" onClick={() => changeStatus('on_hold')} className="py-2 rounded-lg border font-semibold hover:bg-[#F6F7F7]">Put On Hold</button>
              <button type="button" onClick={() => changeStatus('processing')} className="py-2 rounded-lg border font-semibold hover:bg-[#F6F7F7]">Mark Packing</button>
              <button type="button" onClick={() => changeStatus('delivered')} className="py-2 rounded-lg border font-semibold text-[#1E9E6A] hover:bg-[#E6F7EF]">Mark Delivered</button>
              <button type="button" onClick={() => changeStatus('cancelled', 'Cancelled by staff')} className="py-2 rounded-lg border font-semibold text-[#E5483A] hover:bg-[#FFE3DF]">Cancel Order</button>
            </div>
            <button
              type="button"
              onClick={() => changeStatus('fake', 'Marked fake/spam')}
              className="w-full py-2 rounded-lg border border-[#F8B4AC] text-[#A3271B] text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#FFE3DF]"
            >
              <Ban className="w-3.5 h-3.5" /> Mark Fake & Block Phone
            </button>
          </div>

          {/* Courier Side Box */}
          <div className="bg-white rounded-xl border border-[#DCDCDE] p-4 space-y-3">
            <h2 className="font-bold text-sm flex items-center gap-1.5"><Truck className="w-4 h-4 text-[#0E5E6F]" /> Courier Dispatch</h2>
            {order.tracking_code ? (
              <div className="p-3 rounded-lg bg-[#EEF5F5] border border-[#D3E3E5] text-xs space-y-1">
                <div>Courier: <strong className="uppercase">{order.courier_code}</strong></div>
                <div>Consignment: <strong className="font-mono">{order.consignment_id}</strong></div>
                <div>Tracking ID: <strong className="font-mono text-[#0E5E6F]">{order.tracking_code}</strong></div>
                <div>Live Status: <strong>{order.courier_status}</strong></div>
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                <select value={courierCode} onChange={(e) => setCourierCode(e.target.value)} className="w-full px-3 py-2 rounded-lg border">
                  <option value="steadfast">Steadfast Courier</option>
                  <option value="pathao">Pathao Courier</option>
                  <option value="redx">RedX Logistics</option>
                  <option value="paperfly">Paperfly</option>
                  <option value="ecourier">eCourier</option>
                  <option value="manual">Manual Courier</option>
                </select>
                <button
                  type="button"
                  disabled={busy}
                  onClick={bookCourier}
                  className="w-full py-2.5 rounded-lg bg-[#0E5E6F] text-white font-bold flex items-center justify-center gap-1.5"
                >
                  <Truck className="w-4 h-4" /> Send to Courier (1-Click)
                </button>
              </div>
            )}
          </div>

          {/* Courier Delivery History (Fraud Check) */}
          <div className="bg-white rounded-xl border border-[#DCDCDE] p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm">Courier Fraud Check</h2>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${
                  fraud.successRate >= 80
                    ? 'bg-[#E6F7EF] text-[#1E9E6A]'
                    : fraud.successRate >= 50
                      ? 'bg-[#FFF4E5] text-[#B45309]'
                      : 'bg-[#FFE3DF] text-[#A3271B]'
                }`}
              >
                {fraud.deliveredParcels} of {fraud.totalParcels} ({fraud.successRate}%)
              </span>
            </div>
            <div className="space-y-1 text-xs">
              {fraud.sourceBreakdown.map((b: any) => (
                <div key={b.courier} className="flex justify-between text-[#646970]">
                  <span>{b.courier}</span>
                  <span className="tabular-nums">{b.delivered}/{b.total} delivered</span>
                </div>
              ))}
            </div>
          </div>

          {/* Customer Previous History */}
          <div className="bg-white rounded-xl border border-[#DCDCDE] p-4 space-y-2">
            <h2 className="font-bold text-sm">Customer History ({order.customerHistory.length} prior)</h2>
            {order.customerHistory.length === 0 ? (
              <p className="text-xs text-[#646970]">First-time customer.</p>
            ) : (
              <div className="space-y-1 text-xs">
                {order.customerHistory.map((h: any) => (
                  <div key={h.id} className="flex justify-between py-1 border-b last:border-0">
                    <span>#{h.order_number} ({h.status})</span>
                    <span className="font-semibold tabular-nums">{formatBDT(h.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Webhook Payload Viewer Modal */}
      {payloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPayloadModal(null)}>
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 space-y-3 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm">Webhook Payload — {payloadModal.event_id}</h3>
              <button type="button" onClick={() => setPayloadModal(null)} className="text-xs font-semibold">Close</button>
            </div>
            <pre className="p-3 rounded-lg bg-[#1D2327] text-emerald-300 text-[11px] font-mono overflow-x-auto">{payloadModal.payload}</pre>
            <div className="text-xs font-semibold">Response ({payloadModal.http_status}):</div>
            <pre className="p-3 rounded-lg bg-gray-100 text-[11px] font-mono overflow-x-auto">{payloadModal.response_body || 'No response body'}</pre>
          </div>
        </div>
      )}
    </div>
  );
};
