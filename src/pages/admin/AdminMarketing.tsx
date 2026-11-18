import React, { useEffect, useState } from 'react';
import { Tag, Copy, Send, Link2, Trash2 } from 'lucide-react';
import { formatBDT } from '../../lib/bd-validation';

export const AdminMarketing: React.FC = () => {
  const [data, setData] = useState<any | null>(null);
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percentage' | 'fixed' | 'free_shipping'>('percentage');
  const [value, setValue] = useState(10);
  const [minSpend, setMinSpend] = useState(500);
  const [utmSource, setUtmSource] = useState('facebook');
  const [utmCampaign, setUtmCampaign] = useState('winter_honey');
  const [smsText, setSmsText] = useState('Assalamu Alaikum {name}! Enjoy 10% off pure Sundarban Honey at Shuddho. Use code PURE10.');
  const [smsStatus, setSmsStatus] = useState('');
  const [copied, setCopied] = useState('');

  const load = async () => {
    const r = await fetch('/api/admin/marketing');
    if (r.ok) setData(await r.json());
  };

  useEffect(() => {
    load();
  }, []);

  const createCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, type, value, min_spend: minSpend }),
    });
    if (r.ok) {
      setCode('');
      load();
    }
  };

  const deleteCoupon = async (id: string) => {
    await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' });
    load();
  };

  const sendCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch('/api/admin/campaigns/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segment: 'all_active', message: smsText }),
    });
    if (r.ok) {
      const d = await r.json();
      setSmsStatus(`Campaign queued & sent to ${d.sent} non-blocked customers.`);
      load();
    }
  };

  const copyLink = (txt: string) => {
    navigator.clipboard?.writeText(txt);
    setCopied(txt);
    setTimeout(() => setCopied(''), 2000);
  };

  if (!data) return <div className="h-64 bg-white rounded-xl animate-pulse" />;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://shuddho.com.bd';
  const builtUtm = `${origin}/?utm_source=${encodeURIComponent(utmSource)}&utm_campaign=${encodeURIComponent(utmCampaign)}&coupon=PURE10`;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-[#1D2327]">Marketing, Coupons, Feeds & Campaigns</h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Coupons */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-4">
          <h2 className="font-bold text-sm flex items-center gap-2"><Tag className="w-4 h-4 text-[#0E5E6F]" /> Discount Coupons</h2>
          <form onSubmit={createCoupon} className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <input type="text" required placeholder="CODE (e.g. EID15)" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="px-2.5 py-1.5 rounded-lg border font-mono uppercase" />
            <select value={type} onChange={(e) => setType(e.target.value as any)} className="px-2.5 py-1.5 rounded-lg border">
              <option value="percentage">% Off</option>
              <option value="fixed">৳ Fixed</option>
              <option value="free_shipping">Free Ship</option>
            </select>
            <input type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} placeholder="Value" className="px-2.5 py-1.5 rounded-lg border" />
            <input type="number" value={minSpend} onChange={(e) => setMinSpend(Number(e.target.value))} placeholder="Min ৳" className="px-2.5 py-1.5 rounded-lg border" />
            <button type="submit" className="px-3 py-1.5 rounded-lg bg-[#0E5E6F] text-white font-bold">Add Coupon</button>
          </form>

          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F7F7] border-b text-[#646970]">
              <tr><th className="p-2.5">Code</th><th className="p-2.5">Discount</th><th className="p-2.5">Min Spend</th><th className="p-2.5 text-right">Share Link</th></tr>
            </thead>
            <tbody className="divide-y">
              {data.coupons.map((c: any) => (
                <tr key={c.id}>
                  <td className="p-2.5 font-mono font-bold text-[#0E5E6F]">{c.code}</td>
                  <td className="p-2.5">{c.type === 'percentage' ? `${c.value}%` : c.type === 'free_shipping' ? 'Free Shipping' : formatBDT(c.value)}</td>
                  <td className="p-2.5 tabular-nums">{formatBDT(c.min_spend)}</td>
                  <td className="p-2.5 text-right space-x-2">
                    <button type="button" onClick={() => copyLink(`${origin}/?coupon=${c.code}`)} className="px-2 py-1 rounded border text-[11px] inline-flex items-center gap-1 hover:bg-[#F6F7F7]">
                      <Copy className="w-3 h-3" /> Copy ?coupon=
                    </button>
                    <button type="button" onClick={() => deleteCoupon(c.id)} className="text-[#A3271B]" aria-label="Delete coupon"><Trash2 className="w-3.5 h-3.5 inline" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Feeds & UTM Builder */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-3 text-xs">
            <h2 className="font-bold text-sm">Catalog Feeds (Meta, TikTok, Google)</h2>
            <div className="space-y-2">
              <div className="p-2.5 rounded-lg bg-[#EEF5F5] flex items-center justify-between gap-2">
                <div><div className="font-bold">Meta / Google Shopping XML</div><div className="font-mono text-[11px] text-[#0E5E6F]">/feeds/meta.xml</div></div>
                <a href="/feeds/meta.xml" target="_blank" rel="noreferrer" className="px-2.5 py-1 rounded bg-white border font-semibold">Open XML</a>
              </div>
              <div className="p-2.5 rounded-lg bg-[#EEF5F5] flex items-center justify-between gap-2">
                <div><div className="font-bold">TikTok Catalog CSV</div><div className="font-mono text-[11px] text-[#0E5E6F]">/feeds/tiktok.csv</div></div>
                <a href="/feeds/tiktok.csv" target="_blank" rel="noreferrer" className="px-2.5 py-1 rounded bg-white border font-semibold">Download CSV</a>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-3 text-xs">
            <h2 className="font-bold text-sm flex items-center gap-1.5"><Link2 className="w-4 h-4 text-[#0E5E6F]" /> UTM Campaign Link Builder</h2>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={utmSource} onChange={(e) => setUtmSource(e.target.value)} placeholder="utm_source" className="px-2.5 py-1.5 rounded border" />
              <input type="text" value={utmCampaign} onChange={(e) => setUtmCampaign(e.target.value)} placeholder="utm_campaign" className="px-2.5 py-1.5 rounded border" />
            </div>
            <div className="p-2.5 rounded bg-[#F6F7F7] font-mono text-[11px] break-all">{builtUtm}</div>
            <button type="button" onClick={() => copyLink(builtUtm)} className="px-3 py-1.5 rounded-lg border font-semibold inline-flex items-center gap-1">
              <Copy className="w-3.5 h-3.5" /> {copied === builtUtm ? 'Copied!' : 'Copy Campaign URL'}
            </button>
          </div>
        </div>
      </div>

      {/* SMS Broadcast Campaign */}
      <form onSubmit={sendCampaign} className="bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-3 text-xs">
        <h2 className="font-bold text-sm flex items-center gap-2"><Send className="w-4 h-4 text-[#0E5E6F]" /> Bulk SMS Promotional Broadcast</h2>
        {smsStatus && <div className="p-2.5 rounded bg-[#E6F7EF] text-[#1E9E6A] font-semibold">{smsStatus}</div>}
        <textarea rows={2} value={smsText} onChange={(e) => setSmsText(e.target.value)} className="w-full px-3 py-2 rounded-lg border" />
        <div className="flex justify-between items-center">
          <span className="text-[#646970]">Sends via configured BD SMS Gateway (Sandbox logs visible in Notifications).</span>
          <button type="submit" className="px-4 py-2 rounded-lg bg-[#0E5E6F] text-white font-bold">Send SMS Broadcast</button>
        </div>
      </form>
    </div>
  );
};
