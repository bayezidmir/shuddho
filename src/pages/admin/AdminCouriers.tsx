import React, { useEffect, useState } from 'react';
import { Truck, RefreshCw, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { formatBDT } from '../../lib/bd-validation';

export const AdminCouriers: React.FC = () => {
  const [data, setData] = useState<any | null>(null);
  const [tab, setTab] = useState<'accounts' | 'bookings' | 'fraud' | 'logs'>('accounts');
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [fraudPhone, setFraudPhone] = useState('01711482910');
  const [fraudResult, setFraudResult] = useState<any | null>(null);
  const [syncMsg, setSyncMsg] = useState('');

  const load = async () => {
    const r = await fetch('/api/admin/couriers');
    if (r.ok) setData(await r.json());
  };

  useEffect(() => {
    load();
  }, []);

  const testConn = async (code: string) => {
    const r = await fetch(`/api/admin/couriers/${code}/test`, { method: 'POST' });
    const d = await r.json();
    setTestResults((prev) => ({ ...prev, [code]: d }));
    load();
  };

  const toggleSandbox = async (acc: any) => {
    await fetch(`/api/admin/couriers/${acc.code}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: true,
        sandbox: !acc.sandbox,
        pickup_store_id: acc.pickup_store_id,
      }),
    });
    load();
  };

  const syncAll = async () => {
    const r = await fetch('/api/admin/couriers/sync', { method: 'POST' });
    if (r.ok) {
      const d = await r.json();
      setSyncMsg(`Synced courier statuses (${d.updated} parcels updated).`);
      load();
    }
  };

  const runFraudCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch(`/api/admin/couriers/fraud-check?phone=${encodeURIComponent(fraudPhone)}`);
    if (r.ok) setFraudResult(await r.json());
  };

  if (!data) return <div className="h-64 bg-white rounded-xl animate-pulse" />;

  const totalCodBooked = (data.bookings || []).reduce((s: number, o: any) => s + (o.payment_status === 'paid' ? 0 : o.total), 0);
  const totalCourierFee = (data.bookings || []).reduce((s: number, o: any) => s + Number(o.courier_charge || 70), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#1D2327]">Courier Integrations & COD Reconciliation</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-white border border-[#DCDCDE] p-0.5 text-xs">
            {[
              { id: 'accounts', label: 'Courier Accounts' },
              { id: 'bookings', label: `Shipments & COD (${data.bookings.length})` },
              { id: 'fraud', label: 'Fraud Check Tool' },
              { id: 'logs', label: 'API Logs' },
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
          <button type="button" onClick={syncAll} className="px-3 py-2 rounded-lg bg-[#0E5E6F] text-white text-xs font-bold inline-flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Sync Statuses Now
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className="p-3 rounded-xl bg-[#E6F7EF] text-[#1E9E6A] text-xs font-semibold">{syncMsg}</div>
      )}

      {tab === 'accounts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.accounts.map((acc: any) => {
            const tr = testResults[acc.code];
            return (
              <div key={acc.code} className="bg-white rounded-xl border border-[#DCDCDE] p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-[#0E5E6F]" />
                    <span className="font-bold text-sm">{acc.name}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${acc.sandbox ? 'bg-[#FFF4E5] text-[#B45309]' : 'bg-[#E6F7EF] text-[#1E9E6A]'}`}>
                    {acc.sandbox ? 'Sandbox' : 'Live API'}
                  </span>
                </div>
                <div className="text-[#646970]">
                  Pickup Store ID: <span className="font-mono font-semibold text-[#1D2327]">{acc.pickup_store_id || 'Default'}</span>
                </div>
                <div className="text-[#646970]">
                  Connection: <strong className="text-[#1E9E6A] capitalize">{acc.status || 'Ready'}</strong>
                </div>
                {tr && (
                  <div className="p-2 rounded bg-[#E6F7EF] text-[#1E9E6A] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{tr.message} ({tr.latencyMs}ms)</span>
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => testConn(acc.code)} className="flex-1 py-1.5 rounded-lg border border-[#DCDCDE] font-semibold hover:bg-[#F6F7F7]">
                    Test Connection
                  </button>
                  <button type="button" onClick={() => toggleSandbox(acc)} className="px-3 py-1.5 rounded-lg border border-[#DCDCDE] font-semibold hover:bg-[#F6F7F7]">
                    {acc.sandbox ? 'Switch Live' : 'Use Sandbox'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'bookings' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="bg-white rounded-xl border border-[#DCDCDE] p-4">
              <div className="text-[#646970]">Booked Shipments</div>
              <div className="text-xl font-extrabold tabular-nums mt-1">{data.bookings.length}</div>
            </div>
            <div className="bg-white rounded-xl border border-[#DCDCDE] p-4">
              <div className="text-[#646970]">Expected COD Collection</div>
              <div className="text-xl font-extrabold tabular-nums mt-1 text-[#0E5E6F]">{formatBDT(totalCodBooked)}</div>
            </div>
            <div className="bg-white rounded-xl border border-[#DCDCDE] p-4">
              <div className="text-[#646970]">Net Courier Settlement</div>
              <div className="text-xl font-extrabold tabular-nums mt-1 text-[#1E9E6A]">{formatBDT(Math.max(0, totalCodBooked - totalCourierFee))}</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#DCDCDE] overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F6F7F7] border-b text-[#646970]">
                <tr><th className="p-3">Order</th><th className="p-3">Courier</th><th className="p-3">Tracking ID</th><th className="p-3">Customer</th><th className="p-3">Courier Status</th><th className="p-3 text-right">COD Due</th></tr>
              </thead>
              <tbody className="divide-y">
                {data.bookings.map((b: any) => (
                  <tr key={b.id}>
                    <td className="p-3 font-bold">#{b.order_number}</td>
                    <td className="p-3 uppercase font-semibold">{b.courier_code}</td>
                    <td className="p-3 font-mono text-[#0E5E6F]">{b.tracking_code}</td>
                    <td className="p-3">{b.customer_name} ({b.district})</td>
                    <td className="p-3 capitalize">{b.courier_status || b.status}</td>
                    <td className="p-3 text-right tabular-nums font-bold">{b.payment_status === 'paid' ? '৳0 (Paid)' : formatBDT(b.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'fraud' && (
        <div className="bg-white rounded-xl border border-[#DCDCDE] p-5 max-w-xl space-y-4 text-xs">
          <h2 className="font-bold text-sm flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#0E5E6F]" /> Bangladesh Courier Delivery Score Lookup</h2>
          <form onSubmit={runFraudCheck} className="flex gap-2">
            <input type="tel" value={fraudPhone} onChange={(e) => setFraudPhone(e.target.value)} placeholder="017XXXXXXXX" className="flex-1 px-3 py-2 rounded-lg border font-mono" />
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#0E5E6F] text-white font-bold">Check Phone</button>
          </form>
          {fraudResult && (
            <div className="p-4 rounded-xl bg-[#EEF5F5] border border-[#D3E3E5] space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-mono font-bold text-sm">{fraudResult.phone}</span>
                <span className="px-2.5 py-0.5 rounded-full bg-white font-bold text-[#0E5E6F]">
                  {fraudResult.deliveredParcels} of {fraudResult.totalParcels} Delivered ({fraudResult.successRate}%)
                </span>
              </div>
              <div className="space-y-1">
                {fraudResult.sourceBreakdown.map((b: any) => (
                  <div key={b.courier} className="flex justify-between text-[#646970]">
                    <span>{b.courier}</span>
                    <span className="tabular-nums">{b.delivered}/{b.total} delivered</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'logs' && (
        <div className="bg-white rounded-xl border border-[#DCDCDE] overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F7F7] border-b text-[#646970]">
              <tr><th className="p-3">Time</th><th className="p-3">Courier</th><th className="p-3">Action</th><th className="p-3">HTTP</th><th className="p-3">Response</th></tr>
            </thead>
            <tbody className="divide-y">
              {data.logs.map((l: any) => (
                <tr key={l.id}>
                  <td className="p-3">{String(l.created_at).slice(0, 19)}</td>
                  <td className="p-3 uppercase font-bold">{l.courier_code}</td>
                  <td className="p-3">{l.action}</td>
                  <td className="p-3 font-mono">{l.http_status}</td>
                  <td className="p-3 font-mono text-[11px] max-w-md truncate">{l.response_masked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
