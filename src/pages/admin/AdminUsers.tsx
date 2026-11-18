import React, { useEffect, useState } from 'react';
import { Shield, UserPlus, Check, Minus } from 'lucide-react';
import { ROLE_LABELS, ROLE_PERMISSIONS, type StaffRole, type Permission } from '../../lib/rbac';

const KEY_PERMS: Permission[] = [
  'dashboard.view',
  'orders.view',
  'orders.confirm',
  'orders.courier',
  'products.edit',
  'inventory.edit',
  'marketing.edit',
  'appearance.edit',
  'reports.view',
  'users.manage',
  'settings.edit',
  'tracking.code_inject',
];

export const AdminUsers: React.FC = () => {
  const [data, setData] = useState<{ users: any[]; auditLogs: any[] }>({ users: [], auditLogs: [] });
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'agent' as StaffRole });
  const [err, setErr] = useState('');

  const load = async () => {
    const r = await fetch('/api/admin/users');
    if (r.ok) setData(await r.json());
  };

  useEffect(() => {
    load();
  }, []);

  const createStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    const r = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!r.ok) {
      const d = await r.json();
      setErr(d.error || 'Could not create user');
      return;
    }
    setForm({ name: '', email: '', password: '', role: 'agent' });
    load();
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-[#1D2327]">Users, 7-Role RBAC Matrix & Audit Log</h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <form onSubmit={createStaff} className="lg:col-span-4 bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-3 text-xs">
          <h2 className="font-bold text-sm flex items-center gap-1.5"><UserPlus className="w-4 h-4 text-[#0E5E6F]" /> Add Staff Account</h2>
          {err && <div className="p-2 rounded bg-[#FFE3DF] text-[#A3271B]">{err}</div>}
          <input type="text" required placeholder="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
          <input type="email" required placeholder="Staff Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
          <input type="password" required placeholder="Temporary Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })} className="w-full px-3 py-2 rounded-lg border">
            {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button type="submit" className="w-full py-2 rounded-lg bg-[#0E5E6F] text-white font-bold">Create Staff User</button>
        </form>

        <div className="lg:col-span-8 bg-white rounded-xl border border-[#DCDCDE] overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F7F7] border-b text-[#646970]">
              <tr><th className="p-3">Staff Member</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">2FA</th><th className="p-3">Status</th></tr>
            </thead>
            <tbody className="divide-y">
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td className="p-3 font-bold">{u.name}</td>
                  <td className="p-3 font-mono">{u.email}</td>
                  <td className="p-3">{ROLE_LABELS[u.role as StaffRole] || u.role}</td>
                  <td className="p-3">{u.totp_enabled ? 'Enabled' : 'Off'}</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-[#E6F7EF] text-[#1E9E6A] text-[10px] font-bold uppercase">{u.active ? 'Active' : 'Disabled'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RBAC Matrix */}
      <div className="bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-3 overflow-x-auto">
        <h2 className="font-bold text-sm flex items-center gap-1.5"><Shield className="w-4 h-4 text-[#0E5E6F]" /> Role-Based Access Control Matrix</h2>
        <table className="w-full text-left text-[11px]">
          <thead className="bg-[#F6F7F7] border-b">
            <tr>
              <th className="p-2">Permission</th>
              {(Object.keys(ROLE_PERMISSIONS) as StaffRole[]).map((r) => (
                <th key={r} className="p-2 text-center capitalize">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {KEY_PERMS.map((perm) => (
              <tr key={perm}>
                <td className="p-2 font-mono">{perm}</td>
                {(Object.keys(ROLE_PERMISSIONS) as StaffRole[]).map((r) => (
                  <td key={r} className="p-2 text-center">
                    {ROLE_PERMISSIONS[r].includes(perm) ? (
                      <Check className="w-3.5 h-3.5 text-[#1E9E6A] inline" />
                    ) : (
                      <Minus className="w-3.5 h-3.5 text-gray-300 inline" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Audit Log */}
      <div className="bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-3 overflow-x-auto">
        <h2 className="font-bold text-sm">Security & Operations Audit Log</h2>
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F6F7F7] border-b text-[#646970]">
            <tr><th className="p-2.5">Timestamp</th><th className="p-2.5">Staff</th><th className="p-2.5">Action</th><th className="p-2.5">Entity</th></tr>
          </thead>
          <tbody className="divide-y">
            {data.auditLogs.slice(0, 20).map((a) => (
              <tr key={a.id}>
                <td className="p-2.5">{String(a.created_at).slice(0, 19)}</td>
                <td className="p-2.5 font-semibold">{a.staff_name}</td>
                <td className="p-2.5 font-mono text-[#0E5E6F]">{a.action}</td>
                <td className="p-2.5">{a.entity_type} {a.entity_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
