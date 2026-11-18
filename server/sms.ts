import crypto from 'node:crypto';
import { db, getSetting, decryptSecret } from './db';

export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''));
}

export async function sendSms(params: {
  to: string;
  event: string;
  vars?: Record<string, string | number>;
  customText?: string;
  lang?: 'en' | 'bn';
}) {
  const smsConfig = getSetting<{
    provider: string;
    senderId: string;
    masking: boolean;
    apiKeyEnc: string;
    customUrl?: string;
    balance: number;
  }>('sms', {
    provider: 'sandbox',
    senderId: 'SHUDDHO',
    masking: true,
    apiKeyEnc: '',
    balance: 4820,
  });

  let text = params.customText || '';
  if (!text) {
    const tpl = db.prepare('SELECT * FROM notification_templates WHERE event = ?').get(params.event) as Record<string, any> | undefined;
    if (tpl && !tpl.enabled) {
      return { skipped: true, reason: 'Template disabled' };
    }
    const raw = tpl ? (params.lang === 'bn' ? tpl.body_bn : tpl.body_en) : `Shuddho update: ${params.event}`;
    text = renderTemplate(raw, params.vars || {});
  }

  let status = 'sent';
  let responseBody = JSON.stringify({ sandbox: true, provider: smsConfig.provider, messageId: `sms_${Date.now()}` });

  if (smsConfig.provider !== 'sandbox') {
    const apiKey = decryptSecret(smsConfig.apiKeyEnc);
    try {
      if (smsConfig.provider === 'bulksmsbd' && apiKey) {
        const url = `http://bulksmsbd.net/api/smsapi?api_key=${encodeURIComponent(apiKey)}&type=text&number=${encodeURIComponent(params.to)}&senderid=${encodeURIComponent(smsConfig.senderId)}&message=${encodeURIComponent(text)}`;
        const r = await fetch(url);
        responseBody = (await r.text()).slice(0, 500);
        status = r.ok ? 'sent' : 'failed';
      } else if (smsConfig.provider === 'alpha_sms' && apiKey) {
        const r = await fetch('https://api.sms.net.bd/sendsms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: apiKey, msg: text, to: params.to, sender_id: smsConfig.senderId }),
        });
        responseBody = (await r.text()).slice(0, 500);
        status = r.ok ? 'sent' : 'failed';
      } else if (smsConfig.provider === 'generic_http' && smsConfig.customUrl) {
        const url = smsConfig.customUrl
          .replace('{to}', encodeURIComponent(params.to))
          .replace('{text}', encodeURIComponent(text))
          .replace('{sender}', encodeURIComponent(smsConfig.senderId));
        const r = await fetch(url);
        responseBody = (await r.text()).slice(0, 500);
        status = r.ok ? 'sent' : 'failed';
      }
    } catch (err: any) {
      status = 'failed';
      responseBody = err?.message || 'SMS provider error';
    }
  }

  db.prepare(`
    INSERT INTO notification_logs (id, channel, recipient, event, message, provider, status, response_body)
    VALUES (?, 'sms', ?, ?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), params.to, params.event, text, smsConfig.provider, status, responseBody);

  return { ok: status === 'sent', status, text, provider: smsConfig.provider };
}
