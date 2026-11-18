import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { db, verifyPassword } from './db';
import { hasPermission, type Permission, type StaffRole } from '../src/lib/rbac';

export interface StaffSession {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
}

export interface AuthedRequest extends Request {
  staff?: StaffSession;
}

export function createStaffSession(staffId: string, ip: string, userAgent: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO staff_sessions (token, staff_id, ip, user_agent, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(token, staffId, ip, userAgent, expiresAt);
  db.prepare('UPDATE staff_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(staffId);
  return token;
}

export function getStaffFromToken(token: string | undefined): StaffSession | null {
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.active, s.expires_at
    FROM staff_sessions s
    JOIN staff_users u ON u.id = s.staff_id
    WHERE s.token = ?
  `).get(token) as { id: string; name: string; email: string; role: StaffRole; active: number; expires_at: string } | undefined;

  if (!row || !row.active) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM staff_sessions WHERE token = ?').run(token);
    return null;
  }
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

export function extractBearerOrCookieToken(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  const cookieHeader = req.headers.cookie || '';
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0 && part.slice(0, idx).trim() === 'shuddho_staff_token') {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return undefined;
}

export function requireStaff(permission?: Permission) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const token = extractBearerOrCookieToken(req);
    const staff = getStaffFromToken(token);
    if (!staff) {
      res.status(401).json({ error: 'Authentication required. Please sign in to Admin.' });
      return;
    }
    if (permission && !hasPermission(staff.role, permission)) {
      res.status(403).json({ error: `Permission denied: role '${staff.role}' lacks '${permission}'.` });
      return;
    }
    req.staff = staff;
    next();
  };
}

export function authenticateStaffCredentials(email: string, password: string) {
  const row = db.prepare('SELECT * FROM staff_users WHERE lower(email) = lower(?)').get(email) as {
    id: string;
    name: string;
    email: string;
    password_hash: string;
    role: StaffRole;
    totp_secret: string | null;
    totp_enabled: number;
    active: number;
  } | undefined;

  if (!row || !row.active) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  return row;
}

// RFC 6238 TOTP verification for 2FA
export function generateTotpSecret(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  const bytes = crypto.randomBytes(20);
  for (let i = 0; i < 16; i++) {
    secret += alphabet[bytes[i] % alphabet.length];
  }
  return secret;
}

function base32Decode(str: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of str.toUpperCase().replace(/=+$/, '')) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function computeTotpCode(secret: string, windowOffset = 0): string {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / 30) + windowOffset;
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(code % 1_000_000).padStart(6, '0');
}

export function verifyTotp(secret: string, code: string): boolean {
  const clean = code.trim();
  return [-1, 0, 1].some((offset) => computeTotpCode(secret, offset) === clean);
}

// Simple in-memory sliding window rate limiter
const rateBuckets = new Map<string, number[]>();
export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const list = (rateBuckets.get(key) ?? []).filter((ts) => now - ts < windowMs);
  if (list.length >= maxRequests) {
    rateBuckets.set(key, list);
    return false;
  }
  list.push(now);
  rateBuckets.set(key, list);
  return true;
}
