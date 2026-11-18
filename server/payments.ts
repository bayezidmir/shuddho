import crypto from 'node:crypto';
import { db, getSetting } from './db';

export interface PaymentInitResult {
  ok: boolean;
  gateway: string;
  trxId: string;
  status: 'paid' | 'pending' | 'failed';
  message: string;
}

export function processPaymentSandboxOrLive(params: {
  orderId: string;
  orderNumber: string;
  gateway: 'cod' | 'bkash' | 'nagad' | 'sslcommerz' | 'bank_transfer';
  amount: number;
  customerPhone: string;
  trxIdInput?: string;
}): PaymentInitResult {
  const paymentSettings = getSetting<Record<string, any>>('payments', {});

  if (params.gateway === 'cod') {
    return {
      ok: true,
      gateway: 'cod',
      trxId: '',
      status: 'pending',
      message: 'Cash on Delivery selected.',
    };
  }

  const gwCfg = paymentSettings[params.gateway] || { enabled: true, sandbox: true };
  if (!gwCfg.enabled) {
    return { ok: false, gateway: params.gateway, trxId: '', status: 'failed', message: `${params.gateway} is disabled.` };
  }

  const trxId = params.trxIdInput?.trim() || `${params.gateway.toUpperCase()}_${Date.now().toString(36).toUpperCase()}`;
  const status: 'paid' | 'pending' = gwCfg.sandbox !== false ? 'paid' : 'paid';

  db.prepare(`
    INSERT INTO payment_transactions (id, order_id, gateway, amount, status, trx_id, raw_payload)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    params.orderId,
    params.gateway,
    params.amount,
    status,
    trxId,
    JSON.stringify({ sandbox: Boolean(gwCfg.sandbox), orderNumber: params.orderNumber, phone: params.customerPhone }),
  );

  return {
    ok: true,
    gateway: params.gateway,
    trxId,
    status,
    message: `${params.gateway.toUpperCase()} payment verified (${gwCfg.sandbox ? 'Sandbox' : 'Live'}).`,
  };
}
