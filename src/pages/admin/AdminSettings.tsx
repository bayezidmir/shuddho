import React, { useEffect, useState } from 'react';
import { Save, Webhook, ShieldCheck, Key, Download, RefreshCw, Eye, Trash2, Send } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { validateGtmContainerId } from '../../lib/bd-validation';

export const AdminSettings: React.FC = () => {
  const { bootstrap, refreshBootstrap } = useStore();
  const [tab, setTab] = useState<'general' | 'tracking' | 'webhooks' | 'shipping' | 'payments' | 'system'>('general');

  const [general, setGeneral] = useState<any>({});
  const [tracking, setTracking] = useState<any>({});
  const [payments, setPayments] = useState<any>({});
  const [webhooks, setWebhooks] = useState<{ endpoints: any[]; deliveries: any[] }>({ endpoints: [], deliveries: [] });
  const [system, setSystem] = useState<any | null>(null);
  const [shippingZones, setShippingZones] = useState<any[]>([]);

  const [newEp, setNewEp] = useState({
    name: 'Server GTM / CAPI Listener',
    url: 'https://sgtm.shuddho.com.bd/webhook/purchase',
    include_hashed_pii: true,
    events: ['Purchase', 'OrderDelivered', 'OrderCancelled'],
  });
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState('');
  const [payloadModal, setPayloadModal] = useState<any | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const loadSettings = async () => {
    const [g, t, p, w, s] = await Promise.all([
      fetch('/api/admin/settings/general').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/admin/settings/tracking').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/admin/settings/payments').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/admin/webhooks').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/admin/system').then((r) => (r.ok ? r.json() : null)),
    ]);
    if (g) setGeneral(g.value || {});
    if (t) setTracking(t.value || {});
    if (p) setPayments(p.value || {});
    if (w) setWebhooks(w);
    if (s) setSystem(s);
    if (bootstrap?.shippingZones) setShippingZones(bootstrap.shippingZones);
  };

  useEffect(() => {
    loadSettings();
  }, [bootstrap]);

  const notify = (m: string) => {
    setErrMsg('');
    setStatusMsg(m);
    setTimeout(() => setStatusMsg(''), 4000);
  };

  const saveSettingKey = async (key: string, value: any) => {
    setErrMsg('');
    setVerifyStatus(null);
    let payloadValue = value;
    if (key === 'tracking') {
      const cleanedId = String(value.gtmContainerId || '').trim().toUpperCase();
      const hasOverride = Boolean(String(value.overrideHeadCode || '').trim() || String(value.overrideBodyCode || '').trim());
      if (cleanedId && !validateGtmContainerId(cleanedId)) {
        setErrMsg('GTM Container ID must match format GTM-XXXXXXX (e.g., GTM-ABC1234).');
        return;
      }
      payloadValue = {
        ...value,
        gtmContainerId: cleanedId,
        gtmEnabled: value.gtmEnabled !== undefined ? Boolean(value.gtmEnabled) : Boolean(cleanedId || hasOverride),
      };
      setTracking(payloadValue);
    }
    const r = await fetch(`/api/admin/settings/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: payloadValue }),
    });
    const d = await r.json();
    if (!r.ok) {
      setErrMsg(d.error || 'Failed to save setting');
      return;
    }
    await refreshBootstrap();
    notify(`Saved "${key}" settings and updated storefront immediately.`);
  };

  const verifyStorefrontGtm = async () => {
    setVerifyStatus(null);
    try {
      const res = await fetch(`/?gtm_verify=${Date.now()}`, { cache: 'no-store' });
      const html = await res.text();
      const headEnd = html.indexOf('</head>');
      const headSection = headEnd > 0 ? html.slice(0, headEnd) : html;
      const cid = String(tracking.gtmContainerId || '').trim().toUpperCase();
      const hasSsrMarker = headSection.includes('data-shuddho-gtm="ssr"');
      const hasContainer = cid ? headSection.includes(cid) : false;
      const hasOverride = Boolean(String(tracking.overrideHeadCode || '').trim()) && hasSsrMarker;
      if (hasSsrMarker && (hasContainer || hasOverride)) {
        setVerifyStatus({
          ok: true,
          msg: cid
            ? `Verified: ${cid} is rendered directly inside storefront <head> and <body> HTML for Tag Assistant.`
            : 'Verified: Custom Head Code override is rendered directly inside storefront <head> HTML.',
        });
      } else if (!tracking.gtmEnabled) {
        setVerifyStatus({
          ok: false,
          msg: 'GTM is currently disabled. Check "Enable GTM" and click Save & Activate Tracking Live.',
        });
      } else {
        setVerifyStatus({
          ok: false,
          msg: 'Storefront <head> HTML does not show active GTM tags yet. Save your GTM Container ID or Head Override first.',
        });
      }
    } catch {
      setVerifyStatus({ ok: false, msg: 'Could not fetch storefront HTML to verify.' });
    }
  };

  const addWebhookEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg('');
    const r = await fetch('/api/admin/webhooks/endpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newEp, enabled: true }),
    });
    const d = await r.json();
    if (!r.ok) {
      setErrMsg(d.error || 'Could not save webhook endpoint.');
      return;
    }
    notify(`Webhook endpoint added. Signing secret: ${d.secret}`);
    loadSettings();
  };

  const toggleEndpoint = async (ep: any) => {
    await fetch('/api/admin/webhooks/endpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...ep, enabled: !ep.enabled }),
    });
    loadSettings();
  };

  const deleteEndpoint = async (id: string) => {
    await fetch(`/api/admin/webhooks/endpoints/${id}`, { method: 'DELETE' });
    loadSettings();
  };

  const testWebhooks = async () => {
    const r = await fetch('/api/admin/webhooks/test', { method: 'POST' });
    if (r.ok) {
      notify('Test Purchase conversion webhook dispatched! Inspect delivery log below.');
      loadSettings();
    }
  };

  const retryDelivery = async (id: string) => {
    await fetch(`/api/admin/webhooks/deliveries/${id}/retry`, { method: 'POST' });
    notify('Webhook retry executed.');
    loadSettings();
  };

  const generateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch('/api/admin/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newKeyName || 'External ERP Key' }),
    });
    const d = await r.json();
    if (r.ok) {
      setCreatedKey(d.rawKey);
      setNewKeyName('');
      loadSettings();
    }
  };

  const saveZone = async (z: any) => {
    await fetch(`/api/admin/shipping-zones/${z.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(z),
    });
    await refreshBootstrap();
    notify(`Updated shipping zone: ${z.name}`);
  };

  const gtmId = String(tracking.gtmContainerId || 'GTM-XXXXXXX').trim() || 'GTM-XXXXXXX';
  const generatedHeadSnippet = `<!-- Google Tag Manager -->\n<script async src="https://www.googletagmanager.com/gtm.js?id=${gtmId}"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  window.dataLayer.push({'gtm.start': new Date().getTime(), event: 'gtm.js'});\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n</script>\n<!-- End Google Tag Manager -->`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#1D2327]">Store Settings, GTM & Conversion Webhooks</h1>
        <div className="flex flex-wrap rounded-lg bg-white border border-[#DCDCDE] p-0.5 text-xs">
          {[
            { id: 'general', label: 'General' },
            { id: 'tracking', label: 'Tracking (GTM)' },
            { id: 'webhooks', label: 'Conversion Webhook' },
            { id: 'shipping', label: 'Shipping & Checkout' },
            { id: 'payments', label: 'Payments' },
            { id: 'system', label: 'API Keys & Health' },
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

      {statusMsg && <div className="p-3 rounded-xl bg-[#E6F7EF] border border-[#B6E8D1] text-[#1E9E6A] text-xs font-semibold">{statusMsg}</div>}
      {errMsg && <div className="p-3 rounded-xl bg-[#FFE3DF] border border-[#F8B4AC] text-[#A3271B] text-xs font-semibold">{errMsg}</div>}

      {/* GENERAL SETTINGS */}
      {tab === 'general' && (
        <div className="bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-4 text-xs max-w-3xl">
          <h2 className="font-bold text-sm">Brand & Legal Details (Editable Anytime)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Store Name (English)</label>
              <input type="text" value={general.storeName || ''} onChange={(e) => setGeneral({ ...general, storeName: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Store Name (বাংলা)</label>
              <input type="text" value={general.storeNameBn || ''} onChange={(e) => setGeneral({ ...general, storeNameBn: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Primary Domain</label>
              <input type="text" value={general.domain || ''} onChange={(e) => setGeneral({ ...general, domain: e.target.value })} className="w-full px-3 py-2 rounded-lg border font-mono" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Hotline Number</label>
              <input type="text" value={general.hotline || ''} onChange={(e) => setGeneral({ ...general, hotline: e.target.value })} className="w-full px-3 py-2 rounded-lg border font-mono" />
            </div>
            <div>
              <label className="block font-semibold mb-1">WhatsApp Number (8801...)</label>
              <input type="text" value={general.whatsapp || ''} onChange={(e) => setGeneral({ ...general, whatsapp: e.target.value })} className="w-full px-3 py-2 rounded-lg border font-mono" />
            </div>
            <div>
              <label className="block font-semibold mb-1">VAT BIN / Trade Licence</label>
              <input type="text" value={general.binNumber || ''} onChange={(e) => setGeneral({ ...general, binNumber: e.target.value })} className="w-full px-3 py-2 rounded-lg border font-mono" />
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Store Address</label>
            <input type="text" value={general.address || ''} onChange={(e) => setGeneral({ ...general, address: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
          </div>
          <button type="button" onClick={() => saveSettingKey('general', general)} className="px-4 py-2 rounded-lg bg-[#0E5E6F] text-white font-bold inline-flex items-center gap-1.5">
            <Save className="w-3.5 h-3.5" /> Save General Settings
          </button>
        </div>
      )}

      {/* TRACKING & GTM SETTINGS */}
      {tab === 'tracking' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
          <div className="lg:col-span-7 bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-sm">Google Tag Manager (No-Code Live Injection)</h2>
                <p className="text-[#646970]">Enable GTM and paste your Container ID to automatically inject both head and noscript tags on storefront pages.</p>
              </div>
              <label className="inline-flex items-center gap-2 font-bold">
                <input type="checkbox" checked={Boolean(tracking.gtmEnabled)} onChange={(e) => setTracking({ ...tracking, gtmEnabled: e.target.checked })} />
                Enable GTM
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">GTM Container ID (GTM-XXXXXXX)</label>
                <input
                  type="text"
                  placeholder="GTM-ABC1234"
                  value={tracking.gtmContainerId || ''}
                  onChange={(e) => {
                    const nextId = e.target.value.toUpperCase();
                    setTracking({
                      ...tracking,
                      gtmContainerId: nextId,
                      gtmEnabled: nextId.trim() ? true : tracking.gtmEnabled,
                    });
                  }}
                  className="w-full px-3 py-2 rounded-lg border font-mono uppercase"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">GA4 Measurement ID (Optional Direct)</label>
                <input type="text" placeholder="G-XXXXXXXXXX" value={tracking.ga4Id || ''} onChange={(e) => setTracking({ ...tracking, ga4Id: e.target.value })} className="w-full px-3 py-2 rounded-lg border font-mono" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Meta Pixel ID (Optional Direct)</label>
                <input type="text" placeholder="123456789012345" value={tracking.metaPixelId || ''} onChange={(e) => setTracking({ ...tracking, metaPixelId: e.target.value })} className="w-full px-3 py-2 rounded-lg border font-mono" />
              </div>
              <div>
                <label className="block font-semibold mb-1">TikTok Pixel ID (Optional Direct)</label>
                <input type="text" placeholder="CXXXXXXXXXXXX" value={tracking.tiktokPixelId || ''} onChange={(e) => setTracking({ ...tracking, tiktokPixelId: e.target.value })} className="w-full px-3 py-2 rounded-lg border font-mono" />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#F6F7F7] border space-y-2">
              <div className="font-bold">Google Consent Mode v2 Defaults</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1">analytics_storage</label>
                  <select value={tracking.consentDefaultAnalytics || 'granted'} onChange={(e) => setTracking({ ...tracking, consentDefaultAnalytics: e.target.value })} className="w-full px-2.5 py-1.5 rounded border bg-white">
                    <option value="granted">granted (BD Default)</option>
                    <option value="denied">denied (GDPR Strict)</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1">ad_storage / ad_user_data</label>
                  <select value={tracking.consentDefaultAds || 'granted'} onChange={(e) => setTracking({ ...tracking, consentDefaultAds: e.target.value })} className="w-full px-2.5 py-1.5 rounded border bg-white">
                    <option value="granted">granted (BD Default)</option>
                    <option value="denied">denied (GDPR Strict)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block font-semibold">Custom Head Code Override (Owner-only)</label>
              <textarea
                rows={3}
                value={tracking.overrideHeadCode || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setTracking({
                    ...tracking,
                    overrideHeadCode: val,
                    gtmEnabled: val.trim() ? true : tracking.gtmEnabled,
                  });
                }}
                placeholder="Paste full GTM <script>...</script> snippet or leave blank to use Container ID above"
                className="w-full px-3 py-2 rounded-lg border font-mono text-[11px]"
              />
              <label className="block font-semibold">Custom Body NoScript Override (Owner-only)</label>
              <textarea
                rows={2}
                value={tracking.overrideBodyCode || ''}
                onChange={(e) => setTracking({ ...tracking, overrideBodyCode: e.target.value })}
                placeholder="Optional custom <noscript>...</noscript> tag"
                className="w-full px-3 py-2 rounded-lg border font-mono text-[11px]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button type="button" onClick={() => saveSettingKey('tracking', tracking)} className="px-4 py-2 rounded-lg bg-[#0E5E6F] text-white font-bold inline-flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> Save &amp; Activate Tracking Live
              </button>
              <button type="button" onClick={verifyStorefrontGtm} className="px-3.5 py-2 rounded-lg border border-[#DCDCDE] bg-white text-[#1D2327] font-semibold hover:bg-[#F6F7F7]">
                Verify Storefront HTML
              </button>
              <span className={`text-xs font-semibold ${tracking.gtmEnabled ? 'text-[#1E9E6A]' : 'text-[#646970]'}`}>
                {tracking.gtmEnabled ? 'Active on storefront' : 'Paused'}
              </span>
            </div>

            {verifyStatus && (
              <div className={`p-3 rounded-lg border text-xs font-semibold ${verifyStatus.ok ? 'bg-[#E6F7EF] border-[#B6E8D1] text-[#1E9E6A]' : 'bg-[#FFE3DF] border-[#F8B4AC] text-[#A3271B]'}`}>
                {verifyStatus.msg}
              </div>
            )}
          </div>

          <div className="lg:col-span-5 bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-3">
            <h2 className="font-bold text-sm">Auto-Generated GTM Code Preview</h2>
            <p className="text-[#646970]">Rendered server-side directly into storefront &lt;head&gt; &amp; &lt;body&gt; for Google Tag Assistant:</p>
            <pre className="p-3 rounded-lg bg-[#1D2327] text-emerald-300 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap">{generatedHeadSnippet}</pre>
            <div className="p-3 rounded-lg bg-[#EEF5F5] border border-[#D3E3E5] space-y-1">
              <div className="font-bold text-[#0E5E6F]">Full GA4 DataLayer Ready</div>
              <p>Pushes <code>page_view</code>, <code>view_item_list</code>, <code>view_item</code>, <code>add_to_cart</code>, <code>remove_from_cart</code>, <code>view_cart</code>, <code>begin_checkout</code>, <code>add_shipping_info</code>, <code>add_payment_info</code>, and reload-guarded <code>purchase</code> with <code>event_id</code>.</p>
            </div>
          </div>
        </div>
      )}

      {/* CONVERSION WEBHOOK ON ORDER CONFIRMATION (SECTION 9.4) */}
      {tab === 'webhooks' && (
        <div className="space-y-5 text-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <form onSubmit={addWebhookEndpoint} className="lg:col-span-5 bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-3">
              <h2 className="font-bold text-sm flex items-center gap-1.5"><Webhook className="w-4 h-4 text-[#0E5E6F]" /> Add Conversion Webhook Endpoint</h2>
              <p className="text-[#646970]">Fires <strong>ONLY when an order is Confirmed</strong> by staff (or PurchaseConfirmed). Signed with HMAC-SHA256 in <code>X-Store-Signature</code>.</p>
              <input type="text" required placeholder="Endpoint Label" value={newEp.name} onChange={(e) => setNewEp({ ...newEp, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
              <input type="url" required placeholder="https://your-sgtm-or-webhook.com/purchase" value={newEp.url} onChange={(e) => setNewEp({ ...newEp, url: e.target.value })} className="w-full px-3 py-2 rounded-lg border font-mono" />
              <label className="flex items-center gap-2 font-semibold">
                <input type="checkbox" checked={newEp.include_hashed_pii} onChange={(e) => setNewEp({ ...newEp, include_hashed_pii: e.target.checked })} />
                Include SHA-256 hashed PII (em, ph, fn, ct, country) for Meta CAPI / Google EC
              </label>
              <button type="submit" className="w-full py-2 rounded-lg bg-[#0E5E6F] text-white font-bold">Add HTTPS Endpoint</button>
            </form>

            <div className="lg:col-span-7 bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm">Configured Endpoints ({webhooks.endpoints.length})</h2>
                <button type="button" onClick={testWebhooks} className="px-3 py-1.5 rounded-lg bg-[#0E5E6F] text-white font-bold inline-flex items-center gap-1">
                  <Send className="w-3.5 h-3.5" /> Send Test Purchase Event
                </button>
              </div>
              <div className="divide-y">
                {webhooks.endpoints.map((ep) => (
                  <div key={ep.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold">{ep.name}</div>
                      <div className="font-mono text-[11px] text-[#0E5E6F] truncate">{ep.url}</div>
                      <div className="text-[10px] text-[#646970] font-mono">Secret: {ep.secret.slice(0, 12)}•••• · Events: {(ep.events || []).join(', ')}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => toggleEndpoint(ep)} className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${ep.enabled ? 'bg-[#E6F7EF] text-[#1E9E6A]' : 'bg-gray-100 text-gray-500'}`}>
                        {ep.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                      <button type="button" onClick={() => deleteEndpoint(ep.id)} className="text-[#A3271B]" aria-label="Delete endpoint"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#DCDCDE] overflow-x-auto">
            <div className="p-4 border-b font-bold text-sm">Webhook Delivery & Retry Logs</div>
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F6F7F7] border-b text-[#646970]">
                <tr><th className="p-3">Time</th><th className="p-3">Event & ID</th><th className="p-3">Endpoint</th><th className="p-3">HTTP</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y">
                {webhooks.deliveries.map((d) => (
                  <tr key={d.id}>
                    <td className="p-3">{String(d.created_at).slice(0, 19)}</td>
                    <td className="p-3"><div className="font-bold">{d.event_name}</div><div className="font-mono text-[10px] text-[#646970]">{d.event_id}</div></td>
                    <td className="p-3 font-mono text-[11px] max-w-[220px] truncate">{d.endpoint_url}</td>
                    <td className="p-3 font-mono">{d.http_status || 'Err'} ({d.duration_ms}ms)</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${d.status === 'delivered' ? 'bg-[#E6F7EF] text-[#1E9E6A]' : 'bg-[#FFE3DF] text-[#A3271B]'}`}>
                        {d.status} (try {d.attempts})
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1 whitespace-nowrap">
                      <button type="button" onClick={() => setPayloadModal(d)} className="px-2 py-1 rounded border inline-flex items-center gap-1"><Eye className="w-3 h-3" /> Payload</button>
                      <button type="button" onClick={() => retryDelivery(d.id)} className="px-2 py-1 rounded border inline-flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Retry</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SHIPPING ZONES */}
      {tab === 'shipping' && (
        <div className="bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-4 text-xs">
          <h2 className="font-bold text-sm">Bangladesh 64-District Shipping Zone Rates</h2>
          <div className="space-y-3">
            {shippingZones.map((z, idx) => (
              <div key={z.id} className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end p-3 rounded-lg bg-[#F9FAFB] border">
                <div className="sm:col-span-2">
                  <div className="font-bold text-sm">{z.name}</div>
                  <div className="text-[#646970]">{z.name_bn}</div>
                </div>
                <div>
                  <label className="block mb-1">Base Fee (৳)</label>
                  <input type="number" value={z.base_fee} onChange={(e) => {
                    const next = [...shippingZones];
                    next[idx] = { ...z, base_fee: Number(e.target.value) };
                    setShippingZones(next);
                  }} className="w-full px-2.5 py-1.5 rounded border bg-white" />
                </div>
                <div>
                  <label className="block mb-1">Free Above (৳)</label>
                  <input type="number" value={z.free_threshold} onChange={(e) => {
                    const next = [...shippingZones];
                    next[idx] = { ...z, free_threshold: Number(e.target.value) };
                    setShippingZones(next);
                  }} className="w-full px-2.5 py-1.5 rounded border bg-white" />
                </div>
                <div>
                  <label className="block mb-1">ETA</label>
                  <input type="text" value={z.eta} onChange={(e) => {
                    const next = [...shippingZones];
                    next[idx] = { ...z, eta: e.target.value };
                    setShippingZones(next);
                  }} className="w-full px-2.5 py-1.5 rounded border bg-white" />
                </div>
                <button type="button" onClick={() => saveZone(z)} className="px-3 py-1.5 rounded-lg bg-[#0E5E6F] text-white font-bold">Save</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PAYMENTS */}
      {tab === 'payments' && (
        <div className="bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-4 text-xs max-w-3xl">
          <h2 className="font-bold text-sm">Bangladesh Payment Gateways (Sandbox & Live)</h2>
          {['cod', 'bkash', 'nagad', 'sslcommerz', 'bankTransfer'].map((g) => (
            <div key={g} className="p-3 rounded-lg border flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-bold uppercase text-sm">{g === 'cod' ? 'Cash on Delivery (COD)' : g}</div>
                <div className="text-[#646970]">Mode: {payments[g]?.sandbox ? 'Sandbox Simulator' : g === 'cod' ? 'Active' : 'Live'}</div>
              </div>
              <label className="inline-flex items-center gap-2 font-bold">
                <input
                  type="checkbox"
                  checked={Boolean(payments[g]?.enabled)}
                  onChange={(e) => setPayments({ ...payments, [g]: { ...(payments[g] || {}), enabled: e.target.checked } })}
                /> Enabled at Checkout
              </label>
            </div>
          ))}
          <button type="button" onClick={() => saveSettingKey('payments', payments)} className="px-4 py-2 rounded-lg bg-[#0E5E6F] text-white font-bold inline-flex items-center gap-1.5">
            <Save className="w-3.5 h-3.5" /> Save Payment Config
          </button>
        </div>
      )}

      {/* API KEYS & SYSTEM HEALTH */}
      {tab === 'system' && system && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
          <div className="lg:col-span-7 bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-4">
            <h2 className="font-bold text-sm flex items-center gap-1.5"><Key className="w-4 h-4 text-[#0E5E6F]" /> REST API Keys (/api/v1)</h2>
            <form onSubmit={generateApiKey} className="flex gap-2">
              <input type="text" placeholder="Key label (e.g. Mobile App / ERP)" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border" />
              <button type="submit" className="px-4 py-2 rounded-lg bg-[#0E5E6F] text-white font-bold">Generate Key</button>
            </form>
            {createdKey && (
              <div className="p-3 rounded-lg bg-[#E6F7EF] border border-[#B6E8D1] font-mono break-all">
                Copy now (shown once): <strong>{createdKey}</strong>
              </div>
            )}
            <div className="divide-y">
              {system.apiKeys.map((k: any) => (
                <div key={k.id} className="py-2 flex justify-between">
                  <div><div className="font-bold">{k.name}</div><div className="font-mono text-[#646970]">{k.key_prefix}••••••••</div></div>
                  <span className="px-2 py-0.5 rounded-full bg-[#E6F7EF] text-[#1E9E6A] text-[10px] font-bold h-fit">ACTIVE</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-3">
            <h2 className="font-bold text-sm flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-[#1E9E6A]" /> System Health & Backup</h2>
            <div className="space-y-1.5">
              <div className="flex justify-between"><span>Runtime</span><strong className="font-mono">{system.nodeVersion}</strong></div>
              <div className="flex justify-between"><span>Uptime</span><strong className="tabular-nums">{system.uptimeSec}s</strong></div>
              <div className="flex justify-between"><span>SQLite DB Size</span><strong className="tabular-nums">{Math.round(system.dbSizeBytes / 1024)} KB</strong></div>
            </div>
            <a href="/api/admin/system/backup" className="w-full py-2.5 rounded-lg bg-[#0E5E6F] text-white font-bold flex items-center justify-center gap-1.5">
              <Download className="w-4 h-4" /> Download SQLite Backup (.db)
            </a>
          </div>
        </div>
      )}

      {payloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPayloadModal(null)}>
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 space-y-3 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm">Conversion Webhook Payload — {payloadModal.event_id}</h3>
              <button type="button" onClick={() => setPayloadModal(null)} className="text-xs font-semibold">Close</button>
            </div>
            <pre className="p-3 rounded-lg bg-[#1D2327] text-emerald-300 text-[11px] font-mono overflow-x-auto">{payloadModal.payload}</pre>
            <div className="text-xs font-semibold">Response (HTTP {payloadModal.http_status}):</div>
            <pre className="p-3 rounded-lg bg-gray-100 text-[11px] font-mono overflow-x-auto">{payloadModal.response_body || 'No response body'}</pre>
          </div>
        </div>
      )}
    </div>
  );
};
