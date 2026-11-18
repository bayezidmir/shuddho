import React, { useEffect, useState } from 'react';
import { Palette, RotateCcw, Save } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

const COAST_DEFAULTS: Record<string, any> = {
  '--bg': '#EEF5F5',
  '--surface': '#FFFFFF',
  '--ink': '#0E2A30',
  '--muted': '#557077',
  '--primary': '#0E5E6F',
  '--primary-ink': '#FFFFFF',
  '--accent': '#FF6B5B',
  '--accent-ink': '#FFFFFF',
  '--line': '#D3E3E5',
  '--image-bg': '#E0EDEE',
  '--footer-bg': '#0B3A44',
  '--footer-fg': '#CBE3E6',
  '--topbar-bg': '#0E5E6F',
  '--topbar-fg': '#D9F0F2',
  radiusCard: '18px',
  radiusControl: '12px',
  fontDisplay: 'Outfit',
  showRatingOnCard: true,
  showOrderNowOnCard: true,
  customCss: '',
};

const COLOR_TOKENS = [
  { key: '--bg', label: 'Page Background' },
  { key: '--surface', label: 'Card Surface' },
  { key: '--ink', label: 'Primary Ink Text' },
  { key: '--muted', label: 'Muted Secondary Ink' },
  { key: '--primary', label: 'Primary Teal' },
  { key: '--accent', label: 'Coral Accent' },
  { key: '--line', label: 'Hairline Border' },
  { key: '--image-bg', label: 'Product Image Studio BG' },
  { key: '--topbar-bg', label: 'Announcement Bar BG' },
  { key: '--footer-bg', label: 'Footer Background' },
];

export const AdminAppearance: React.FC = () => {
  const { bootstrap, refreshBootstrap } = useStore();
  const [theme, setTheme] = useState<Record<string, any>>(COAST_DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (bootstrap?.theme) {
      setTheme({ ...COAST_DEFAULTS, ...bootstrap.theme });
    }
  }, [bootstrap]);

  const saveTheme = async () => {
    setSaving(true);
    const r = await fetch('/api/admin/settings/theme', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: theme }),
    });
    setSaving(false);
    if (r.ok) {
      await refreshBootstrap();
      setMsg('Coast Theme tokens saved and applied live to the storefront!');
      setTimeout(() => setMsg(''), 3000);
    }
  };

  const resetDefaults = async () => {
    setTheme(COAST_DEFAULTS);
    await fetch('/api/admin/settings/theme', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: COAST_DEFAULTS }),
    });
    await refreshBootstrap();
    setMsg('Reset to default Coast palette.');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1D2327]">Appearance & Coast Theme Tokens</h1>
          <p className="text-xs text-[#646970]">Customize storefront colors, card geometry, typography, and custom CSS live without touching code.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={resetDefaults} className="px-3 py-2 rounded-lg bg-white border border-[#DCDCDE] text-xs font-semibold inline-flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" /> Reset Coast Defaults
          </button>
          <button type="button" disabled={saving} onClick={saveTheme} className="px-4 py-2 rounded-lg bg-[#0E5E6F] text-white text-xs font-bold inline-flex items-center gap-1.5">
            <Save className="w-3.5 h-3.5" /> {saving ? 'Applying...' : 'Publish Theme'}
          </button>
        </div>
      </div>

      {msg && <div className="p-3 rounded-xl bg-[#E6F7EF] text-[#1E9E6A] text-xs font-semibold">{msg}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-4">
          <h2 className="font-bold text-sm flex items-center gap-2"><Palette className="w-4 h-4 text-[#0E5E6F]" /> Coast Color Palette</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {COLOR_TOKENS.map((tk) => (
              <div key={tk.key} className="flex items-center justify-between p-2.5 rounded-lg border border-[#DCDCDE] bg-[#F9FAFB]">
                <div>
                  <div className="font-semibold">{tk.label}</div>
                  <div className="font-mono text-[10px] text-[#646970]">{tk.key}</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme[tk.key] || '#0E5E6F'}
                    onChange={(e) => setTheme({ ...theme, [tk.key]: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer border-0"
                  />
                  <input
                    type="text"
                    value={theme[tk.key] || ''}
                    onChange={(e) => setTheme({ ...theme, [tk.key]: e.target.value })}
                    className="w-20 px-2 py-1 rounded border font-mono text-[11px]"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-3 text-xs">
            <h2 className="font-bold text-sm">Typography & Product Card Options</h2>
            <div>
              <label className="block font-semibold mb-1">Display Font</label>
              <select value={theme.fontDisplay} onChange={(e) => setTheme({ ...theme, fontDisplay: e.target.value })} className="w-full px-3 py-2 rounded-lg border">
                <option value="Outfit">Outfit (Coast Default)</option>
                <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                <option value="Hind Siliguri">Hind Siliguri</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Card Radius</label>
                <select value={theme.radiusCard} onChange={(e) => setTheme({ ...theme, radiusCard: e.target.value })} className="w-full px-3 py-2 rounded-lg border">
                  <option value="12px">12px (Crisp)</option>
                  <option value="18px">18px (Coast Default)</option>
                  <option value="24px">24px (Soft)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Button Radius</label>
                <select value={theme.radiusControl} onChange={(e) => setTheme({ ...theme, radiusControl: e.target.value })} className="w-full px-3 py-2 rounded-lg border">
                  <option value="8px">8px</option>
                  <option value="12px">12px (Coast Default)</option>
                  <option value="999px">999px (Pill)</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 pt-1 font-semibold">
              <input type="checkbox" checked={Boolean(theme.showRatingOnCard)} onChange={(e) => setTheme({ ...theme, showRatingOnCard: e.target.checked })} />
              Show star rating on product cards
            </label>
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={Boolean(theme.showOrderNowOnCard)} onChange={(e) => setTheme({ ...theme, showOrderNowOnCard: e.target.checked })} />
              Show 1-click "Order Now" COD button on cards
            </label>
          </div>

          <div className="bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-2 text-xs">
            <h2 className="font-bold text-sm">Custom Storefront CSS</h2>
            <textarea
              rows={5}
              value={theme.customCss || ''}
              onChange={(e) => setTheme({ ...theme, customCss: e.target.value })}
              placeholder="/* Optional CSS rules injected on storefront */"
              className="w-full px-3 py-2 rounded-lg border font-mono text-[11px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
