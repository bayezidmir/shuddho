import React, { useEffect, useState } from 'react';
import { Bell, Send, Save } from 'lucide-react';
import { countSmsParts } from '../../lib/bd-validation';

export const AdminNotifications: React.FC = () => {
  const [data, setData] = useState<any | null>(null);
  const [testTo, setTestTo] = useState('01711482910');
  const [testText, setTestText] = useState('Assalamu Alaikum! Test SMS from Shuddho.');
  const [smsStatus, setSmsStatus] = useState('');

  const load = async () => {
    const r = await fetch('/api/admin/notifications');
    if (r.ok) setData(await r.json());
  };

  useEffect(() => {
    load();
  }, []);

  const saveTemplate = async (tpl: any) => {
    await fetch(`/api/admin/notifications/templates/${tpl.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tpl),
    });
    setSmsStatus(`Saved SMS template "${tpl.event}".`);
    load();
  };

  const sendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch('/api/admin/notifications/test-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: testTo, text: testText }),
    });
    const d = await r.json();
    setSmsStatus(d.ok ? `SMS logged via ${d.provider}` : d.error || 'Failed');
    load();
  };

  if (!data) return <div className="h-64 bg-white rounded-xl animate-pulse" />;

  const partInfo = countSmsParts(testText);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1D2327]">Notifications & Bangladesh SMS Gateway</h1>
          <p className="text-xs text-[#646970]">Provider: <strong className="uppercase">{data.smsSettings?.provider || 'sandbox'}</strong> · Remaining Credit: <strong>{data.smsSettings?.balance || 4820} SMS</strong></p>
        </div>
      </div>

      {smsStatus && <div className="p-3 rounded-xl bg-[#E6F7EF] text-[#1E9E6A] text-xs font-semibold">{smsStatus}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 space-y-3">
          {data.templates.map((tpl: any, idx: number) => (
            <div key={tpl.id} className="bg-white rounded-xl border border-[#DCDCDE] p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase text-[#0E5E6F] flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" /> {tpl.event.replace(/_/g, ' ')}</span>
                <label className="inline-flex items-center gap-1.5 font-semibold">
                  <input
                    type="checkbox"
                    checked={Boolean(tpl.enabled)}
                    onChange={(e) => {
                      const next = [...data.templates];
                      next[idx] = { ...tpl, enabled: e.target.checked ? 1 : 0 };
                      setData({ ...data, templates: next });
                    }}
                  /> Active
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-[#646970] mb-1">English Template</label>
                  <textarea
                    rows={2}
                    value={tpl.body_en}
                    onChange={(e) => {
                      const next = [...data.templates];
                      next[idx] = { ...tpl, body_en: e.target.value };
                      setData({ ...data, templates: next });
                    }}
                    className="w-full px-2.5 py-1.5 rounded border"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#646970] mb-1">Bangla Template</label>
                  <textarea
                    rows={2}
                    value={tpl.body_bn}
                    onChange={(e) => {
                      const next = [...data.templates];
                      next[idx] = { ...tpl, body_bn: e.target.value };
                      setData({ ...data, templates: next });
                    }}
                    className="w-full px-2.5 py-1.5 rounded border"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={() => saveTemplate(tpl)} className="px-3 py-1 rounded bg-[#0E5E6F] text-white font-semibold inline-flex items-center gap-1">
                  <Save className="w-3 h-3" /> Save Template
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-5 space-y-4">
          <form onSubmit={sendTest} className="bg-white rounded-xl border border-[#DCDCDE] p-5 space-y-3 text-xs">
            <h2 className="font-bold text-sm flex items-center gap-1.5"><Send className="w-4 h-4 text-[#0E5E6F]" /> Test SMS & Unicode Part Calculator</h2>
            <input type="tel" required value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="017XXXXXXXX" className="w-full px-3 py-2 rounded-lg border font-mono" />
            <textarea rows={3} value={testText} onChange={(e) => setTestText(e.target.value)} className="w-full px-3 py-2 rounded-lg border" />
            <div className="flex justify-between text-[11px] text-[#646970]">
              <span>Encoding: <strong>{partInfo.encoding}</strong> ({partInfo.chars} chars)</span>
              <span>SMS Parts: <strong>{partInfo.parts}</strong></span>
            </div>
            <button type="submit" className="w-full py-2 rounded-lg bg-[#0E5E6F] text-white font-bold">Send Test SMS</button>
          </form>

          <div className="bg-white rounded-xl border border-[#DCDCDE] p-4 space-y-2 text-xs">
            <h2 className="font-bold text-sm">Recent SMS Delivery Logs</h2>
            <div className="max-h-72 overflow-y-auto divide-y">
              {data.logs.map((l: any) => (
                <div key={l.id} className="py-2">
                  <div className="flex justify-between font-semibold">
                    <span className="font-mono">{l.recipient}</span>
                    <span className="uppercase text-[10px] text-[#1E9E6A]">{l.provider} · {l.status}</span>
                  </div>
                  <div className="text-[#646970] text-[11px] mt-0.5">{l.message}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
