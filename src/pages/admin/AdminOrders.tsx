import React, { useEffect, useState } from 'react';
import {
  Search,
  Truck,
  CheckCircle2,
  Printer,
  Plus,
  Headphones,
  Download,
  Phone,
} from 'lucide-react';
import { formatBDT } from '../../lib/bd-validation';

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'on_hold', label: 'On Hold' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'processing', label: 'Processing' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'returned', label: 'Returned' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'fake', label: 'Fake' },
];

export function statusColor(status: string): string {
  switch (status) {
    case 'confirmed':
    case 'delivered':
      return 'bg-[#E6F7EF] text-[#1E9E6A] border-[#B6E8D1]';
    case 'pending':
    case 'on_hold':
      return 'bg-[#FFF4E5] text-[#B45309] border-[#FDE68A]';
    case 'shipped':
    case 'out_for_delivery':
    case 'processing':
      return 'bg-[#E6F4F7] text-[#0E5E6F] border-[#BBDDE4]';
    case 'cancelled':
    case 'returned':
    case 'fake':
      return 'bg-[#FFE3DF] text-[#A3271B] border-[#F8B4AC]';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

export const AdminOrders: React.FC<{
  onEditOrder: (id: string) => void;
  initialNewModal?: boolean;
}> = ({ onEditOrder, initialNewModal = false }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState('');
  const [agentMode, setAgentMode] = useState(false);

  // Send to Courier Modal
  const [courierModalOrderIds, setCourierModalOrderIds] = useState<string[] | null>(null);
  const [courierChoice, setCourierChoice] = useState('steadfast');
  const [courierNote, setCourierNote] = useState('Handle fragile glass jars with care.');
  const [bookingBusy, setBookingBusy] = useState(false);

  // Print Invoices / Labels view
  const [printOrders, setPrintOrders] = useState<{ mode: 'invoice' | 'label'; list: any[] } | null>(null);

  // Manual Order Modal
  const [newOrderOpen, setNewOrderOpen] = useState(initialNewModal);
  const [products, setProducts] = useState<any[]>([]);
  const [manualForm, setManualForm] = useState({
    customerName: '',
    customerPhone: '',
    district: 'Dhaka',
    address: '',
    productId: '',
    qty: 1,
    shippingFee: 70,
  });

  const loadOrders = async () => {
    const r = await fetch(`/api/admin/orders?status=${statusFilter}&q=${encodeURIComponent(search)}`);
    if (r.ok) {
      const d = await r.json();
      setOrders(d.orders);
      setCounts(d.counts);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  useEffect(() => {
    if (newOrderOpen && products.length === 0) {
      fetch('/api/store/bootstrap')
        .then((r) => r.json())
        .then((d) => {
          setProducts(d.products || []);
          if (d.products?.[0]) setManualForm((f) => ({ ...f, productId: d.products[0].id }));
        });
    }
  }, [newOrderOpen]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const quickStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/orders/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    loadOrders();
  };

  const handleBulkApply = async () => {
    if (selectedIds.length === 0 || !bulkAction) return;
    if (bulkAction === 'courier') {
      setCourierModalOrderIds(selectedIds);
      return;
    }
    if (bulkAction === 'print_invoice' || bulkAction === 'print_label') {
      const list = orders.filter((o) => selectedIds.includes(o.id));
      setPrintOrders({ mode: bulkAction === 'print_invoice' ? 'invoice' : 'label', list });
      setTimeout(() => window.print(), 250);
      return;
    }
    if (bulkAction === 'export_csv') {
      const list = orders.filter((o) => selectedIds.includes(o.id));
      const csv = [
        'Order#,Date,Customer,Phone,District,Total,Status,Courier,Tracking',
        ...list.map((o) => `"${o.order_number}","${o.created_at}","${o.customer_name}","${o.customer_phone}","${o.district}",${o.total},"${o.status}","${o.courier_code}","${o.tracking_code}"`),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shuddho-orders-${Date.now()}.csv`;
      a.click();
      return;
    }
    await fetch('/api/admin/orders/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedIds, action: 'status', value: bulkAction }),
    });
    setSelectedIds([]);
    loadOrders();
  };

  const submitCourierBooking = async () => {
    if (!courierModalOrderIds) return;
    setBookingBusy(true);
    await fetch('/api/admin/couriers/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderIds: courierModalOrderIds,
        courierCode: courierChoice,
        note: courierNote,
      }),
    });
    setBookingBusy(false);
    setCourierModalOrderIds(null);
    setSelectedIds([]);
    loadOrders();
  };

  const createManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find((p) => p.id === manualForm.productId);
    if (!prod) return;
    const r = await fetch('/api/admin/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: manualForm.customerName,
        customerPhone: manualForm.customerPhone,
        district: manualForm.district,
        address: manualForm.address,
        shippingFee: manualForm.shippingFee,
        items: [{ productId: prod.id, sku: prod.sku, name: prod.name_en, unitPrice: prod.price, quantity: manualForm.qty }],
      }),
    });
    if (r.ok) {
      setNewOrderOpen(false);
      loadOrders();
    }
  };

  // Call-Centre Agent Mode (one pending order at a time)
  const pendingQueue = orders.filter((o) => o.status === 'pending' || o.status === 'on_hold');
  const currentAgentOrder = pendingQueue[0];

  if (printOrders) {
    return (
      <div className="space-y-6">
        <div className="no-print flex items-center justify-between bg-white p-4 rounded-xl border border-[#DCDCDE]">
          <span className="font-bold text-sm">Bulk Print Preview ({printOrders.list.length} {printOrders.mode}s)</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => window.print()} className="px-4 py-1.5 rounded-lg bg-[#0E5E6F] text-white text-xs font-bold">Print Now</button>
            <button type="button" onClick={() => setPrintOrders(null)} className="px-4 py-1.5 rounded-lg border text-xs font-semibold">Back to Orders</button>
          </div>
        </div>
        {printOrders.list.map((o) => (
          <div key={o.id} className={`bg-white border p-6 print-page-break ${printOrders.mode === 'label' ? 'max-w-[400px] mx-auto' : 'max-w-3xl mx-auto'}`}>
            <div className="flex justify-between items-start border-b pb-3 mb-3">
              <div>
                <div className="text-lg font-extrabold">SHUDDHO</div>
                <div className="text-xs text-gray-600">Banani, Dhaka · +8809612-004455</div>
              </div>
              <div className="text-right">
                <div className="font-bold">{printOrders.mode === 'label' ? 'SHIPPING LABEL' : `INVOICE #${o.invoice_number || o.order_number}`}</div>
                <div className="text-xs font-mono">Order #{o.order_number}</div>
              </div>
            </div>
            <div className="text-sm space-y-1 mb-4">
              <div><strong>To:</strong> {o.customer_name} ({o.customer_phone})</div>
              <div><strong>Address:</strong> {o.address}, {o.area}, {o.district}</div>
              {o.tracking_code && <div><strong>Courier:</strong> {o.courier_code?.toUpperCase()} — <span className="font-mono">{o.tracking_code}</span></div>}
            </div>
            <table className="w-full text-xs border-t border-b py-2 mb-3">
              <thead><tr className="text-left border-b"><th className="py-1">Item</th><th className="py-1 text-right">Qty</th><th className="py-1 text-right">Amount</th></tr></thead>
              <tbody>
                {(o.items || []).map((it: any) => (
                  <tr key={it.id}><td className="py-1">{it.name} ({it.variant_label})</td><td className="py-1 text-right">{it.quantity}</td><td className="py-1 text-right">{formatBDT(it.unit_price * it.quantity)}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between font-bold text-base">
              <span>{o.payment_status === 'paid' ? 'PAID' : 'COD AMOUNT DUE'}:</span>
              <span>{o.payment_status === 'paid' ? '৳0' : formatBDT(o.total)}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#1D2327]">Orders</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAgentMode(!agentMode)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold border inline-flex items-center gap-1.5 ${
              agentMode ? 'bg-[#0E5E6F] text-white border-[#0E5E6F]' : 'bg-white border-[#DCDCDE] hover:bg-[#F6F7F7]'
            }`}
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>{agentMode ? 'Exit Agent Mode' : 'Call-Centre Agent Mode'}</span>
          </button>
          <button
            type="button"
            onClick={() => setNewOrderOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-[#0E5E6F] text-white text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Create Manual Order
          </button>
        </div>
      </div>

      {/* Call-Centre Agent Mode Card */}
      {agentMode && (
        <div className="bg-white rounded-xl border-2 border-[#0E5E6F] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base text-[#0E5E6F]">Call-Centre Queue ({pendingQueue.length} waiting)</h2>
          </div>
          {!currentAgentOrder ? (
            <p className="text-sm text-[#646970]">No pending or on-hold orders left in the call queue!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <div className="md:col-span-6 space-y-1">
                <div className="text-lg font-bold">#{currentAgentOrder.order_number} — {currentAgentOrder.customer_name}</div>
                <div className="text-sm font-mono text-[#0E5E6F] flex items-center gap-2">
                  <Phone className="w-4 h-4" /> {currentAgentOrder.customer_phone}
                </div>
                <div className="text-xs text-[#646970]">{currentAgentOrder.address}, {currentAgentOrder.district}</div>
                <div className="text-xs pt-1">
                  Courier History: <strong className="text-[#1E9E6A]">{currentAgentOrder.fraud.deliveredParcels}/{currentAgentOrder.fraud.totalParcels} ({currentAgentOrder.fraud.successRate}%)</strong>
                </div>
              </div>
              <div className="md:col-span-6 flex flex-wrap items-center justify-end gap-2">
                <span className="text-xl font-extrabold tabular-nums mr-2">{formatBDT(currentAgentOrder.total)}</span>
                <button type="button" onClick={() => quickStatus(currentAgentOrder.id, 'confirmed')} className="px-4 py-2 rounded-lg bg-[#1E9E6A] text-white text-xs font-bold">Confirm Order</button>
                <button type="button" onClick={() => quickStatus(currentAgentOrder.id, 'on_hold')} className="px-3 py-2 rounded-lg bg-amber-500 text-white text-xs font-bold">Hold (No Answer)</button>
                <button type="button" onClick={() => quickStatus(currentAgentOrder.id, 'cancelled')} className="px-3 py-2 rounded-lg bg-[#E5483A] text-white text-xs font-bold">Cancel</button>
                <button type="button" onClick={() => onEditOrder(currentAgentOrder.id)} className="px-3 py-2 rounded-lg border text-xs font-semibold">Full Edit</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* WooCommerce Status Filter Links */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {STATUS_TABS.map((tab) => {
          const c = counts[tab.id] || 0;
          const active = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`py-1 ${active ? 'font-bold text-[#0E5E6F] underline' : 'text-[#646970] hover:text-[#1D2327]'}`}
            >
              {tab.label} <span className="tabular-nums">({c})</span>
            </button>
          );
        })}
      </div>

      {/* Bulk Actions & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#DCDCDE]">
        <div className="flex items-center gap-2">
          <select
            aria-label="Bulk action"
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-[#DCDCDE] text-xs bg-[#F6F7F7]"
          >
            <option value="">Bulk actions ({selectedIds.length})</option>
            <option value="confirmed">Confirm selected</option>
            <option value="courier">Send to courier</option>
            <option value="print_invoice">Print bulk invoices</option>
            <option value="print_label">Print bulk 4×6 labels</option>
            <option value="export_csv">Export CSV</option>
            <option value="cancelled">Cancel selected</option>
          </select>
          <button
            type="button"
            onClick={handleBulkApply}
            disabled={selectedIds.length === 0 || !bulkAction}
            className="px-3 py-1.5 rounded-lg border border-[#DCDCDE] text-xs font-semibold hover:bg-[#F6F7F7] disabled:opacity-40"
          >
            Apply
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadOrders();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#646970] absolute left-2.5 top-2.5" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search #, name, phone, tracking..."
              className="pl-8 pr-3 py-1.5 rounded-lg border border-[#DCDCDE] text-xs w-56"
            />
          </div>
          <button type="submit" className="px-3 py-1.5 rounded-lg bg-[#F6F7F7] border border-[#DCDCDE] text-xs font-semibold">
            Filter
          </button>
        </form>
      </div>

      {/* Dense WooCommerce Order List Table */}
      <div className="bg-white rounded-xl border border-[#DCDCDE] overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-[#F6F7F7] border-b border-[#DCDCDE] text-[#646970]">
            <tr>
              <th className="p-3 w-8">
                <input
                  type="checkbox"
                  aria-label="Select all orders"
                  checked={orders.length > 0 && selectedIds.length === orders.length}
                  onChange={(e) => setSelectedIds(e.target.checked ? orders.map((o) => o.id) : [])}
                />
              </th>
              <th className="p-3">Order</th>
              <th className="p-3">Customer</th>
              <th className="p-3">District</th>
              <th className="p-3">Status</th>
              <th className="p-3">Courier Fraud Check</th>
              <th className="p-3">Source</th>
              <th className="p-3">Courier / Tracking</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F1]">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-10 text-center text-[#646970]">No orders match this filter.</td>
              </tr>
            ) : (
              orders.map((o) => {
                const f = o.fraud;
                const fraudBadgeClass =
                  f.successRate >= 80
                    ? 'bg-[#E6F7EF] text-[#1E9E6A]'
                    : f.successRate >= 50
                      ? 'bg-[#FFF4E5] text-[#B45309]'
                      : 'bg-[#FFE3DF] text-[#A3271B]';
                const attr = o.attributionObj || {};
                const srcLabel = attr.utm_source || (attr.click_ids?.fbclid ? 'facebook' : attr.click_ids?.ttclid ? 'tiktok' : attr.click_ids?.gclid ? 'google' : 'direct');

                return (
                  <tr key={o.id} className="group hover:bg-[#F9FAFB]">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        aria-label={`Select order ${o.order_number}`}
                        checked={selectedIds.includes(o.id)}
                        onChange={() => toggleSelect(o.id)}
                      />
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => onEditOrder(o.id)}
                        className="font-bold text-[#0E5E6F] hover:underline"
                      >
                        #{o.order_number}
                      </button>
                      <div className="text-[11px] text-[#646970]">{String(o.created_at).slice(0, 10)}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-[#1D2327]">{o.customer_name}</div>
                      <div className="text-[11px] text-[#646970] tabular-nums">{o.customer_phone}</div>
                    </td>
                    <td className="p-3">{o.district}</td>
                    <td className="p-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-semibold capitalize ${statusColor(o.status)}`}>
                        {String(o.status).replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${fraudBadgeClass}`}>
                        {f.deliveredParcels}/{f.totalParcels} ({f.successRate}%)
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="capitalize font-medium">{srcLabel}</span>
                      {attr.click_ids?.fbc && <span className="ml-1 text-[10px] text-[#0E5E6F] font-mono">fbc</span>}
                      {attr.click_ids?.gclid && <span className="ml-1 text-[10px] text-[#0E5E6F] font-mono">gclid</span>}
                    </td>
                    <td className="p-3">
                      {o.tracking_code ? (
                        <div>
                          <div className="font-semibold uppercase text-[11px]">{o.courier_code}</div>
                          <div className="font-mono text-[11px] text-[#0E5E6F]">{o.tracking_code}</div>
                        </div>
                      ) : (
                        <span className="text-[#9CA3AF]">Not booked</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="font-bold tabular-nums">{formatBDT(o.total)}</div>
                      <div className="text-[10px] uppercase text-[#646970]">{o.payment_method} · {o.payment_status}</div>
                    </td>
                    <td className="p-3 text-right space-x-1 whitespace-nowrap">
                      {o.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => quickStatus(o.id, 'confirmed')}
                          className="px-2 py-1 rounded bg-[#1E9E6A] text-white text-[11px] font-semibold"
                        >
                          Confirm
                        </button>
                      )}
                      {!o.tracking_code && !['cancelled', 'fake', 'returned'].includes(o.status) && (
                        <button
                          type="button"
                          onClick={() => setCourierModalOrderIds([o.id])}
                          className="px-2 py-1 rounded bg-[#0E5E6F] text-white text-[11px] font-semibold inline-flex items-center gap-1"
                        >
                          <Truck className="w-3 h-3" /> Send to Courier
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onEditOrder(o.id)}
                        className="px-2 py-1 rounded border border-[#DCDCDE] text-[11px] font-semibold hover:bg-[#F6F7F7]"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* One-Click Send to Courier Modal */}
      {courierModalOrderIds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold">Send {courierModalOrderIds.length} Order(s) to Courier</h3>
            <div>
              <label className="block text-xs font-semibold mb-1">Courier Provider</label>
              <select
                value={courierChoice}
                onChange={(e) => setCourierChoice(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#DCDCDE] text-sm"
              >
                <option value="steadfast">Steadfast Courier (Sandbox)</option>
                <option value="pathao">Pathao Courier (Sandbox)</option>
                <option value="redx">RedX Logistics (Sandbox)</option>
                <option value="paperfly">Paperfly (Sandbox)</option>
                <option value="ecourier">eCourier (Sandbox)</option>
                <option value="manual">Manual / Other Courier</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Delivery Instructions</label>
              <input
                type="text"
                value={courierNote}
                onChange={(e) => setCourierNote(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#DCDCDE] text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCourierModalOrderIds(null)} className="px-4 py-2 rounded-lg border text-xs font-semibold">Cancel</button>
              <button
                type="button"
                disabled={bookingBusy}
                onClick={submitCourierBooking}
                className="px-4 py-2 rounded-lg bg-[#0E5E6F] text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>{bookingBusy ? 'Booking...' : 'Book Parcel & Send Tracking SMS'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Manual Order Modal */}
      {newOrderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={createManualOrder} className="w-full max-w-lg rounded-xl bg-white p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold">Create Manual / Phone Order</h3>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" required placeholder="Customer Name" value={manualForm.customerName} onChange={(e) => setManualForm({ ...manualForm, customerName: e.target.value })} className="px-3 py-2 rounded-lg border text-sm" />
              <input type="tel" required placeholder="BD Mobile (017...)" value={manualForm.customerPhone} onChange={(e) => setManualForm({ ...manualForm, customerPhone: e.target.value })} className="px-3 py-2 rounded-lg border text-sm" />
              <input type="text" required placeholder="District" value={manualForm.district} onChange={(e) => setManualForm({ ...manualForm, district: e.target.value })} className="px-3 py-2 rounded-lg border text-sm" />
              <input type="number" placeholder="Shipping Fee (৳)" value={manualForm.shippingFee} onChange={(e) => setManualForm({ ...manualForm, shippingFee: Number(e.target.value) })} className="px-3 py-2 rounded-lg border text-sm" />
            </div>
            <input type="text" required placeholder="Delivery Address" value={manualForm.address} onChange={(e) => setManualForm({ ...manualForm, address: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
            <div className="grid grid-cols-3 gap-3">
              <select value={manualForm.productId} onChange={(e) => setManualForm({ ...manualForm, productId: e.target.value })} className="col-span-2 px-3 py-2 rounded-lg border text-sm">
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name_en} ({formatBDT(p.price)})</option>
                ))}
              </select>
              <input type="number" min={1} value={manualForm.qty} onChange={(e) => setManualForm({ ...manualForm, qty: Number(e.target.value) })} className="px-3 py-2 rounded-lg border text-sm" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setNewOrderOpen(false)} className="px-4 py-2 rounded-lg border text-xs font-semibold">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-[#0E5E6F] text-white text-xs font-bold">Create Order</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
