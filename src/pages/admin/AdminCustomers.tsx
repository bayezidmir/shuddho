import React, { useEffect, useState } from 'react';
import { Search, ShieldAlert, ShieldCheck, Download } from 'lucide-react';
import { formatBDT } from '../../lib/bd-validation';

async function sha256Hex(val: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(val.trim().toLowerCase()));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const AdminCustomers: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [blockList, setBlockList] = useState<any[]>([]);
  const [segment, setSegment] = useState<'all' | 'repeat' | 'vip' | 'blocked'>('all');
  const [query, setQuery] = useState('');

  const load = async () => {
    const r = await fetch('/api/admin/customers');
    if (r.ok) {
      const d = await r.json();
      setCustomers(d.customers || []);
      setBlockList(d.blockList || []);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleBlock = async (id: string, currentlyBlocked: boolean) => {
    await fetch(`/api/admin/customers/${id}/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: currentlyBlocked ? '' : 'Flagged from Customer CRM' }),
    });
    load();
  };

  const filtered = customers.filter((c) => {
    if (segment === 'repeat' && (c.orders_count || 0) < 2) return false;
    if (segment === 'vip' && (c.total_spent || 0) < 3000) return false;
    if (segment === 'blocked' && !c.blocked) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        String(c.name || '').toLowerCase().includes(q) ||
        String(c.phone || '').toLowerCase().includes(q) ||
        String(c.district || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const exportHashedAudience = async () => {
    const rows = ['phone_sha256,email_sha256,country,ct'];
    for (const c of filtered) {
      const ph = await sha256Hex(c.phone || '');
      const em = c.email ? await sha256Hex(c.email) : '';
      rows.push(`${ph},${em},bd,${String(c.district || '').toLowerCase()}`);
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shuddho-hashed-custom-audience-${Date.now()}.csv`;
    a.click();
  };

  const exportCsv = () => {
    const rows = [
      'Name,Phone,Email,District,Orders,TotalSpent,CourierSuccessRate,FirstSource,Blocked',
      ...filtered.map(
        (c) =>
          `"${c.name}","${c.phone}","${c.email || ''}","${c.district}",${c.orders_count || 0},${c.total_spent || 0},${c.fraud?.successRate ?? 100}%,"${c.first_source || 'direct'}",${Boolean(c.blocked)}`,
      ),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shuddho-customers-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1D2327]">Customers & Fraud Blocklist</h1>
          <p className="text-xs text-[#646970]">{customers.length} customer records · {blockList.length} blocked numbers/IPs</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportHashedAudience}
            className="px-3 py-1.5 rounded-lg bg-white border border-[#DCDCDE] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#F6F7F7]"
          >
            <Download className="w-3.5 h-3.5" /> Export SHA-256 Audience (Meta/Google)
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="px-3 py-1.5 rounded-lg bg-[#0E5E6F] text-white text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#DCDCDE]">
        <div className="flex items-center gap-2 text-xs">
          {[
            { id: 'all', label: 'All Customers' },
            { id: 'repeat', label: 'Repeat (2+ Orders)' },
            { id: 'vip', label: 'VIP (৳3,000+)' },
            { id: 'blocked', label: 'Blocked' },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSegment(s.id as any)}
              className={`px-3 py-1.5 rounded-lg font-semibold ${
                segment === s.id ? 'bg-[#0E5E6F] text-white' : 'bg-[#F6F7F7] text-[#646970]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#646970] absolute left-2.5 top-2.5" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, district..."
            className="pl-8 pr-3 py-1.5 rounded-lg border border-[#DCDCDE] text-xs w-60"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#DCDCDE] overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-[#F6F7F7] border-b border-[#DCDCDE] text-[#646970]">
            <tr>
              <th className="p-3">Customer</th>
              <th className="p-3">District / Address</th>
              <th className="p-3">First Source</th>
              <th className="p-3 text-right">Orders</th>
              <th className="p-3 text-right">Total Spent</th>
              <th className="p-3">Courier Score</th>
              <th className="p-3 text-right">Status / Block</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F1]">
            {filtered.map((c) => {
              const f = c.fraud || { deliveredParcels: 0, totalParcels: 0, successRate: 100 };
              return (
                <tr key={c.id} className="hover:bg-[#F9FAFB]">
                  <td className="p-3">
                    <div className="font-bold text-[#1D2327]">{c.name}</div>
                    <div className="font-mono text-[#0E5E6F]">{c.phone}</div>
                    {c.email && <div className="text-[11px] text-[#646970]">{c.email}</div>}
                  </td>
                  <td className="p-3">
                    <div className="font-semibold">{c.district}</div>
                    <div className="text-[11px] text-[#646970] max-w-[220px] truncate">{c.address}</div>
                  </td>
                  <td className="p-3 capitalize">{c.first_source || 'direct'}</td>
                  <td className="p-3 text-right tabular-nums font-semibold">{c.orders_count || 0}</td>
                  <td className="p-3 text-right tabular-nums font-bold">{formatBDT(c.total_spent || 0)}</td>
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
                      {f.deliveredParcels}/{f.totalParcels} ({f.successRate}%)
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleBlock(c.id, Boolean(c.blocked))}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                        c.blocked
                          ? 'bg-[#FFE3DF] text-[#A3271B] border-[#F8B4AC]'
                          : 'bg-white text-[#1D2327] border-[#DCDCDE] hover:bg-[#F6F7F7]'
                      }`}
                    >
                      {c.blocked ? (
                        <><ShieldAlert className="w-3.5 h-3.5" /> Blocked (Unblock)</>
                      ) : (
                        <><ShieldCheck className="w-3.5 h-3.5 text-[#1E9E6A]" /> Active (Block)</>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
