import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  PhoneMissed,
  Users,
  Package,
  Boxes,
  Truck,
  Megaphone,
  FileText,
  Palette,
  BarChart3,
  Shield,
  Bell,
  Settings,
  ExternalLink,
  Search,
  LogOut,
  Menu,
  Plus,
  ChevronRight,
  Lock,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { hasPermission, ROLE_LABELS, type Permission, type StaffRole } from '../../lib/rbac';

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
}

interface AdminLayoutProps {
  activeSection: string;
  onSelectSection: (section: string) => void;
  staff: StaffUser | null;
  onAuthChange: (staff: StaffUser | null) => void;
  badges?: { pendingOrders?: number; incompleteOrders?: number };
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{ id: string; label: string; icon: any; permission: Permission; badgeKey?: 'pendingOrders' | 'incompleteOrders' }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
  { id: 'orders', label: 'Orders', icon: ShoppingBag, permission: 'orders.view', badgeKey: 'pendingOrders' },
  { id: 'incomplete', label: 'Incomplete Orders', icon: PhoneMissed, permission: 'incomplete_orders.view', badgeKey: 'incompleteOrders' },
  { id: 'customers', label: 'Customers', icon: Users, permission: 'customers.view' },
  { id: 'products', label: 'Products', icon: Package, permission: 'products.view' },
  { id: 'inventory', label: 'Inventory', icon: Boxes, permission: 'inventory.view' },
  { id: 'couriers', label: 'Couriers', icon: Truck, permission: 'couriers.view' },
  { id: 'marketing', label: 'Marketing', icon: Megaphone, permission: 'marketing.view' },
  { id: 'content', label: 'Content (CMS)', icon: FileText, permission: 'content.view' },
  { id: 'appearance', label: 'Appearance', icon: Palette, permission: 'appearance.edit' },
  { id: 'reports', label: 'Reports', icon: BarChart3, permission: 'reports.view' },
  { id: 'users', label: 'Users & Roles', icon: Shield, permission: 'users.manage' },
  { id: 'notifications', label: 'Notifications & SMS', icon: Bell, permission: 'notifications.edit' },
  { id: 'settings', label: 'Settings', icon: Settings, permission: 'settings.view' },
];

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  activeSection,
  onSelectSection,
  staff,
  onAuthChange,
  badges = {},
  children,
}) => {
  const { navigate, bootstrap } = useStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');

  // Login form state
  const [email, setEmail] = useState('owner@shuddho.com.bd');
  const [password, setPassword] = useState('Shuddho@2026');
  const [totpCode, setTotpCode] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Ctrl/Cmd + K Command Palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const allowedNav = useMemo(
    () => (staff ? NAV_ITEMS.filter((n) => hasPermission(staff.role, n.permission)) : []),
    [staff],
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setSubmitting(true);
    try {
      const resp = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, totpCode }),
      });
      const data = await resp.json();
      if (data.requiresTotp) {
        setNeedsTotp(true);
        setSubmitting(false);
        return;
      }
      if (!resp.ok) {
        setLoginError(data.error || 'Login failed');
        setSubmitting(false);
        return;
      }
      onAuthChange(data.staff);
      // Ensure agent lands on orders or dashboard
      if (data.staff.role === 'packer') onSelectSection('orders');
      else if (data.staff.role === 'editor') onSelectSection('products');
    } catch {
      setLoginError('Network error logging in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    onAuthChange(null);
  };

  if (!staff) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#EEF5F5] text-[#0E2A30]">
        <div className="w-full max-w-md rounded-[18px] bg-white border border-[#D3E3E5] p-6 sm:p-8 space-y-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-full bg-[#0E5E6F] text-white font-bold flex items-center justify-center">S</span>
              <div>
                <h1 className="text-xl font-extrabold">{bootstrap?.general?.storeName || 'Shuddho'} Admin</h1>
                <p className="text-xs text-[#557077]">Operations & Store Management</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-xs font-semibold text-[#0E5E6F] hover:underline"
            >
              View Store →
            </button>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl bg-[#FFE3DF] text-[#A3271B] text-xs font-medium">{loginError}</div>
          )}

          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold mb-1">Staff Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-[12px] border border-[#D3E3E5] bg-[#EEF5F5] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-[12px] border border-[#D3E3E5] bg-[#EEF5F5] text-sm"
              />
            </div>
            {needsTotp && (
              <div>
                <label className="block text-xs font-semibold mb-1">2FA Authenticator Code</label>
                <input
                  type="text"
                  required
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="6-digit TOTP"
                  className="w-full px-3.5 py-2.5 rounded-[12px] border border-[#D3E3E5] bg-[#EEF5F5] text-sm font-mono"
                />
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-[12px] bg-[#0E5E6F] text-white text-sm font-bold hover:opacity-95 flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>{submitting ? 'Signing in...' : 'Sign In to Admin'}</span>
            </button>
          </form>

          {/* Quick Role Switcher for Testing RBAC */}
          <div className="pt-3 border-t border-[#D3E3E5] space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#557077]">Demo Staff Accounts (Click to Fill)</div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              {[
                { label: 'Owner', e: 'owner@shuddho.com.bd', p: 'Shuddho@2026' },
                { label: 'Confirmation Agent', e: 'agent@shuddho.com.bd', p: 'Agent@2026' },
                { label: 'Packer', e: 'packer@shuddho.com.bd', p: 'Packer@2026' },
                { label: 'Marketing', e: 'marketing@shuddho.com.bd', p: 'Marketing@2026' },
              ].map((acc) => (
                <button
                  key={acc.e}
                  type="button"
                  onClick={() => { setEmail(acc.e); setPassword(acc.p); }}
                  className="px-2.5 py-1.5 rounded-lg border border-[#D3E3E5] text-left hover:bg-[#EEF5F5] font-medium"
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#F0F2F4] text-[#1D2327]">
      {/* WordPress/WooCommerce Dark Left Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-60' : 'w-16'
        } bg-[#1D2327] text-[#F0F0F1] flex flex-col shrink-0 transition-all duration-200 no-print`}
      >
        <div className="h-14 px-3.5 flex items-center justify-between border-b border-white/10">
          {sidebarOpen && (
            <div className="flex items-center gap-2 truncate">
              <span className="w-7 h-7 rounded-lg bg-[#0E5E6F] text-white text-xs font-bold flex items-center justify-center shrink-0">S</span>
              <span className="font-bold text-sm truncate">{bootstrap?.general?.storeName || 'Shuddho'}</span>
            </div>
          )}
          <button
            type="button"
            aria-label="Toggle sidebar"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded hover:bg-white/10 text-white/80"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        <nav aria-label="Admin navigation" className="flex-1 py-2 overflow-y-auto space-y-0.5 px-2">
          {allowedNav.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id || (item.id === 'orders' && activeSection.startsWith('order:'));
            const count = item.badgeKey ? badges[item.badgeKey] : undefined;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition ${
                  active ? 'bg-[#0E5E6F] text-white' : 'text-[#C3C4C7] hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  {sidebarOpen && <span className="truncate">{item.label}</span>}
                </span>
                {sidebarOpen && count !== undefined && count > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FF6B5B] text-white tabular-nums">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10 text-xs">
          {sidebarOpen && (
            <div className="mb-2">
              <div className="font-semibold text-white truncate">{staff.name}</div>
              <div className="text-[11px] text-[#9CA3AF]">{ROLE_LABELS[staff.role]}</div>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[#C3C4C7] hover:bg-white/10 hover:text-white"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top WordPress-style Admin Bar */}
        <header className="h-14 bg-white border-b border-[#DCDCDE] px-4 sm:px-6 flex items-center justify-between gap-4 no-print shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <a
              href="/"
              onClick={(e) => { e.preventDefault(); navigate('/'); }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0E5E6F] hover:underline whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>View Storefront</span>
            </a>

            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#DCDCDE] bg-[#F6F7F7] text-xs text-[#646970] hover:border-[#0E5E6F]"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Command Palette</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border text-[10px] font-mono">⌘K</kbd>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {hasPermission(staff.role, 'orders.edit') && (
              <button
                type="button"
                onClick={() => onSelectSection('orders:new')}
                className="px-3 py-1.5 rounded-lg bg-[#0E5E6F] text-white text-xs font-semibold inline-flex items-center gap-1 hover:opacity-95 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" /> New Order
              </button>
            )}
            {hasPermission(staff.role, 'products.edit') && (
              <button
                type="button"
                onClick={() => onSelectSection('products:new')}
                className="hidden sm:inline-flex px-3 py-1.5 rounded-lg border border-[#DCDCDE] text-xs font-semibold hover:bg-[#F6F7F7] items-center gap-1 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" /> New Product
              </button>
            )}
          </div>
        </header>

        {/* Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 overflow-x-auto">{children}</main>
      </div>

      {/* Global Command Palette (Ctrl/Cmd + K) */}
      {cmdOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40 p-4" onClick={() => setCmdOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white border border-[#DCDCDE] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 border-b border-[#DCDCDE] flex items-center gap-2">
              <Search className="w-4 h-4 text-[#646970]" />
              <input
                autoFocus
                type="text"
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                placeholder="Jump to module (Orders, Couriers, Tracking, Theme...)"
                className="flex-1 text-sm focus:outline-none"
              />
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-[#F0F0F1]">
              {allowedNav
                .filter((n) => n.label.toLowerCase().includes(cmdQuery.toLowerCase()))
                .map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      onSelectSection(n.id);
                      setCmdOpen(false);
                      setCmdQuery('');
                    }}
                    className="w-full px-4 py-2.5 flex items-center justify-between text-sm hover:bg-[#F6F7F7]"
                  >
                    <span className="font-medium">{n.label}</span>
                    <ChevronRight className="w-4 h-4 text-[#646970]" />
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
