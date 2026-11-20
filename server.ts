import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { DISTRICT_PRICE_TRENDS } from './src/data/mockData';
import {
  AccountStatus,
  AuthRole,
  DbUser,
  PRIMARY_ADMIN_EMAIL,
  getDb,
  getSystemSettings,
  isAdminRole,
  rowToDbUser,
  updateSystemSettings,
  writeAuditLog,
} from './server/store';
import { isEmailProviderConfigured, sendVerificationOtpEmail } from './server/mailer';
import {
  applyOfficialWatermarkFromOriginal,
  ensureMediaDirectories,
  sanitizeWatermarkSettings,
  storeUploadedPropertyImage,
} from './server/watermark';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getArgValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  const eqArg = process.argv.find((a) => a.startsWith(`${flag}=`));
  return eqArg ? eqArg.split('=')[1] : undefined;
}

const cliPort = getArgValue('--port');
const PORT = cliPort
  ? parseInt(cliPort, 10)
  : process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : 3000;
const HOST = getArgValue('--host') || '0.0.0.0';

// Cryptographic session signing key from env, with ephemeral in-memory CSPRNG fallback (never written to disk)
const AUTH_SESSION_SECRET =
  process.env.AUTH_SESSION_SECRET?.trim() || crypto.randomBytes(32).toString('hex');

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TTL_SHORT_MS = 24 * 60 * 60 * 1000; // 24 hours
const REFRESH_TTL_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const REFRESH_COOKIE_NAME = 'gh_rt';

function sha256Hex(val: string): string {
  return crypto.createHash('sha256').update(val).digest('hex');
}

function constantTimeEqualHex(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim().slice(0, 64);
  }
  return String(req.ip || req.socket.remoteAddress || 'unknown').slice(0, 64);
}

function parseCookies(req: Request): Record<string, string> {
  const raw = req.headers.cookie;
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

function isHttpsRequest(req: Request): boolean {
  if (req.secure) return true;
  const proto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  return proto === 'https';
}

function setRefreshCookie(req: Request, res: Response, refreshToken: string, maxAgeMs: number): void {
  const maxAgeSec = Math.max(60, Math.floor(maxAgeMs / 1000));
  const attrs = [
    `${REFRESH_COOKIE_NAME}=${encodeURIComponent(refreshToken)}`,
    'Path=/api/v1/auth',
    'HttpOnly',
    `Max-Age=${maxAgeSec}`,
  ];
  if (isHttpsRequest(req)) {
    attrs.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    attrs.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearRefreshCookie(req: Request, res: Response): void {
  const attrs = [
    `${REFRESH_COOKIE_NAME}=`,
    'Path=/api/v1/auth',
    'HttpOnly',
    'Max-Age=0',
  ];
  if (isHttpsRequest(req)) {
    attrs.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    attrs.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function safeParseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function csvSafeCell(val: unknown): string {
  let str = String(val ?? '');
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

// Initialize SQLite database & media folders cleanly on startup (non-destructive)
getDb();
ensureMediaDirectories();

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '20mb' }));
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Vary', 'Origin');
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// Lazy-load Gemini SDK so server binds port 3000 immediately on cold start
const apiKey = process.env.GEMINI_API_KEY || '';
let cachedAi: unknown = null;
async function getAiClient() {
  if (!apiKey) return null;
  if (cachedAi) return cachedAi;
  const { GoogleGenAI } = await import('@google/genai');
  cachedAi = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return cachedAi;
}

// ============================================================================
// AUTHENTICATION & AUTHORIZATION MIDDLEWARE (Backend Source of Truth)
// ============================================================================

interface AuthenticatedContext {
  user: DbUser;
  sessionId: string;
  tokenExpiresAt: string;
}

interface AuthedRequest extends Request {
  auth?: AuthenticatedContext;
}

function issueSignedSessionToken(sessionId: string, userId: string): string {
  const nonce = crypto.randomBytes(24).toString('base64url');
  const payload = `${sessionId}.${userId}.${nonce}`;
  const sig = crypto
    .createHmac('sha256', AUTH_SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyTokenFormat(token: string): { sessionId: string; userId: string } | null {
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [sessionId, userId, nonce, sig] = parts;
  if (!sessionId || !userId || !nonce || !sig) return null;
  const payload = `${sessionId}.${userId}.${nonce}`;
  const expected = crypto
    .createHmac('sha256', AUTH_SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  if (!constantTimeEqualHex(sig, expected)) return null;
  return { sessionId, userId };
}

function resolveAuthFromHeader(
  req: Request
): { ok: true; ctx: AuthenticatedContext } | { ok: false; code?: string; message?: string } {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return { ok: false };
  }
  const token = header.slice(7).trim();
  const parsed = verifyTokenFormat(token);
  if (!parsed) return { ok: false };

  const db = getDb();
  const tokenHash = sha256Hex(token);
  const sessRow = db
    .prepare(
      `SELECT id, user_id, expires_at, revoked_at
       FROM sessions
       WHERE id = ? AND token_hash = ?`
    )
    .get(parsed.sessionId, tokenHash) as Record<string, unknown> | undefined;

  if (!sessRow) return { ok: false };

  const userRow = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(String(sessRow.user_id)) as Record<string, unknown> | undefined;

  if (!userRow) return { ok: false };
  const user = rowToDbUser(userRow);

  if (user.status === 'blocked') {
    db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(
      new Date().toISOString(),
      user.id
    );
    return {
      ok: false,
      code: 'ACCOUNT_BLOCKED',
      message: 'Your account has been blocked by the administrator.',
    };
  }

  if (sessRow.revoked_at) return { ok: false, code: 'SESSION_REVOKED' };
  if (new Date(String(sessRow.expires_at)).getTime() <= Date.now()) {
    return { ok: false, code: 'ACCESS_TOKEN_EXPIRED' };
  }

  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    String(sessRow.id)
  );

  return {
    ok: true,
    ctx: {
      user,
      sessionId: String(sessRow.id),
      tokenExpiresAt: String(sessRow.expires_at),
    },
  };
}

function attachOptionalAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const resolved = resolveAuthFromHeader(req);
  req.auth = resolved.ok ? resolved.ctx : undefined;
  next();
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const resolved = resolveAuthFromHeader(req);
  if (!resolved.ok) {
    if (resolved.code === 'ACCOUNT_BLOCKED') {
      res.status(403).json({
        error: resolved.message || 'Your account has been blocked by the administrator.',
        code: 'ACCOUNT_BLOCKED',
      });
      return;
    }
    res.status(401).json({
      error: 'Authentication required. Please sign in with your email address.',
      code: resolved.code || 'UNAUTHORIZED',
    });
    return;
  }
  req.auth = resolved.ctx;
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  let ctx = req.auth;
  if (!ctx) {
    const resolved = resolveAuthFromHeader(req);
    if (!resolved.ok) {
      res.status(resolved.code === 'ACCOUNT_BLOCKED' ? 403 : 401).json({
        error: resolved.message || 'Authentication required.',
        code: resolved.code || 'UNAUTHORIZED',
      });
      return;
    }
    ctx = resolved.ctx;
    req.auth = ctx;
  }

  if (!isAdminRole(ctx.user.role) || ctx.user.status !== 'active') {
    writeAuditLog({
      actorUserId: ctx.user.id,
      actorUsername: ctx.user.email || ctx.user.username,
      actorPhone: ctx.user.phoneE164,
      actorRole: ctx.user.role,
      action: 'admin.unauthorized_attempt',
      target: req.originalUrl,
      details: `Blocked ${req.method} ${req.originalUrl} for non-admin account ${ctx.user.email || ctx.user.id}`,
      ipAddress: getClientIp(req),
    });
    res.status(403).json({
      error: 'Forbidden: Administrator privileges required.',
      code: 'ADMIN_REQUIRED',
    });
    return;
  }
  next();
}

// ============================================================================
// HELPER SERIALIZERS & IMAGE PIPELINE
// ============================================================================

async function normalizeAndWatermarkListingImages(
  rawImages: unknown,
  uploaderUserId: string
): Promise<{ publicUrls: string[]; originalPaths: string[] }> {
  const inputList = Array.isArray(rawImages) ? rawImages.slice(0, 10) : [];
  const settings = getSystemSettings();
  const db = getDb();
  const publicUrls: string[] = [];
  const originalPaths: string[] = [];

  for (const item of inputList) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('data:image/')) {
      const stored = await storeUploadedPropertyImage(trimmed, settings.watermark);
      db.prepare(
        `INSERT INTO media_assets (
          id, uploaded_by_user_id, original_path, watermarked_path, mime_type,
          width, height, watermarked, watermark_position, watermark_opacity, watermark_variant, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        stored.mediaId,
        uploaderUserId,
        stored.originalPath,
        stored.watermarkedPath,
        stored.mimeType,
        stored.width,
        stored.height,
        stored.watermarked ? 1 : 0,
        settings.watermark.position,
        settings.watermark.opacity,
        settings.watermark.variant,
        new Date().toISOString()
      );
      publicUrls.push(`/api/v1/media/${stored.mediaId}`);
      originalPaths.push(stored.originalPath);
    } else if (/^\/api\/v1\/media\/[a-zA-Z0-9_\-]+$/.test(trimmed) || /^https?:\/\//i.test(trimmed)) {
      publicUrls.push(trimmed.slice(0, 1000));
    }
  }

  return { publicUrls, originalPaths };
}

function serializeListingRow(row: Record<string, unknown>) {
  const images = safeParseJson<string[]>(row.images_json, []);
  const amenities = safeParseJson<string[]>(row.amenities_json, []);
  const supportPhone = getSystemSettings().supportPhone || '+252636786709';
  const broker = safeParseJson<Record<string, unknown>>(row.broker_json, {
    id: String(row.owner_user_id || ''),
    name: 'GuriHel Verified Agent',
    agency: 'GuriHel Marketplace',
    phone: supportPhone,
    whatsapp: supportPhone.replace(/^\+/, ''),
    license: 'GURIHEL-SL',
    district: String(row.district || 'Hargeisa'),
    avatar: '/assets/aistudio/GuriHel-app-icon-rounded_1e742137.png',
    rating: 5,
    activeListingsCount: 0,
    verified: Boolean(row.verified),
  });

  return {
    id: String(row.id),
    ownerUid: String(row.owner_user_id),
    title: String(row.title),
    description: String(row.description || ''),
    purpose: String(row.purpose),
    property_type: String(row.property_type),
    price: Number(row.price || 0),
    currency: String(row.currency || 'USD'),
    price_unit: String(row.price_unit || 'total'),
    area_m2: Number(row.area_m2 || 0),
    bedrooms: Number(row.bedrooms || 0),
    living_rooms: Number(row.living_rooms || 1),
    bathrooms: Number(row.bathrooms || 1),
    city: String(row.city || 'Hargeisa'),
    district: String(row.district || 'Jigjiga Yar'),
    address: String(row.address || ''),
    lat: Number(row.lat || 9.558),
    lng: Number(row.lng || 44.068),
    verified: Boolean(row.verified),
    featured: Boolean(row.featured),
    status: String(row.status),
    images,
    amenities,
    broker,
    createdAt: String(row.created_at),
    views: Number(row.views || 0),
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : undefined,
  };
}

function serializeProjectRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name),
    developerName: String(row.developer_name),
    developerLogo: String(row.developer_logo || '/assets/aistudio/GuriHel-mark_d2d21036.png'),
    city: String(row.city || 'Hargeisa'),
    district: String(row.district || ''),
    address: String(row.address || ''),
    stage: String(row.stage || 'off_plan'),
    startingPrice: Number(row.starting_price || 0),
    currency: 'USD' as const,
    types: safeParseJson<string[]>(row.types_json, []),
    heroImage: String(row.hero_image || '/assets/aistudio/GuriHel-app-icon-512-square_b480890b.png'),
    featured: Boolean(row.featured),
    handoverDate: String(row.handover_date || ''),
    units: safeParseJson(row.units_json, []),
    description: String(row.description || ''),
    leadsCount: Number(row.leads_count || 0),
    progressPercent: Number(row.progress_percent || 0),
  };
}

// ============================================================================
// 1. EMAIL-FIRST PASSWORDLESS OTP AUTHENTICATION (/api/v1/auth/*)
// ============================================================================

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const OTP_RESEND_COOLDOWN_MS = 45 * 1000; // 45 seconds
const OTP_MAX_ATTEMPTS = 5;

function normalizeEmail(raw: unknown): string {
  return String(raw || '').trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return email.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hmacOtpHash(email: string, otpId: string, code: string): string {
  return crypto
    .createHmac('sha256', AUTH_SESSION_SECRET)
    .update(`${email}:${otpId}:${code}`)
    .digest('hex');
}

function checkRateLimit(
  rateKey: string,
  maxAttempts: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const db = getDb();
  const nowMs = Date.now();
  const row = db
    .prepare('SELECT window_start, count, locked_until FROM auth_rate_limits WHERE rate_key = ?')
    .get(rateKey) as { window_start: number; count: number; locked_until: number } | undefined;

  if (!row) return { ok: true };
  if (row.locked_until > nowMs) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((row.locked_until - nowMs) / 1000)),
    };
  }
  if (nowMs - row.window_start <= windowMs && row.count >= maxAttempts) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (nowMs - row.window_start)) / 1000)),
    };
  }
  return { ok: true };
}

function recordRateLimitHit(
  rateKey: string,
  maxAttempts: number,
  windowMs: number,
  lockDurationMs: number
): void {
  const db = getDb();
  const nowMs = Date.now();
  const prev = db
    .prepare('SELECT window_start, count FROM auth_rate_limits WHERE rate_key = ?')
    .get(rateKey) as { window_start: number; count: number } | undefined;

  const withinWindow = prev && nowMs - prev.window_start <= windowMs;
  const nextWindow = withinWindow ? prev.window_start : nowMs;
  const nextCount = withinWindow ? prev.count + 1 : 1;
  const lockedUntil = nextCount >= maxAttempts ? nowMs + lockDurationMs : 0;

  db.prepare(
    `INSERT OR REPLACE INTO auth_rate_limits (rate_key, window_start, count, locked_until)
     VALUES (?, ?, ?, ?)`
  ).run(rateKey, nextWindow, nextCount, lockedUntil);
}

function clearRateLimit(rateKey: string): void {
  getDb().prepare('DELETE FROM auth_rate_limits WHERE rate_key = ?').run(rateKey);
}

function issueUserSession(params: {
  req: Request;
  res: Response;
  user: DbUser;
  rememberMe: boolean;
  deviceLabel?: string;
}) {
  const { req, res, user, rememberMe, deviceLabel } = params;
  const db = getDb();
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const sessionId = `ses_${nowMs.toString(36)}_${crypto.randomBytes(6).toString('hex')}`;
  const rawAccessToken = issueSignedSessionToken(sessionId, user.id);
  const rawRefreshToken = `rt_${crypto.randomBytes(32).toString('base64url')}`;
  const accessExpiresAt = new Date(nowMs + ACCESS_TOKEN_TTL_MS).toISOString();
  const refreshTtlMs = rememberMe ? REFRESH_TTL_REMEMBER_MS : REFRESH_TTL_SHORT_MS;
  const refreshExpiresAt = new Date(nowMs + refreshTtlMs).toISOString();

  db.prepare(
    `INSERT INTO sessions (
      id, user_id, username, phone_e164, role, token_hash, refresh_token_hash,
      device_label, ip_address, remember_me, expires_at, refresh_expires_at, revoked_at, created_at, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
  ).run(
    sessionId,
    user.id,
    user.username || user.email,
    user.phoneE164,
    user.role,
    sha256Hex(rawAccessToken),
    sha256Hex(rawRefreshToken),
    String(deviceLabel || req.headers['user-agent'] || 'Client App').slice(0, 120),
    getClientIp(req),
    rememberMe ? 1 : 0,
    accessExpiresAt,
    refreshExpiresAt,
    nowIso,
    nowIso
  );

  setRefreshCookie(req, res, rawRefreshToken, refreshTtlMs);
  return {
    sessionId,
    accessToken: rawAccessToken,
    refreshToken: rawRefreshToken,
    expiresAt: accessExpiresAt,
  };
}

app.post('/api/v1/auth/otp/request', async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const body = (req.body || {}) as Record<string, unknown>;
  const email = normalizeEmail(body.email);

  if (!isValidEmail(email)) {
    res.status(400).json({
      error: 'Please enter a valid email address.',
      code: 'INVALID_EMAIL',
    });
    return;
  }

  if (!isEmailProviderConfigured()) {
    res.status(503).json({
      error:
        'Email verification service is not configured. Please configure RESEND_API_KEY or SMTP settings.',
      code: 'EMAIL_PROVIDER_UNCONFIGURED',
    });
    return;
  }

  const ipLimit = checkRateLimit(`otp_req_ip:${ip}`, 20, 15 * 60 * 1000);
  if (!ipLimit.ok) {
    res.status(429).json({
      error: 'Too many verification code requests from this network. Please wait before trying again.',
      code: 'RATE_LIMITED',
      retryAfterSeconds: ipLimit.retryAfterSeconds,
    });
    return;
  }

  const emailWindowLimit = checkRateLimit(`otp_req_email:${email}`, 6, 15 * 60 * 1000);
  if (!emailWindowLimit.ok) {
    res.status(429).json({
      error: 'Too many verification code requests for this email. Please wait before trying again.',
      code: 'RATE_LIMITED',
      retryAfterSeconds: emailWindowLimit.retryAfterSeconds,
    });
    return;
  }

  const cooldownLimit = checkRateLimit(`otp_cooldown:${email}`, 1, OTP_RESEND_COOLDOWN_MS);
  if (!cooldownLimit.ok) {
    res.status(429).json({
      error: `Please wait ${cooldownLimit.retryAfterSeconds} seconds before requesting another code.`,
      code: 'RESEND_COOLDOWN',
      retryAfterSeconds: cooldownLimit.retryAfterSeconds,
    });
    return;
  }

  const db = getDb();
  const existingRow = db
    .prepare('SELECT id, role, status, is_primary_admin, email FROM users WHERE LOWER(email) = LOWER(?)')
    .get(email) as Record<string, unknown> | undefined;

  recordRateLimitHit(`otp_req_ip:${ip}`, 20, 15 * 60 * 1000, 15 * 60 * 1000);
  recordRateLimitHit(`otp_req_email:${email}`, 6, 15 * 60 * 1000, 15 * 60 * 1000);
  recordRateLimitHit(`otp_cooldown:${email}`, 1, OTP_RESEND_COOLDOWN_MS, OTP_RESEND_COOLDOWN_MS);

  const genericOkPayload = {
    success: true,
    expiresInSeconds: Math.floor(OTP_EXPIRY_MS / 1000),
    resendCooldownSeconds: Math.floor(OTP_RESEND_COOLDOWN_MS / 1000),
    message: 'A 6-digit verification code has been sent to your email address.',
  };

  // Prevent account-status/role enumeration: blocked non-primary accounts get the same neutral response without sending an OTP
  if (existingRow) {
    const existingUser = rowToDbUser(existingRow);
    if (existingUser.status === 'blocked') {
      writeAuditLog({
        actorUserId: existingUser.id,
        actorUsername: existingUser.email,
        actorRole: existingUser.role,
        action: 'auth.otp_suppressed_blocked',
        target: existingUser.id,
        details: `Suppressed OTP dispatch for blocked account ${existingUser.email}`,
        ipAddress: ip,
      });
      res.json(genericOkPayload);
      return;
    }
  }

  const code = String(crypto.randomInt(100000, 1000000));
  const otpId = `otp_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;
  const otpHash = hmacOtpHash(email, otpId, code);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + OTP_EXPIRY_MS).toISOString();

  db.exec('BEGIN IMMEDIATE;');
  try {
    db.prepare(
      `UPDATE email_otp_codes
       SET invalidated_at = ?
       WHERE LOWER(email) = LOWER(?) AND consumed_at IS NULL AND invalidated_at IS NULL`
    ).run(nowIso, email);

    db.prepare(
      `INSERT INTO email_otp_codes (
        id, email, otp_hash, expires_at, attempts, max_attempts, consumed_at, invalidated_at, requested_ip, created_at
      ) VALUES (?, ?, ?, ?, 0, ?, NULL, NULL, ?, ?)`
    ).run(otpId, email, otpHash, expiresAt, OTP_MAX_ATTEMPTS, ip, nowIso);
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  try {
    await sendVerificationOtpEmail({
      to: email,
      code,
      expiresMinutes: 5,
    });
  } catch (err) {
    db.prepare('UPDATE email_otp_codes SET invalidated_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      otpId
    );
    clearRateLimit(`otp_cooldown:${email}`);
    writeAuditLog({
      actorUserId: existingRow ? String(existingRow.id) : 'system',
      actorUsername: email,
      actorRole: existingRow ? rowToDbUser(existingRow).role : 'user',
      action: 'auth.otp_delivery_failed',
      target: otpId,
      details: `Email delivery failure for ${email}: ${err instanceof Error ? err.message.slice(0, 180) : 'Unknown error'}`,
      ipAddress: ip,
    });
    res.status(502).json({
      error: 'Unable to deliver verification email right now. Please try again shortly.',
      code: 'EMAIL_DELIVERY_FAILED',
    });
    return;
  }

  writeAuditLog({
    actorUserId: existingRow ? String(existingRow.id) : 'system',
    actorUsername: email,
    actorRole: existingRow ? rowToDbUser(existingRow).role : 'user',
    action: 'auth.otp_requested',
    target: otpId,
    details: `Dispatched 6-digit verification code to ${email}`,
    ipAddress: ip,
  });

  res.json(genericOkPayload);
});

app.post('/api/v1/auth/otp/verify', (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const body = (req.body || {}) as Record<string, unknown>;

  if (
    ('role' in body && body.role !== undefined && body.role !== 'user') ||
    ('isPrimaryAdmin' in body && Boolean(body.isPrimaryAdmin)) ||
    ('status' in body && body.status !== undefined && body.status !== 'active')
  ) {
    res.status(403).json({
      error: 'Privilege assignment during verification is prohibited.',
      code: 'FORBIDDEN_PRIVILEGE_ESCALATION',
    });
    return;
  }

  const email = normalizeEmail(body.email);
  const code = String(body.code || '').replace(/\s+/g, '');
  const deviceLabel = typeof body.deviceLabel === 'string' ? body.deviceLabel : undefined;

  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Please enter a valid email address.', code: 'INVALID_EMAIL' });
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    res.status(400).json({ error: 'Please enter a valid 6-digit verification code.', code: 'INVALID_OTP_FORMAT' });
    return;
  }

  const ipLimit = checkRateLimit(`otp_verify_ip:${ip}`, 30, 15 * 60 * 1000);
  if (!ipLimit.ok) {
    res.status(429).json({
      error: 'Too many verification attempts from this network. Please wait before trying again.',
      code: 'RATE_LIMITED',
      retryAfterSeconds: ipLimit.retryAfterSeconds,
    });
    return;
  }

  const db = getDb();
  const otpRow = db
    .prepare(
      `SELECT * FROM email_otp_codes
       WHERE LOWER(email) = LOWER(?) AND consumed_at IS NULL AND invalidated_at IS NULL
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(email) as Record<string, unknown> | undefined;

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  if (!otpRow) {
    recordRateLimitHit(`otp_verify_ip:${ip}`, 30, 15 * 60 * 1000, 15 * 60 * 1000);
    res.status(400).json({
      error: 'Verification code is invalid or expired. Please request a new code.',
      code: 'OTP_INVALID',
    });
    return;
  }

  const otpId = String(otpRow.id);
  const expiresAtMs = new Date(String(otpRow.expires_at)).getTime();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
    db.prepare('UPDATE email_otp_codes SET invalidated_at = ? WHERE id = ?').run(nowIso, otpId);
    res.status(400).json({
      error: 'This verification code has expired. Please request a new code.',
      code: 'OTP_EXPIRED',
    });
    return;
  }

  const attempts = Number(otpRow.attempts || 0);
  const maxAttempts = Number(otpRow.max_attempts || OTP_MAX_ATTEMPTS);
  if (attempts >= maxAttempts) {
    db.prepare('UPDATE email_otp_codes SET invalidated_at = ? WHERE id = ?').run(nowIso, otpId);
    res.status(429).json({
      error: 'Maximum verification attempts reached. Please request a new code.',
      code: 'OTP_MAX_ATTEMPTS',
    });
    return;
  }

  const expectedHash = String(otpRow.otp_hash || '');
  const candidateHash = hmacOtpHash(email, otpId, code);
  if (!constantTimeEqualHex(candidateHash, expectedHash)) {
    const nextAttempts = attempts + 1;
    const hitMax = nextAttempts >= maxAttempts;
    db.prepare(
      'UPDATE email_otp_codes SET attempts = ?, invalidated_at = CASE WHEN ? THEN ? ELSE invalidated_at END WHERE id = ?'
    ).run(nextAttempts, hitMax ? 1 : 0, nowIso, otpId);

    recordRateLimitHit(`otp_verify_ip:${ip}`, 30, 15 * 60 * 1000, 15 * 60 * 1000);
    writeAuditLog({
      actorUserId: 'system',
      actorUsername: email,
      actorRole: 'user',
      action: 'auth.otp_failed',
      target: otpId,
      details: `Incorrect verification attempt (${nextAttempts}/${maxAttempts}) for ${email}`,
      ipAddress: ip,
    });

    if (hitMax) {
      res.status(429).json({
        error: 'Too many incorrect verification attempts. Please request a new code.',
        code: 'OTP_MAX_ATTEMPTS',
      });
      return;
    }

    res.status(400).json({
      error: `Invalid verification code. ${maxAttempts - nextAttempts} attempt(s) remaining.`,
      code: 'OTP_INVALID',
    });
    return;
  }

  let isNewUser = false;
  let userBlocked = false;
  let verifiedUserId = '';

  db.exec('BEGIN IMMEDIATE;');
  try {
    const consumeRes = db
      .prepare(
        'UPDATE email_otp_codes SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL AND invalidated_at IS NULL'
      )
      .run(nowIso, otpId);

    if (consumeRes.changes !== 1) {
      db.exec('ROLLBACK;');
      res.status(400).json({
        error: 'This verification code has already been used. Please request a new code.',
        code: 'OTP_ALREADY_USED',
      });
      return;
    }

    const existingRow = db
      .prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)')
      .get(email) as Record<string, unknown> | undefined;

    if (!existingRow) {
      isNewUser = true;
      verifiedUserId = `usr_${nowMs.toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
      db.prepare(
        `INSERT INTO users (
          id, username, email, phone_e164, password_hash, role, is_primary_admin, email_verified,
          full_name, city, language, profile_completed, status, created_at, updated_at, last_login_at
        ) VALUES (?, '', ?, '', '', 'user', 0, 1, '', 'Hargeisa', 'SO', 0, 'active', ?, ?, ?)`
      ).run(verifiedUserId, email, nowIso, nowIso, nowIso);
    } else {
      const existingUser = rowToDbUser(existingRow);
      verifiedUserId = existingUser.id;
      if (existingUser.status === 'blocked') {
        userBlocked = true;
      } else {
        db.prepare(
          'UPDATE users SET email_verified = 1, last_login_at = ?, updated_at = ? WHERE id = ?'
        ).run(nowIso, nowIso, verifiedUserId);
      }
    }
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  if (userBlocked) {
    writeAuditLog({
      actorUserId: verifiedUserId,
      actorUsername: email,
      actorRole: 'user',
      action: 'auth.blocked_login_attempt',
      target: verifiedUserId,
      details: `Rejected OTP verification for blocked account ${email}`,
      ipAddress: ip,
    });
    res.status(403).json({
      error: 'This account is currently blocked. Please contact support.',
      code: 'ACCOUNT_BLOCKED',
    });
    return;
  }

  clearRateLimit(`otp_cooldown:${email}`);
  clearRateLimit(`otp_req_email:${email}`);

  const freshRow = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(verifiedUserId) as Record<string, unknown>;
  const freshUser = rowToDbUser(freshRow);

  const sess = issueUserSession({
    req,
    res,
    user: freshUser,
    rememberMe: true,
    deviceLabel,
  });

  writeAuditLog({
    actorUserId: freshUser.id,
    actorUsername: freshUser.email || freshUser.username,
    actorPhone: freshUser.phoneE164,
    actorRole: freshUser.role,
    action: isAdminRole(freshUser.role) ? 'auth.admin_login' : 'auth.user_login',
    target: freshUser.id,
    details: `Verified via Email OTP (${freshUser.email}). Session ${sess.sessionId} issued.`,
    ipAddress: ip,
  });

  res.json({
    success: true,
    token: sess.accessToken,
    refreshToken: sess.refreshToken,
    expiresAt: sess.expiresAt,
    isNewUser,
    requiresProfileCompletion: !isAdminRole(freshUser.role) && !freshUser.profileCompleted,
    user: freshUser,
  });
});

app.post('/api/v1/auth/refresh', (req: Request, res: Response) => {
  const cookies = parseCookies(req);
  const bodyToken =
    typeof (req.body as { refreshToken?: unknown })?.refreshToken === 'string'
      ? String((req.body as { refreshToken?: string }).refreshToken).trim()
      : '';
  const cookieToken = cookies[REFRESH_COOKIE_NAME] || '';
  const refreshToken = bodyToken || cookieToken;

  if (!bodyToken && cookieToken && req.headers['x-requested-with'] !== 'GuriHel-App') {
    res.status(403).json({ error: 'Invalid refresh request header.', code: 'CSRF_CHECK_FAILED' });
    return;
  }

  if (!refreshToken) {
    res.status(401).json({ error: 'No active session to refresh.', code: 'NO_REFRESH_TOKEN' });
    return;
  }

  const db = getDb();
  const refreshHash = sha256Hex(refreshToken);
  const sessRow = db
    .prepare('SELECT * FROM sessions WHERE refresh_token_hash = ?')
    .get(refreshHash) as Record<string, unknown> | undefined;

  if (!sessRow) {
    clearRefreshCookie(req, res);
    res.status(401).json({ error: 'Refresh session is invalid or expired.', code: 'INVALID_REFRESH' });
    return;
  }

  if (sessRow.revoked_at) {
    clearRefreshCookie(req, res);
    res.status(401).json({ error: 'Session has been revoked.', code: 'SESSION_REVOKED' });
    return;
  }

  const refreshExpMs = new Date(String(sessRow.refresh_expires_at || 0)).getTime();
  if (!Number.isFinite(refreshExpMs) || refreshExpMs <= Date.now()) {
    db.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      String(sessRow.id)
    );
    clearRefreshCookie(req, res);
    res.status(401).json({ error: 'Session expired. Please sign in again.', code: 'SESSION_EXPIRED' });
    return;
  }

  const userRow = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(String(sessRow.user_id)) as Record<string, unknown> | undefined;
  if (!userRow) {
    clearRefreshCookie(req, res);
    res.status(401).json({ error: 'User account not found.' });
    return;
  }

  const user = rowToDbUser(userRow);
  if (user.status === 'blocked') {
    db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(
      new Date().toISOString(),
      user.id
    );
    clearRefreshCookie(req, res);
    res.status(403).json({
      error: 'Your account has been blocked by the administrator.',
      code: 'ACCOUNT_BLOCKED',
    });
    return;
  }

  // Rotate access + refresh token on every refresh
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const rememberMe = Boolean(sessRow.remember_me);
  const refreshTtlMs = rememberMe ? REFRESH_TTL_REMEMBER_MS : REFRESH_TTL_SHORT_MS;
  const nextAccessToken = issueSignedSessionToken(String(sessRow.id), user.id);
  const nextRefreshToken = `rt_${crypto.randomBytes(32).toString('base64url')}`;
  const nextAccessExpiresAt = new Date(nowMs + ACCESS_TOKEN_TTL_MS).toISOString();
  const nextRefreshExpiresAt = new Date(nowMs + refreshTtlMs).toISOString();

  db.prepare(
    `UPDATE sessions SET
      token_hash = ?,
      refresh_token_hash = ?,
      expires_at = ?,
      refresh_expires_at = ?,
      last_seen_at = ?
     WHERE id = ? AND revoked_at IS NULL`
  ).run(
    sha256Hex(nextAccessToken),
    sha256Hex(nextRefreshToken),
    nextAccessExpiresAt,
    nextRefreshExpiresAt,
    nowIso,
    String(sessRow.id)
  );

  setRefreshCookie(req, res, nextRefreshToken, refreshTtlMs);
  res.json({
    success: true,
    token: nextAccessToken,
    refreshToken: nextRefreshToken,
    expiresAt: nextAccessExpiresAt,
    user,
  });
});

app.get('/api/v1/auth/me', requireAuth, (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  res.json({
    user: ctx.user,
    sessionId: ctx.sessionId,
    expiresAt: ctx.tokenExpiresAt,
  });
});

app.post('/api/v1/auth/profile', requireAuth, (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const body = req.body as Record<string, unknown>;

  if (
    ('role' in body && body.role !== undefined && body.role !== ctx.user.role) ||
    ('status' in body && body.status !== undefined && body.status !== ctx.user.status) ||
    ('isPrimaryAdmin' in body && Boolean(body.isPrimaryAdmin) !== ctx.user.isPrimaryAdmin)
  ) {
    res.status(403).json({ error: 'Privilege or status modification is prohibited.' });
    return;
  }

  if (typeof body.email === 'string' && normalizeEmail(body.email) !== ctx.user.email.toLowerCase()) {
    res.status(403).json({
      error: 'Changing your verified email address requires email verification.',
      code: 'EMAIL_CHANGE_FORBIDDEN',
    });
    return;
  }

  const fullName =
    typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 100) : ctx.user.fullName;
  const email = ctx.user.email;
  const city =
    typeof body.city === 'string' && body.city.trim()
      ? body.city.trim().slice(0, 60)
      : ctx.user.city;
  const phoneE164 =
    typeof body.phoneE164 === 'string' ? body.phoneE164.trim().slice(0, 32) : ctx.user.phoneE164;
  const language =
    typeof body.language === 'string' && ['SO', 'EN', 'AR'].includes(body.language)
      ? (body.language as 'SO' | 'EN' | 'AR')
      : ctx.user.language;

  if (fullName.length < 2) {
    res.status(400).json({ error: 'Full Name is required (minimum 2 characters).' });
    return;
  }

  const db = getDb();
  const nowIso = new Date().toISOString();
  db.prepare(
    `UPDATE users SET full_name = ?, city = ?, phone_e164 = ?, language = ?, profile_completed = 1, updated_at = ?
     WHERE id = ?`
  ).run(fullName, city, phoneE164, language, nowIso, ctx.user.id);

  const updatedRow = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(ctx.user.id) as Record<string, unknown>;
  const updatedUser = rowToDbUser(updatedRow);

  writeAuditLog({
    actorUserId: updatedUser.id,
    actorUsername: updatedUser.email || updatedUser.username,
    actorPhone: updatedUser.phoneE164,
    actorRole: updatedUser.role,
    action: 'user.profile_updated',
    target: updatedUser.id,
    details: `Profile updated for ${email}`,
    ipAddress: getClientIp(req),
  });

  res.json({
    success: true,
    user: updatedUser,
  });
});

// Legacy password change/reset routes removed in favor of passwordless email OTP authentication.

app.post('/api/v1/auth/logout', (req: Request, res: Response) => {
  const cookies = parseCookies(req);
  const resolved = resolveAuthFromHeader(req);
  const cookieToken = cookies[REFRESH_COOKIE_NAME] || '';
  const bodyRefresh =
    typeof (req.body as { refreshToken?: unknown })?.refreshToken === 'string'
      ? String((req.body as { refreshToken?: string }).refreshToken).trim()
      : '';

  if (!resolved.ok && !bodyRefresh && cookieToken && req.headers['x-requested-with'] !== 'GuriHel-App') {
    res.status(403).json({ error: 'Invalid logout request header.' });
    return;
  }

  const db = getDb();
  const nowIso = new Date().toISOString();

  if (resolved.ok) {
    db.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?').run(nowIso, resolved.ctx.sessionId);
    writeAuditLog({
      actorUserId: resolved.ctx.user.id,
      actorUsername: resolved.ctx.user.username,
      actorPhone: resolved.ctx.user.phoneE164,
      actorRole: resolved.ctx.user.role,
      action: 'auth.logout',
      target: resolved.ctx.sessionId,
      details: `Session revoked on logout`,
      ipAddress: getClientIp(req),
    });
  } else if (bodyRefresh || cookieToken) {
    db.prepare('UPDATE sessions SET revoked_at = ? WHERE refresh_token_hash = ? AND revoked_at IS NULL').run(
      nowIso,
      sha256Hex(bodyRefresh || cookieToken)
    );
  }

  clearRefreshCookie(req, res);
  res.json({ success: true });
});

app.post('/api/v1/auth/logout-all', requireAuth, (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const db = getDb();
  const nowIso = new Date().toISOString();
  db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(
    nowIso,
    ctx.user.id
  );

  writeAuditLog({
    actorUserId: ctx.user.id,
    actorUsername: ctx.user.email || ctx.user.username,
    actorPhone: ctx.user.phoneE164,
    actorRole: ctx.user.role,
    action: 'auth.logout_all',
    target: ctx.user.id,
    details: `All sessions revoked for ${ctx.user.email || '@' + ctx.user.username}`,
    ipAddress: getClientIp(req),
  });

  clearRefreshCookie(req, res);
  res.json({ success: true });
});

// ============================================================================
// 2. MEDIA & WATERMARK PIPELINE (/api/v1/media/*)
// ============================================================================

app.post('/api/v1/media/upload', requireAuth, async (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  if (!isAdminRole(ctx.user.role) && !ctx.user.profileCompleted) {
    res.status(403).json({ error: 'Complete your profile before uploading images.' });
    return;
  }
  const { dataUrl } = req.body as { dataUrl?: string };
  if (!dataUrl || typeof dataUrl !== 'string') {
    res.status(400).json({ error: 'Image dataUrl is required.' });
    return;
  }

  try {
    const settings = getSystemSettings();
    const stored = await storeUploadedPropertyImage(dataUrl, settings.watermark);
    const db = getDb();
    db.prepare(
      `INSERT INTO media_assets (
        id, uploaded_by_user_id, original_path, watermarked_path, mime_type,
        width, height, watermarked, watermark_position, watermark_opacity, watermark_variant, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      stored.mediaId,
      ctx.user.id,
      stored.originalPath,
      stored.watermarkedPath,
      stored.mimeType,
      stored.width,
      stored.height,
      stored.watermarked ? 1 : 0,
      settings.watermark.position,
      settings.watermark.opacity,
      settings.watermark.variant,
      new Date().toISOString()
    );

    res.status(201).json({
      id: stored.mediaId,
      url: `/api/v1/media/${stored.mediaId}`,
      width: stored.width,
      height: stored.height,
      watermarked: stored.watermarked,
    });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Failed to process image upload.',
    });
  }
});

app.get('/api/v1/media/:id', (req: Request, res: Response) => {
  const id = String(req.params.id || '').replace(/[^a-zA-Z0-9_\-]/g, '');
  if (!id) {
    res.status(404).end();
    return;
  }
  const db = getDb();
  const row = db
    .prepare('SELECT original_path, watermarked_path, watermarked FROM media_assets WHERE id = ?')
    .get(id) as
    | { original_path: string; watermarked_path: string; watermarked: number }
    | undefined;

  if (!row) {
    res.status(404).json({ error: 'Media asset not found' });
    return;
  }

  const filePath = row.watermarked && fs.existsSync(row.watermarked_path)
    ? row.watermarked_path
    : fs.existsSync(row.watermarked_path)
    ? row.watermarked_path
    : row.original_path;

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Media file missing on disk' });
    return;
  }

  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=120');
  res.sendFile(path.resolve(filePath));
});

app.get('/api/v1/media/:id/original', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const id = String(req.params.id || '').replace(/[^a-zA-Z0-9_\-]/g, '');
  const db = getDb();
  const row = db
    .prepare('SELECT original_path FROM media_assets WHERE id = ?')
    .get(id) as { original_path: string } | undefined;

  if (!row || !fs.existsSync(row.original_path)) {
    res.status(404).json({ error: 'Original media file not found' });
    return;
  }
  res.setHeader('Content-Type', 'image/jpeg');
  res.sendFile(path.resolve(row.original_path));
});

// ============================================================================
// 3. CUSTOMER & SHARED MARKETPLACE ENDPOINTS (/api/v1/*)
// ============================================================================

app.get('/api/v1/settings/public', (_req: Request, res: Response) => {
  const s = getSystemSettings();
  res.json({
    platformName: s.platformName,
    supportPhone: s.supportPhone,
    defaultCity: s.defaultCity,
    watermarkEnabled: s.watermark.enabled,
  });
});

app.get('/api/v1/listings/map', attachOptionalAuth, (req: AuthedRequest, res: Response) => {
  const purpose = String(req.query.purpose || '').trim();
  const type = String(req.query.type || '').trim();
  const district = String(req.query.district || '').trim();
  const maxPrice = req.query.price_max ? parseFloat(String(req.query.price_max)) : null;

  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM listings WHERE status = 'live' ORDER BY created_at DESC")
    .all() as Array<Record<string, unknown>>;

  let filtered = rows.map(serializeListingRow);
  if (purpose && purpose !== 'all') {
    filtered = filtered.filter((l) => l.purpose === purpose);
  }
  if (type && type !== 'all') {
    filtered = filtered.filter((l) => l.property_type === type);
  }
  if (district) {
    filtered = filtered.filter((l) => l.district.toLowerCase().includes(district.toLowerCase()));
  }
  if (maxPrice && Number.isFinite(maxPrice)) {
    filtered = filtered.filter((l) => l.price <= maxPrice);
  }

  const pins = filtered.map((l) => ({
    id: l.id,
    lat: l.lat,
    lng: l.lng,
    price: l.price,
    label:
      l.price >= 1_000_000
        ? `${(l.price / 1_000_000).toFixed(1)}M`
        : l.price >= 1_000
        ? `${Math.round(l.price / 1_000)}K`
        : `$${l.price}`,
    verified: l.verified,
    featured: l.featured,
  }));

  res.json({
    total_matching: filtered.length,
    returned: filtered.length,
    pins,
    clusters: [],
    cards: null,
  });
});

app.get('/api/v1/listings', attachOptionalAuth, (req: AuthedRequest, res: Response) => {
  const db = getDb();
  const auth = req.auth;
  const mineOnly = req.query.mine === '1';

  let rows: Array<Record<string, unknown>>;
  if (isAdminRole(auth?.user.role) && !mineOnly) {
    rows = db.prepare('SELECT * FROM listings ORDER BY created_at DESC').all() as Array<
      Record<string, unknown>
    >;
  } else if (auth && mineOnly) {
    rows = db
      .prepare('SELECT * FROM listings WHERE owner_user_id = ? ORDER BY created_at DESC')
      .all(auth.user.id) as Array<Record<string, unknown>>;
  } else if (auth) {
    rows = db
      .prepare(
        "SELECT * FROM listings WHERE status = 'live' OR owner_user_id = ? ORDER BY created_at DESC"
      )
      .all(auth.user.id) as Array<Record<string, unknown>>;
  } else {
    rows = db
      .prepare("SELECT * FROM listings WHERE status = 'live' ORDER BY created_at DESC")
      .all() as Array<Record<string, unknown>>;
  }

  const data = rows.map(serializeListingRow);
  res.json({ data, total: data.length });
});

app.get('/api/v1/listings/:id', attachOptionalAuth, (req: AuthedRequest, res: Response) => {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM listings WHERE id = ?')
    .get(String(req.params.id)) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({ error: 'Listing not found' });
    return;
  }

  const isAdmin = isAdminRole(req.auth?.user.role);
  const isOwner = req.auth && String(row.owner_user_id) === req.auth.user.id;
  if (String(row.status) !== 'live' && !isAdmin && !isOwner) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  db.prepare('UPDATE listings SET views = views + 1 WHERE id = ?').run(String(row.id));
  res.json(serializeListingRow(row));
});

app.post('/api/v1/listings', requireAuth, async (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  if (!isAdminRole(ctx.user.role) && !ctx.user.profileCompleted) {
    res.status(403).json({ error: 'Please complete your Full Name before adding a property.' });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const title = String(body.title || '').trim().slice(0, 160);
  if (title.length < 2) {
    res.status(400).json({ error: 'Property title is required.' });
    return;
  }

  const purpose = ['rent', 'sale', 'booking'].includes(String(body.purpose))
    ? String(body.purpose)
    : 'rent';
  const propertyType = ['villa', 'apartment', 'land', 'commercial', 'building'].includes(
    String(body.property_type)
  )
    ? String(body.property_type)
    : 'villa';

  const settings = getSystemSettings();
  const isAdmin = isAdminRole(ctx.user.role);
  const resolvedStatus = isAdmin
    ? ['live', 'pending', 'rejected', 'sold'].includes(String(body.status))
      ? String(body.status)
      : 'live'
    : settings.requireListingModeration
    ? 'pending'
    : 'live';

  const { publicUrls, originalPaths } = await normalizeAndWatermarkListingImages(
    body.images,
    ctx.user.id
  );

  const id = `hga-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
  const nowIso = new Date().toISOString();

  const brokerObj = {
    id: ctx.user.id,
    name: ctx.user.fullName || (ctx.user.username ? `@${ctx.user.username}` : ctx.user.email) || 'GuriHel User',
    agency: isAdmin ? 'GuriHel Official' : 'Private Owner',
    phone: ctx.user.phoneE164 || getSystemSettings().supportPhone || '+252636786709',
    whatsapp: (ctx.user.phoneE164 || getSystemSettings().supportPhone || '+252636786709').replace(/^\+/, ''),
    license: isAdmin ? 'GURIHEL-ADMIN' : 'VERIFIED-USER',
    district: String(body.district || 'Jigjiga Yar').slice(0, 80),
    avatar: '/assets/aistudio/GuriHel-app-icon-rounded_1e742137.png',
    rating: 5,
    activeListingsCount: 1,
    verified: isAdmin,
  };

  const db = getDb();
  db.prepare(
    `INSERT INTO listings (
      id, owner_user_id, title, description, purpose, property_type, price, currency, price_unit,
      area_m2, bedrooms, living_rooms, bathrooms, city, district, address, lat, lng,
      verified, featured, status, images_json, original_images_json, amenities_json, broker_json,
      views, rejection_reason, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', ?, ?)`
  ).run(
    id,
    ctx.user.id,
    title,
    String(body.description || '').slice(0, 2000),
    purpose,
    propertyType,
    Math.max(0, Number(body.price) || 0),
    body.currency === 'SLSH' ? 'SLSH' : 'USD',
    ['total', 'month', 'year', 'night'].includes(String(body.price_unit))
      ? String(body.price_unit)
      : purpose === 'rent'
      ? 'month'
      : purpose === 'booking'
      ? 'night'
      : 'total',
    Math.max(0, Number(body.area_m2) || 0),
    Math.max(0, Math.min(50, Number(body.bedrooms) || 0)),
    Math.max(0, Math.min(30, Number(body.living_rooms) || 1)),
    Math.max(0, Math.min(50, Number(body.bathrooms) || 1)),
    String(body.city || 'Hargeisa').slice(0, 60),
    String(body.district || 'Jigjiga Yar').slice(0, 80),
    String(body.address || '').slice(0, 200),
    Number.isFinite(Number(body.lat)) ? Number(body.lat) : 9.558,
    Number.isFinite(Number(body.lng)) ? Number(body.lng) : 44.068,
    isAdmin ? (body.verified === false ? 0 : 1) : 0,
    isAdmin && body.featured ? 1 : 0,
    resolvedStatus,
    JSON.stringify(publicUrls),
    JSON.stringify(originalPaths),
    JSON.stringify(
      Array.isArray(body.amenities)
        ? body.amenities.slice(0, 20).map((a) => String(a).slice(0, 60))
        : []
    ),
    JSON.stringify(brokerObj),
    nowIso,
    nowIso
  );

  writeAuditLog({
    actorUserId: ctx.user.id,
    actorPhone: ctx.user.phoneE164,
    actorRole: ctx.user.role,
    action: 'listing.created',
    target: id,
    details: `Created "${title}" (${resolvedStatus}) with ${publicUrls.length} image(s)`,
    ipAddress: getClientIp(req),
  });

  const created = db
    .prepare('SELECT * FROM listings WHERE id = ?')
    .get(id) as Record<string, unknown>;
  res.status(201).json(serializeListingRow(created));
});

app.get('/api/v1/projects', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM projects ORDER BY featured DESC, created_at DESC')
    .all() as Array<Record<string, unknown>>;
  res.json(rows.map(serializeProjectRow));
});

app.post('/api/v1/projects/:id/interest', requireAuth, (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const projectId = String(req.params.id);
  const db = getDb();
  const proj = db
    .prepare('SELECT id, name FROM projects WHERE id = ?')
    .get(projectId) as { id: string; name: string } | undefined;
  if (!proj) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  db.prepare('UPDATE projects SET leads_count = leads_count + 1, updated_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    projectId
  );
  writeAuditLog({
    actorUserId: ctx.user.id,
    actorPhone: ctx.user.phoneE164,
    actorRole: ctx.user.role,
    action: 'project.interest_registered',
    target: projectId,
    details: `Lead registered by ${ctx.user.fullName || (ctx.user.username ? '@' + ctx.user.username : ctx.user.email)} for ${proj.name}`,
    ipAddress: getClientIp(req),
  });
  res.json({ success: true });
});

app.get('/api/v1/stats/avg-prices', (_req: Request, res: Response) => {
  res.json(DISTRICT_PRICE_TRENDS);
});

app.get('/api/v1/bookings', requireAuth, (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const db = getDb();
  const rows =
    isAdminRole(ctx.user.role)
      ? (db.prepare('SELECT * FROM bookings ORDER BY created_at DESC').all() as Array<
          Record<string, unknown>
        >)
      : (db
          .prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC')
          .all(ctx.user.id) as Array<Record<string, unknown>>);

  res.json(
    rows.map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      listingId: String(r.listing_id),
      listingTitle: String(r.listing_title),
      district: String(r.district),
      image: '',
      checkIn: String(r.check_in),
      checkOut: String(r.check_out),
      nights: Number(r.nights),
      nightlyPrice: Number(r.nightly_price),
      serviceFee: Number(r.service_fee),
      total: Number(r.total),
      paymentMethod: String(r.payment_method),
      guestName: String(r.guest_name),
      guestPhone: String(r.guest_phone),
      status: String(r.status),
      createdAt: String(r.created_at),
    }))
  );
});

app.post('/api/v1/bookings', requireAuth, (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  if (!isAdminRole(ctx.user.role) && !ctx.user.profileCompleted) {
    res.status(403).json({ error: 'Complete your profile before creating a booking.' });
    return;
  }
  const body = req.body as Record<string, unknown>;
  const listingId = String(body.listingId || '').trim();
  const db = getDb();
  const listing = db
    .prepare("SELECT id, title, district, price FROM listings WHERE id = ? AND status = 'live'")
    .get(listingId) as { id: string; title: string; district: string; price: number } | undefined;

  if (!listing) {
    res.status(404).json({ error: 'Available property listing not found for booking.' });
    return;
  }

  const nights = Math.max(1, Math.min(365, Number(body.nights) || 1));
  const nightlyPrice = Number(listing.price) || 0;
  const serviceFee = Number((nightlyPrice * nights * 0.05).toFixed(2));
  const total = Number((nightlyPrice * nights + serviceFee).toFixed(2));
  const id = `bk-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
  const nowIso = new Date().toISOString();

  db.prepare(
    `INSERT INTO bookings (
      id, user_id, listing_id, listing_title, district, check_in, check_out, nights,
      nightly_price, service_fee, total, payment_method, guest_name, guest_phone, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'held', ?, ?)`
  ).run(
    id,
    ctx.user.id,
    listing.id,
    listing.title,
    listing.district,
    String(body.checkIn || nowIso.slice(0, 10)).slice(0, 32),
    String(body.checkOut || nowIso.slice(0, 10)).slice(0, 32),
    nights,
    nightlyPrice,
    serviceFee,
    total,
    ['Zaad Service', 'eDahab', 'Cash on Hand', 'Card'].includes(String(body.paymentMethod))
      ? String(body.paymentMethod)
      : 'Zaad Service',
    ctx.user.fullName || (ctx.user.username ? `@${ctx.user.username}` : ctx.user.email),
    ctx.user.phoneE164 || ctx.user.email,
    nowIso,
    nowIso
  );

  res.status(201).json({
    id,
    listingId: listing.id,
    listingTitle: listing.title,
    district: listing.district,
    nights,
    nightlyPrice,
    serviceFee,
    total,
    status: 'held',
    createdAt: nowIso,
  });
});

app.get('/api/v1/search-requests', requireAuth, (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const db = getDb();
  const rows =
    isAdminRole(ctx.user.role)
      ? (db.prepare('SELECT * FROM search_requests ORDER BY created_at DESC').all() as Array<
          Record<string, unknown>
        >)
      : (db
          .prepare('SELECT * FROM search_requests WHERE user_id = ? ORDER BY created_at DESC')
          .all(ctx.user.id) as Array<Record<string, unknown>>);

  res.json(
    rows.map((r) => ({
      id: String(r.id),
      seekerName: String(r.seeker_name),
      seekerPhone: String(r.seeker_phone),
      purpose: String(r.purpose),
      propertyType: String(r.property_type),
      district: String(r.district),
      budgetMin: Number(r.budget_min),
      budgetMax: Number(r.budget_max),
      bedrooms: Number(r.bedrooms),
      notes: String(r.notes),
      status: String(r.status),
      createdAt: String(r.created_at),
      responsesCount: Number(r.responses_count),
    }))
  );
});

app.post('/api/v1/search-requests', requireAuth, (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const body = req.body as Record<string, unknown>;
  const id = `SR-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
  const nowIso = new Date().toISOString();
  const db = getDb();

  const payload = {
    id,
    seekerName: ctx.user.fullName || String(body.seekerName || (ctx.user.username ? `@${ctx.user.username}` : ctx.user.email)).slice(0, 100),
    seekerPhone: ctx.user.phoneE164 || ctx.user.email,
    purpose: ['rent', 'sale', 'booking'].includes(String(body.purpose))
      ? String(body.purpose)
      : 'rent',
    propertyType: ['villa', 'apartment', 'land', 'commercial', 'building'].includes(
      String(body.propertyType)
    )
      ? String(body.propertyType)
      : 'villa',
    district: String(body.district || 'Jigjiga Yar').slice(0, 80),
    budgetMin: Math.max(0, Number(body.budgetMin) || 0),
    budgetMax: Math.max(0, Number(body.budgetMax) || 0),
    bedrooms: Math.max(0, Number(body.bedrooms) || 0),
    notes: String(body.notes || '').slice(0, 1000),
    status: 'open',
    createdAt: nowIso,
    responsesCount: 0,
  };

  db.prepare(
    `INSERT INTO search_requests (
      id, user_id, seeker_name, seeker_phone, purpose, property_type, district,
      budget_min, budget_max, bedrooms, notes, status, responses_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 0, ?, ?)`
  ).run(
    payload.id,
    ctx.user.id,
    payload.seekerName,
    payload.seekerPhone,
    payload.purpose,
    payload.propertyType,
    payload.district,
    payload.budgetMin,
    payload.budgetMax,
    payload.bedrooms,
    payload.notes,
    nowIso,
    nowIso
  );

  res.status(201).json(payload);
});

app.get('/api/v1/lease-contracts', requireAuth, (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const db = getDb();
  const rows =
    isAdminRole(ctx.user.role)
      ? (db.prepare('SELECT * FROM lease_contracts ORDER BY created_at DESC').all() as Array<
          Record<string, unknown>
        >)
      : (db
          .prepare('SELECT * FROM lease_contracts WHERE user_id = ? ORDER BY created_at DESC')
          .all(ctx.user.id) as Array<Record<string, unknown>>);

  res.json(
    rows.map((r) => ({
      id: String(r.id),
      listingId: String(r.listing_id),
      propertyTitle: String(r.property_title),
      district: String(r.district),
      landlordName: String(r.landlord_name),
      landlordPhone: String(r.landlord_phone),
      tenantName: String(r.tenant_name),
      tenantPhone: String(r.tenant_phone),
      tenantIdNumber: String(r.tenant_id_number),
      monthlyRent: Number(r.monthly_rent),
      securityDeposit: Number(r.security_deposit),
      startDate: String(r.start_date),
      durationMonths: Number(r.duration_months),
      terms: safeParseJson<string[]>(r.terms_json, []),
      landlordSigned: Boolean(r.landlord_signed),
      tenantSigned: Boolean(r.tenant_signed),
      status: String(r.status),
      createdAt: String(r.created_at),
    }))
  );
});

app.post('/api/v1/lease-contracts', requireAuth, (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const body = req.body as Record<string, unknown>;
  const id = `LC-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
  const nowIso = new Date().toISOString();
  const db = getDb();

  const terms = Array.isArray(body.terms)
    ? body.terms.slice(0, 20).map((t) => String(t).slice(0, 300))
    : [];

  db.prepare(
    `INSERT INTO lease_contracts (
      id, user_id, listing_id, property_title, district, landlord_name, landlord_phone,
      tenant_name, tenant_phone, tenant_id_number, monthly_rent, security_deposit,
      start_date, duration_months, terms_json, landlord_signed, tenant_signed, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`
  ).run(
    id,
    ctx.user.id,
    String(body.listingId || '').slice(0, 120),
    String(body.propertyTitle || 'Lease Agreement').slice(0, 160),
    String(body.district || 'Hargeisa').slice(0, 80),
    String(body.landlordName || '').slice(0, 100),
    String(body.landlordPhone || '').slice(0, 32),
    String(body.tenantName || ctx.user.fullName || '').slice(0, 100),
    String(body.tenantPhone || ctx.user.phoneE164).slice(0, 32),
    String(body.tenantIdNumber || '').slice(0, 60),
    Math.max(0, Number(body.monthlyRent) || 0),
    Math.max(0, Number(body.securityDeposit) || 0),
    String(body.startDate || nowIso.slice(0, 10)).slice(0, 32),
    Math.max(1, Number(body.durationMonths) || 12),
    JSON.stringify(terms),
    body.landlordSigned ? 1 : 0,
    body.tenantSigned ? 1 : 0,
    nowIso,
    nowIso
  );

  res.status(201).json({
    id,
    listingId: String(body.listingId || ''),
    propertyTitle: String(body.propertyTitle || 'Lease Agreement'),
    district: String(body.district || 'Hargeisa'),
    landlordName: String(body.landlordName || ''),
    landlordPhone: String(body.landlordPhone || ''),
    tenantName: String(body.tenantName || ctx.user.fullName || ''),
    tenantPhone: String(body.tenantPhone || ctx.user.phoneE164),
    tenantIdNumber: String(body.tenantIdNumber || ''),
    monthlyRent: Math.max(0, Number(body.monthlyRent) || 0),
    securityDeposit: Math.max(0, Number(body.securityDeposit) || 0),
    startDate: String(body.startDate || nowIso.slice(0, 10)),
    durationMonths: Math.max(1, Number(body.durationMonths) || 12),
    terms,
    landlordSigned: Boolean(body.landlordSigned),
    tenantSigned: Boolean(body.tenantSigned),
    status: 'draft',
    createdAt: nowIso,
  });
});

app.get('/api/v1/chat/threads', requireAuth, (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const db = getDb();
  const threads =
    isAdminRole(ctx.user.role)
      ? (db.prepare('SELECT * FROM chat_threads ORDER BY updated_at DESC').all() as Array<
          Record<string, unknown>
        >)
      : (db
          .prepare('SELECT * FROM chat_threads WHERE participant_user_id = ? ORDER BY updated_at DESC')
          .all(ctx.user.id) as Array<Record<string, unknown>>);

  const msgStmt = db.prepare(
    'SELECT * FROM chat_messages WHERE thread_id = ? ORDER BY created_at ASC'
  );

  res.json(
    threads.map((t) => {
      const msgs = msgStmt.all(String(t.id)) as Array<Record<string, unknown>>;
      const fallbackSupportPhone = getSystemSettings().supportPhone || '+252636786709';
      return {
        id: String(t.id),
        broker: {
          id: 'gurihel-support',
          name: String(t.contact_name || 'GuriHel Support'),
          agency: 'GuriHel Real Estate',
          phone: String(t.contact_phone || fallbackSupportPhone),
          whatsapp: String(t.contact_phone || fallbackSupportPhone).replace(/^\+/, ''),
          license: 'OFFICIAL',
          district: 'Hargeisa',
          avatar: '/assets/aistudio/GuriHel-app-icon-rounded_1e742137.png',
          rating: 5,
          activeListingsCount: 0,
          verified: true,
        },
        listingId: t.listing_id ? String(t.listing_id) : undefined,
        listingTitle: t.listing_title ? String(t.listing_title) : undefined,
        listingPrice: Number(t.listing_price || 0) || undefined,
        listingImage: t.listing_image ? String(t.listing_image) : undefined,
        lastMessage: String(t.last_message || ''),
        lastTime: String(t.last_time || ''),
        unread: Boolean(t.unread),
        messages: msgs.map((m) => ({
          id: String(m.id),
          sender: String(m.sender_type) as 'user' | 'broker' | 'system',
          body: String(m.body),
          time: String(m.time_label),
        })),
      };
    })
  );
});

app.post('/api/v1/chat/threads', requireAuth, (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const body = req.body as {
    listingId?: string;
    listingTitle?: string;
    listingPrice?: number;
    listingImage?: string;
    contactName?: string;
    contactPhone?: string;
    initialMessage?: string;
  };
  const db = getDb();
  const id = `thr_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
  const nowIso = new Date().toISOString();
  const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const initialMsg = String(body.initialMessage || '').trim().slice(0, 1500);
  const fallbackSupportPhone = getSystemSettings().supportPhone || '+252636786709';

  db.prepare(
    `INSERT INTO chat_threads (
      id, participant_user_id, listing_id, listing_title, listing_price, listing_image,
      contact_name, contact_phone, last_message, last_time, unread, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(
    id,
    ctx.user.id,
    String(body.listingId || '').slice(0, 120),
    String(body.listingTitle || '').slice(0, 160),
    Number(body.listingPrice) || 0,
    String(body.listingImage || '').slice(0, 500),
    String(body.contactName || 'GuriHel Support').slice(0, 120),
    String(body.contactPhone || fallbackSupportPhone).slice(0, 32),
    initialMsg,
    initialMsg ? timeLabel : '',
    nowIso,
    nowIso
  );

  const messages: Array<{ id: string; sender: 'user' | 'broker' | 'system'; body: string; time: string }> = [];
  if (initialMsg) {
    const msgId = `msg_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const senderType = isAdminRole(ctx.user.role) ? 'broker' : 'user';
    db.prepare(
      `INSERT INTO chat_messages (id, thread_id, sender_user_id, sender_type, body, time_label, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(msgId, id, ctx.user.id, senderType, initialMsg, timeLabel, nowIso);
    messages.push({
      id: msgId,
      sender: senderType,
      body: initialMsg,
      time: timeLabel,
    });
  }

  res.status(201).json({
    id,
    broker: {
      id: 'gurihel-support',
      name: String(body.contactName || 'GuriHel Support'),
      agency: 'GuriHel Real Estate',
      phone: String(body.contactPhone || fallbackSupportPhone),
      whatsapp: String(body.contactPhone || fallbackSupportPhone).replace(/^\+/, ''),
      license: 'OFFICIAL',
      district: 'Hargeisa',
      avatar: '/assets/aistudio/GuriHel-app-icon-rounded_1e742137.png',
      rating: 5,
      activeListingsCount: 0,
      verified: true,
    },
    listingId: body.listingId,
    listingTitle: body.listingTitle,
    listingPrice: body.listingPrice,
    listingImage: body.listingImage,
    lastMessage: initialMsg,
    lastTime: initialMsg ? timeLabel : '',
    unread: false,
    messages,
  });
});

app.post('/api/v1/chat/threads/:id/messages', requireAuth, (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const threadId = String(req.params.id);
  const text = String((req.body as { body?: string }).body || '').trim().slice(0, 1500);
  if (!text) {
    res.status(400).json({ error: 'Message text is required.' });
    return;
  }

  const db = getDb();
  const thread = db
    .prepare('SELECT participant_user_id FROM chat_threads WHERE id = ?')
    .get(threadId) as { participant_user_id: string } | undefined;

  if (!thread) {
    res.status(404).json({ error: 'Chat thread not found.' });
    return;
  }
  if (!isAdminRole(ctx.user.role) && thread.participant_user_id !== ctx.user.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const msgId = `msg_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
  const nowIso = new Date().toISOString();
  const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const senderType = isAdminRole(ctx.user.role) ? 'broker' : 'user';

  db.prepare(
    `INSERT INTO chat_messages (id, thread_id, sender_user_id, sender_type, body, time_label, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(msgId, threadId, ctx.user.id, senderType, text, timeLabel, nowIso);

  db.prepare(
    'UPDATE chat_threads SET last_message = ?, last_time = ?, updated_at = ? WHERE id = ?'
  ).run(text, timeLabel, nowIso, threadId);

  res.status(201).json({
    id: msgId,
    sender: senderType,
    body: text,
    time: timeLabel,
  });
});

app.get('/api/v1/favorites', requireAuth, (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const db = getDb();
  const rows = db
    .prepare('SELECT listing_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC')
    .all(ctx.user.id) as Array<{ listing_id: string }>;
  res.json(rows.map((r) => r.listing_id));
});

app.post('/api/v1/favorites/:listingId', requireAuth, (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const listingId = String(req.params.listingId);
  const db = getDb();
  db.prepare(
    'INSERT OR IGNORE INTO favorites (user_id, listing_id, created_at) VALUES (?, ?, ?)'
  ).run(ctx.user.id, listingId, new Date().toISOString());
  res.json({ success: true });
});

app.delete('/api/v1/favorites/:listingId', requireAuth, (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const listingId = String(req.params.listingId);
  const db = getDb();
  db.prepare('DELETE FROM favorites WHERE user_id = ? AND listing_id = ?').run(
    ctx.user.id,
    listingId
  );
  res.json({ success: true });
});

// ============================================================================
// 4. EXCLUSIVE ADMIN API (/api/v1/admin/* — Strictly requireAuth + requireAdmin)
// ============================================================================

app.get('/api/v1/admin/overview', requireAuth, requireAdmin, (_req: AuthedRequest, res: Response) => {
  const db = getDb();
  const usersTotal = (
    db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }
  ).c;
  const usersCompleted = (
    db.prepare('SELECT COUNT(*) AS c FROM users WHERE profile_completed = 1').get() as { c: number }
  ).c;
  const listingsTotal = (
    db.prepare('SELECT COUNT(*) AS c FROM listings').get() as { c: number }
  ).c;
  const listingsLive = (
    db.prepare("SELECT COUNT(*) AS c FROM listings WHERE status = 'live'").get() as { c: number }
  ).c;
  const listingsPending = (
    db.prepare("SELECT COUNT(*) AS c FROM listings WHERE status = 'pending'").get() as { c: number }
  ).c;
  const listingsRejected = (
    db.prepare("SELECT COUNT(*) AS c FROM listings WHERE status = 'rejected'").get() as { c: number }
  ).c;
  const projectsTotal = (
    db.prepare('SELECT COUNT(*) AS c FROM projects').get() as { c: number }
  ).c;
  const bookingsTotal = (
    db.prepare('SELECT COUNT(*) AS c FROM bookings').get() as { c: number }
  ).c;
  const bookingsRevenue = (
    db
      .prepare("SELECT COALESCE(SUM(total), 0) AS s FROM bookings WHERE status != 'cancelled'")
      .get() as { s: number }
  ).s;
  const requestsOpen = (
    db.prepare("SELECT COUNT(*) AS c FROM search_requests WHERE status = 'open'").get() as {
      c: number;
    }
  ).c;
  const leasesTotal = (
    db.prepare('SELECT COUNT(*) AS c FROM lease_contracts').get() as { c: number }
  ).c;
  const mediaTotal = (
    db.prepare('SELECT COUNT(*) AS c FROM media_assets').get() as { c: number }
  ).c;
  const activeSessionsCount = (
    db
      .prepare('SELECT COUNT(*) AS c FROM sessions WHERE revoked_at IS NULL AND expires_at > ?')
      .get(new Date().toISOString()) as { c: number }
  ).c;

  const pendingResetsCount = (
    db
      .prepare("SELECT COUNT(*) AS c FROM password_reset_requests WHERE status IN ('pending', 'issued')")
      .get() as { c: number }
  ).c;

  res.json({
    usersTotal,
    usersCompleted,
    listingsTotal,
    listingsLive,
    listingsPending,
    listingsRejected,
    projectsTotal,
    bookingsTotal,
    bookingsRevenue,
    requestsOpen,
    leasesTotal,
    mediaTotal,
    activeSessionsCount,
    pendingResetsCount,
    primaryAdminEmail: PRIMARY_ADMIN_EMAIL,
    settings: getSystemSettings(),
  });
});

app.get('/api/v1/admin/listings', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const status = String(req.query.status || '').trim();
  const q = String(req.query.q || '').trim().toLowerCase();
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM listings ORDER BY created_at DESC')
    .all() as Array<Record<string, unknown>>;
  let items = rows.map(serializeListingRow);
  if (status && status !== 'all') {
    items = items.filter((l) => l.status === status);
  }
  if (q) {
    items = items.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.district.toLowerCase().includes(q) ||
        l.city.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q)
    );
  }
  res.json(items);
});

app.post('/api/v1/admin/listings', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  // Delegate to authenticated admin creation semantics
  const ctx = req.auth!;
  const body = req.body as Record<string, unknown>;
  const title = String(body.title || '').trim().slice(0, 160);
  if (title.length < 2) {
    res.status(400).json({ error: 'Property title is required.' });
    return;
  }

  const purpose = ['rent', 'sale', 'booking'].includes(String(body.purpose))
    ? String(body.purpose)
    : 'rent';
  const propertyType = ['villa', 'apartment', 'land', 'commercial', 'building'].includes(
    String(body.property_type)
  )
    ? String(body.property_type)
    : 'villa';
  const status = ['live', 'pending', 'rejected', 'sold'].includes(String(body.status))
    ? String(body.status)
    : 'live';

  const { publicUrls, originalPaths } = await normalizeAndWatermarkListingImages(
    body.images,
    ctx.user.id
  );

  const id = `hga-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
  const nowIso = new Date().toISOString();

  const brokerObj = {
    id: ctx.user.id,
    name: String(body.contactName || 'GuriHel Official Admin').slice(0, 100),
    agency: 'GuriHel Verified Listings',
    phone: ctx.user.phoneE164 || getSystemSettings().supportPhone || '+252636786709',
    whatsapp: (ctx.user.phoneE164 || getSystemSettings().supportPhone || '+252636786709').replace(/^\+/, ''),
    license: 'GURIHEL-ADMIN',
    district: String(body.district || 'Jigjiga Yar').slice(0, 80),
    avatar: '/assets/aistudio/GuriHel-app-icon-rounded_1e742137.png',
    rating: 5,
    activeListingsCount: 1,
    verified: true,
  };

  const db = getDb();
  db.prepare(
    `INSERT INTO listings (
      id, owner_user_id, title, description, purpose, property_type, price, currency, price_unit,
      area_m2, bedrooms, living_rooms, bathrooms, city, district, address, lat, lng,
      verified, featured, status, images_json, original_images_json, amenities_json, broker_json,
      views, rejection_reason, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', ?, ?)`
  ).run(
    id,
    ctx.user.id,
    title,
    String(body.description || '').slice(0, 2000),
    purpose,
    propertyType,
    Math.max(0, Number(body.price) || 0),
    body.currency === 'SLSH' ? 'SLSH' : 'USD',
    ['total', 'month', 'year', 'night'].includes(String(body.price_unit))
      ? String(body.price_unit)
      : purpose === 'rent'
      ? 'month'
      : purpose === 'booking'
      ? 'night'
      : 'total',
    Math.max(0, Number(body.area_m2) || 0),
    Math.max(0, Math.min(50, Number(body.bedrooms) || 0)),
    Math.max(0, Math.min(30, Number(body.living_rooms) || 1)),
    Math.max(0, Math.min(50, Number(body.bathrooms) || 1)),
    String(body.city || 'Hargeisa').slice(0, 60),
    String(body.district || 'Jigjiga Yar').slice(0, 80),
    String(body.address || '').slice(0, 200),
    Number.isFinite(Number(body.lat)) ? Number(body.lat) : 9.558,
    Number.isFinite(Number(body.lng)) ? Number(body.lng) : 44.068,
    body.verified === false ? 0 : 1,
    body.featured ? 1 : 0,
    status,
    JSON.stringify(publicUrls),
    JSON.stringify(originalPaths),
    JSON.stringify(
      Array.isArray(body.amenities)
        ? body.amenities.slice(0, 20).map((a) => String(a).slice(0, 60))
        : []
    ),
    JSON.stringify(brokerObj),
    nowIso,
    nowIso
  );

  writeAuditLog({
    actorUserId: ctx.user.id,
    actorPhone: ctx.user.phoneE164,
    actorRole: 'admin',
    action: 'admin.listing_created',
    target: id,
    details: `Admin created & set "${title}" to ${status} (${publicUrls.length} watermarked images)`,
    ipAddress: getClientIp(req),
  });

  const created = db
    .prepare('SELECT * FROM listings WHERE id = ?')
    .get(id) as Record<string, unknown>;
  res.status(201).json(serializeListingRow(created));
});

app.patch('/api/v1/admin/listings/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const id = String(req.params.id);
  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM listings WHERE id = ?')
    .get(id) as Record<string, unknown> | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Listing not found.' });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const nowIso = new Date().toISOString();

  let imagesJson = String(existing.images_json || '[]');
  let originalsJson = String(existing.original_images_json || '[]');
  if (Array.isArray(body.images)) {
    const processed = await normalizeAndWatermarkListingImages(body.images, ctx.user.id);
    imagesJson = JSON.stringify(processed.publicUrls);
    if (processed.originalPaths.length > 0) {
      originalsJson = JSON.stringify(processed.originalPaths);
    }
  }

  const nextStatus =
    typeof body.status === 'string' && ['live', 'pending', 'rejected', 'sold'].includes(body.status)
      ? body.status
      : String(existing.status);

  const nextVerified =
    typeof body.verified === 'boolean'
      ? body.verified
        ? 1
        : 0
      : nextStatus === 'live'
      ? 1
      : Number(existing.verified);

  db.prepare(
    `UPDATE listings SET
      title = ?, description = ?, purpose = ?, property_type = ?,
      price = ?, currency = ?, price_unit = ?, area_m2 = ?,
      bedrooms = ?, living_rooms = ?, bathrooms = ?,
      city = ?, district = ?, address = ?, lat = ?, lng = ?,
      verified = ?, featured = ?, status = ?, rejection_reason = ?,
      images_json = ?, original_images_json = ?, amenities_json = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    body.title !== undefined ? String(body.title).slice(0, 160) : String(existing.title),
    body.description !== undefined
      ? String(body.description).slice(0, 2000)
      : String(existing.description),
    typeof body.purpose === 'string' && ['rent', 'sale', 'booking'].includes(body.purpose)
      ? body.purpose
      : String(existing.purpose),
    typeof body.property_type === 'string' &&
      ['villa', 'apartment', 'land', 'commercial', 'building'].includes(body.property_type)
      ? body.property_type
      : String(existing.property_type),
    body.price !== undefined ? Math.max(0, Number(body.price) || 0) : Number(existing.price),
    body.currency === 'SLSH' ? 'SLSH' : body.currency === 'USD' ? 'USD' : String(existing.currency),
    typeof body.price_unit === 'string' &&
      ['total', 'month', 'year', 'night'].includes(body.price_unit)
      ? body.price_unit
      : String(existing.price_unit),
    body.area_m2 !== undefined ? Math.max(0, Number(body.area_m2) || 0) : Number(existing.area_m2),
    body.bedrooms !== undefined ? Math.max(0, Number(body.bedrooms) || 0) : Number(existing.bedrooms),
    body.living_rooms !== undefined
      ? Math.max(0, Number(body.living_rooms) || 0)
      : Number(existing.living_rooms),
    body.bathrooms !== undefined
      ? Math.max(0, Number(body.bathrooms) || 0)
      : Number(existing.bathrooms),
    body.city !== undefined ? String(body.city).slice(0, 60) : String(existing.city),
    body.district !== undefined ? String(body.district).slice(0, 80) : String(existing.district),
    body.address !== undefined ? String(body.address).slice(0, 200) : String(existing.address),
    Number.isFinite(Number(body.lat)) ? Number(body.lat) : Number(existing.lat),
    Number.isFinite(Number(body.lng)) ? Number(body.lng) : Number(existing.lng),
    nextVerified,
    typeof body.featured === 'boolean' ? (body.featured ? 1 : 0) : Number(existing.featured),
    nextStatus,
    body.rejectionReason !== undefined
      ? String(body.rejectionReason).slice(0, 300)
      : String(existing.rejection_reason || ''),
    imagesJson,
    originalsJson,
    Array.isArray(body.amenities)
      ? JSON.stringify(body.amenities.slice(0, 20).map((a) => String(a).slice(0, 60)))
      : String(existing.amenities_json),
    nowIso,
    id
  );

  writeAuditLog({
    actorUserId: ctx.user.id,
    actorPhone: ctx.user.phoneE164,
    actorRole: 'admin',
    action: 'admin.listing_updated',
    target: id,
    details: `Updated listing #${id} (status: ${nextStatus})`,
    ipAddress: getClientIp(req),
  });

  const updated = db.prepare('SELECT * FROM listings WHERE id = ?').get(id) as Record<string, unknown>;
  res.json(serializeListingRow(updated));
});

app.delete('/api/v1/admin/listings/:id', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const id = String(req.params.id);
  const db = getDb();
  const info = db.prepare('DELETE FROM listings WHERE id = ?').run(id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Listing not found.' });
    return;
  }
  writeAuditLog({
    actorUserId: ctx.user.id,
    actorPhone: ctx.user.phoneE164,
    actorRole: 'admin',
    action: 'admin.listing_deleted',
    target: id,
    details: `Deleted listing #${id}`,
    ipAddress: getClientIp(req),
  });
  res.json({ success: true });
});

// Projects Admin CRUD
app.get('/api/v1/admin/projects', requireAuth, requireAdmin, (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM projects ORDER BY created_at DESC')
    .all() as Array<Record<string, unknown>>;
  res.json(rows.map(serializeProjectRow));
});

app.post('/api/v1/admin/projects', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const body = req.body as Record<string, unknown>;
  const name = String(body.name || '').trim().slice(0, 140);
  const developerName = String(body.developerName || '').trim().slice(0, 120);
  if (!name || !developerName) {
    res.status(400).json({ error: 'Project name and developer name are required.' });
    return;
  }

  let heroImage = String(body.heroImage || '').trim();
  if (heroImage.startsWith('data:image/')) {
    const processed = await normalizeAndWatermarkListingImages([heroImage], ctx.user.id);
    heroImage = processed.publicUrls[0] || '';
  }

  const id = `prj-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
  const nowIso = new Date().toISOString();
  const db = getDb();

  db.prepare(
    `INSERT INTO projects (
      id, name, developer_name, developer_logo, city, district, address, stage,
      starting_price, currency, types_json, hero_image, featured, handover_date,
      units_json, description, leads_count, progress_percent, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
  ).run(
    id,
    name,
    developerName,
    String(body.developerLogo || '/assets/aistudio/GuriHel-mark_d2d21036.png').slice(0, 500),
    String(body.city || 'Hargeisa').slice(0, 60),
    String(body.district || 'Jigjiga Yar').slice(0, 80),
    String(body.address || '').slice(0, 200),
    ['off_plan', 'building', 'ready'].includes(String(body.stage)) ? String(body.stage) : 'off_plan',
    Math.max(0, Number(body.startingPrice) || 0),
    JSON.stringify(Array.isArray(body.types) ? body.types : ['Apartment']),
    heroImage || '/assets/aistudio/GuriHel-app-icon-512-square_b480890b.png',
    body.featured ? 1 : 0,
    String(body.handoverDate || 'Q4 2027').slice(0, 40),
    JSON.stringify(Array.isArray(body.units) ? body.units : []),
    String(body.description || '').slice(0, 2000),
    Math.max(0, Math.min(100, Number(body.progressPercent) || 0)),
    nowIso,
    nowIso
  );

  writeAuditLog({
    actorUserId: ctx.user.id,
    actorPhone: ctx.user.phoneE164,
    actorRole: 'admin',
    action: 'admin.project_created',
    target: id,
    details: `Created project "${name}"`,
    ipAddress: getClientIp(req),
  });

  const created = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown>;
  res.status(201).json(serializeProjectRow(created));
});

app.delete('/api/v1/admin/projects/:id', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const id = String(req.params.id);
  const db = getDb();
  const info = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  writeAuditLog({
    actorUserId: ctx.user.id,
    actorPhone: ctx.user.phoneE164,
    actorRole: 'admin',
    action: 'admin.project_deleted',
    target: id,
    details: `Deleted project ${id}`,
    ipAddress: getClientIp(req),
  });
  res.json({ success: true });
});

// Users Admin Management & Password Recovery Fulfillment
app.get('/api/v1/admin/users', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const roleFilter = String(req.query.role || '').trim().toLowerCase();
  const statusFilter = String(req.query.status || '').trim().toLowerCase();

  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM users ORDER BY is_primary_admin DESC, created_at DESC')
    .all() as Array<Record<string, unknown>>;

  let users = rows.map(rowToDbUser);
  if (roleFilter && ['super_admin', 'admin', 'user'].includes(roleFilter)) {
    users = users.filter((u) => u.role === roleFilter);
  }
  if (statusFilter && ['active', 'blocked'].includes(statusFilter)) {
    users = users.filter((u) => u.status === statusFilter);
  }
  if (q) {
    users = users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.fullName.toLowerCase().includes(q) ||
        u.phoneE164.toLowerCase().includes(q)
    );
  }

  res.json(users);
});

app.patch('/api/v1/admin/users/:id', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const targetId = String(req.params.id);
  const db = getDb();
  const targetRow = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(targetId) as Record<string, unknown> | undefined;

  if (!targetRow) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const targetUser = rowToDbUser(targetRow);
  const body = req.body as { status?: string; fullName?: string; city?: string; role?: string };

  const requestedStatus: AccountStatus =
    body.status === 'blocked' || body.status === 'suspended'
      ? 'blocked'
      : body.status === 'active'
      ? 'active'
      : targetUser.status;
  const requestedRole: AuthRole =
    body.role === 'admin' || body.role === 'user'
      ? (body.role as AuthRole)
      : body.role === 'super_admin' && targetUser.isPrimaryAdmin
      ? 'super_admin'
      : targetUser.role;

  // Primary Admin strict protections
  if (targetUser.isPrimaryAdmin) {
    if (requestedStatus === 'blocked') {
      res.status(403).json({
        error: 'The Primary Administrator account cannot be blocked.',
        code: 'PRIMARY_ADMIN_PROTECTED',
      });
      return;
    }
    if (requestedRole !== 'super_admin') {
      res.status(403).json({
        error: 'The Primary Administrator role cannot be demoted.',
        code: 'PRIMARY_ADMIN_PROTECTED',
      });
      return;
    }
  }

  if (body.role === 'super_admin' && !targetUser.isPrimaryAdmin) {
    res.status(403).json({
      error: 'The super_admin role is reserved exclusively for the Primary Administrator.',
      code: 'PRIMARY_ADMIN_PROTECTED',
    });
    return;
  }

  // Last active admin protection
  if (
    isAdminRole(targetUser.role) &&
    targetUser.status === 'active' &&
    (!isAdminRole(requestedRole) || requestedStatus === 'blocked')
  ) {
    const activeAdmins = (
      db
        .prepare("SELECT COUNT(*) AS c FROM users WHERE role IN ('super_admin', 'admin') AND status = 'active'")
        .get() as { c: number }
    ).c;
    if (activeAdmins <= 1) {
      res.status(400).json({
        error: 'Cannot block or demote the last active Administrator.',
        code: 'LAST_ADMIN_PROTECTED',
      });
      return;
    }
  }

  const nowIso = new Date().toISOString();
  db.prepare(
    'UPDATE users SET status = ?, role = ?, full_name = ?, city = ?, updated_at = ? WHERE id = ?'
  ).run(
    requestedStatus,
    requestedRole,
    body.fullName !== undefined ? String(body.fullName).trim().slice(0, 100) : targetUser.fullName,
    body.city !== undefined ? String(body.city).trim().slice(0, 60) : targetUser.city,
    nowIso,
    targetId
  );

  if (requestedStatus === 'blocked' || requestedRole !== targetUser.role) {
    db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(
      nowIso,
      targetId
    );
  }

  writeAuditLog({
    actorUserId: ctx.user.id,
    actorUsername: ctx.user.username,
    actorPhone: ctx.user.phoneE164,
    actorRole: 'admin',
    action: 'admin.user_updated',
    target: targetId,
    details: `Updated @${targetUser.username || targetUser.email} -> role: ${requestedRole}, status: ${requestedStatus}`,
    ipAddress: getClientIp(req),
  });

  const updated = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(targetId) as Record<string, unknown>;
  res.json(rowToDbUser(updated));
});

app.delete('/api/v1/admin/users/:id', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const targetId = String(req.params.id);
  const db = getDb();
  const targetRow = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(targetId) as Record<string, unknown> | undefined;

  if (!targetRow) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const targetUser = rowToDbUser(targetRow);
  if (targetUser.isPrimaryAdmin) {
    res.status(403).json({
      error: 'The Primary Administrator account cannot be deleted.',
      code: 'PRIMARY_ADMIN_PROTECTED',
    });
    return;
  }
  if (targetUser.id === ctx.user.id) {
    res.status(400).json({
      error: 'You cannot delete your own active session account.',
      code: 'CANNOT_DELETE_SELF',
    });
    return;
  }
  if (isAdminRole(targetUser.role) && targetUser.status === 'active') {
    const activeAdmins = (
      db
        .prepare("SELECT COUNT(*) AS c FROM users WHERE role IN ('super_admin', 'admin') AND status = 'active'")
        .get() as { c: number }
    ).c;
    if (activeAdmins <= 1) {
      res.status(400).json({
        error: 'Cannot delete the last active Administrator.',
        code: 'LAST_ADMIN_PROTECTED',
      });
      return;
    }
  }

  db.exec('BEGIN IMMEDIATE;');
  try {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetId);
    db.prepare('DELETE FROM favorites WHERE user_id = ?').run(targetId);
    db.prepare('DELETE FROM password_reset_requests WHERE user_id = ?').run(targetId);
    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  writeAuditLog({
    actorUserId: ctx.user.id,
    actorUsername: ctx.user.username,
    actorPhone: ctx.user.phoneE164,
    actorRole: 'admin',
    action: 'admin.user_deleted',
    target: targetId,
    details: `Deleted account @${targetUser.username || targetUser.email} (${targetUser.email})`,
    ipAddress: getClientIp(req),
  });

  res.json({ success: true });
});

app.get('/api/v1/admin/password-resets', requireAuth, requireAdmin, (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT pr.*, u.full_name AS full_name
       FROM password_reset_requests pr
       LEFT JOIN users u ON u.id = pr.user_id
       ORDER BY pr.created_at DESC LIMIT 100`
    )
    .all() as Array<Record<string, unknown>>;

  res.json(
    rows.map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      username: String(r.username),
      email: String(r.email),
      fullName: String(r.full_name || ''),
      status: String(r.status),
      expiresAt: String(r.expires_at || ''),
      requestedIp: String(r.requested_ip || ''),
      handledByAdminId: String(r.handled_by_admin_id || ''),
      notes: String(r.notes || ''),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
      completedAt: r.completed_at ? String(r.completed_at) : null,
    }))
  );
});

app.post(
  '/api/v1/admin/password-resets/:id/issue',
  requireAuth,
  requireAdmin,
  (req: AuthedRequest, res: Response) => {
    const ctx = req.auth!;
    const id = String(req.params.id);
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM password_reset_requests WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;

    if (!row) {
      res.status(404).json({ error: 'Password reset request not found.' });
      return;
    }
    if (String(row.status) === 'completed') {
      res.status(409).json({ error: 'This password reset request has already been completed.' });
      return;
    }

    const part1 = crypto.randomBytes(3).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(3).toString('hex').toUpperCase();
    const oneTimeCode = `GH-${part1}-${part2}`;
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const expiresAt = new Date(nowMs + 30 * 60 * 1000).toISOString();

    db.prepare(
      `UPDATE password_reset_requests
       SET status = 'issued', reset_token_hash = ?, expires_at = ?, handled_by_admin_id = ?, updated_at = ?
       WHERE id = ?`
    ).run(sha256Hex(oneTimeCode), expiresAt, ctx.user.id, nowIso, id);

    writeAuditLog({
      actorUserId: ctx.user.id,
      actorUsername: ctx.user.username,
      actorRole: 'admin',
      action: 'admin.password_reset_issued',
      target: id,
      details: `Issued 30-minute one-time recovery code for @${String(row.username)}`,
      ipAddress: getClientIp(req),
    });

    res.json({
      success: true,
      id,
      username: String(row.username),
      resetCode: oneTimeCode,
      expiresAt,
    });
  }
);

app.post(
  '/api/v1/admin/password-resets/:id/reject',
  requireAuth,
  requireAdmin,
  (req: AuthedRequest, res: Response) => {
    const ctx = req.auth!;
    const id = String(req.params.id);
    const db = getDb();
    const nowIso = new Date().toISOString();
    const info = db
      .prepare(
        `UPDATE password_reset_requests
         SET status = 'rejected', reset_token_hash = '', handled_by_admin_id = ?, updated_at = ?
         WHERE id = ? AND status != 'completed'`
      )
      .run(ctx.user.id, nowIso, id);

    if (info.changes === 0) {
      res.status(404).json({ error: 'Pending password reset request not found.' });
      return;
    }

    writeAuditLog({
      actorUserId: ctx.user.id,
      actorUsername: ctx.user.username,
      actorRole: 'admin',
      action: 'admin.password_reset_rejected',
      target: id,
      details: `Rejected password reset request ${id}`,
      ipAddress: getClientIp(req),
    });

    res.json({ success: true });
  }
);

// Admin Bookings, Requests, Leases Management
app.get('/api/v1/admin/bookings', requireAuth, requireAdmin, (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM bookings ORDER BY created_at DESC')
    .all() as Array<Record<string, unknown>>;
  res.json(rows);
});

app.patch('/api/v1/admin/bookings/:id', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const id = String(req.params.id);
  const status = String((req.body as { status?: string }).status || '');
  if (!['held', 'confirmed', 'cancelled'].includes(status)) {
    res.status(400).json({ error: 'Invalid booking status.' });
    return;
  }
  const db = getDb();
  const info = db
    .prepare('UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, new Date().toISOString(), id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Booking not found.' });
    return;
  }
  writeAuditLog({
    actorUserId: ctx.user.id,
    actorPhone: ctx.user.phoneE164,
    actorRole: 'admin',
    action: 'admin.booking_status',
    target: id,
    details: `Booking ${id} -> ${status}`,
    ipAddress: getClientIp(req),
  });
  res.json({ success: true, id, status });
});

app.get('/api/v1/admin/requests', requireAuth, requireAdmin, (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM search_requests ORDER BY created_at DESC')
    .all() as Array<Record<string, unknown>>;
  res.json(rows);
});

app.patch('/api/v1/admin/requests/:id', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const id = String(req.params.id);
  const status = String((req.body as { status?: string }).status || '');
  if (!['open', 'matched', 'closed'].includes(status)) {
    res.status(400).json({ error: 'Invalid request status.' });
    return;
  }
  const db = getDb();
  const info = db
    .prepare('UPDATE search_requests SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, new Date().toISOString(), id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Search request not found.' });
    return;
  }
  writeAuditLog({
    actorUserId: ctx.user.id,
    actorPhone: ctx.user.phoneE164,
    actorRole: 'admin',
    action: 'admin.request_status',
    target: id,
    details: `Request ${id} -> ${status}`,
    ipAddress: getClientIp(req),
  });
  res.json({ success: true, id, status });
});

app.get('/api/v1/admin/leases', requireAuth, requireAdmin, (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM lease_contracts ORDER BY created_at DESC')
    .all() as Array<Record<string, unknown>>;
  res.json(rows);
});

// Media & Watermark Management
app.get('/api/v1/admin/media', requireAuth, requireAdmin, (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM media_assets ORDER BY created_at DESC')
    .all() as Array<Record<string, unknown>>;
  res.json(
    rows.map((r) => ({
      id: String(r.id),
      url: `/api/v1/media/${String(r.id)}`,
      originalUrl: `/api/v1/media/${String(r.id)}/original`,
      uploadedByUserId: String(r.uploaded_by_user_id),
      mimeType: String(r.mime_type),
      width: Number(r.width),
      height: Number(r.height),
      watermarked: Boolean(r.watermarked),
      watermarkPosition: String(r.watermark_position),
      watermarkOpacity: Number(r.watermark_opacity),
      watermarkVariant: String(r.watermark_variant),
      createdAt: String(r.created_at),
    }))
  );
});

app.post('/api/v1/admin/media/:id/rewatermark', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const id = String(req.params.id);
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM media_assets WHERE id = ?')
    .get(id) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({ error: 'Media asset not found.' });
    return;
  }

  const originalPath = String(row.original_path);
  const watermarkedPath = String(row.watermarked_path);
  if (!fs.existsSync(originalPath)) {
    res.status(404).json({ error: 'Original file is missing; cannot re-watermark cleanly.' });
    return;
  }

  const settings = getSystemSettings();
  const override = req.body && Object.keys(req.body).length > 0
    ? sanitizeWatermarkSettings({ ...settings.watermark, ...(req.body as object) })
    : settings.watermark;

  const meta = await applyOfficialWatermarkFromOriginal(originalPath, watermarkedPath, override);
  db.prepare(
    `UPDATE media_assets SET watermarked = ?, watermark_position = ?, watermark_opacity = ?, watermark_variant = ? WHERE id = ?`
  ).run(meta.watermarked ? 1 : 0, override.position, override.opacity, override.variant, id);

  writeAuditLog({
    actorUserId: ctx.user.id,
    actorPhone: ctx.user.phoneE164,
    actorRole: 'admin',
    action: 'admin.media_rewatermarked',
    target: id,
    details: `Re-applied single watermark (${override.position}, opacity ${override.opacity}) from original`,
    ipAddress: getClientIp(req),
  });

  res.json({ success: true, id, watermarked: meta.watermarked });
});

app.delete('/api/v1/admin/media/:id', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const id = String(req.params.id);
  const db = getDb();
  const row = db
    .prepare('SELECT original_path, watermarked_path FROM media_assets WHERE id = ?')
    .get(id) as { original_path: string; watermarked_path: string } | undefined;
  if (!row) {
    res.status(404).json({ error: 'Media asset not found.' });
    return;
  }
  try {
    if (fs.existsSync(row.original_path)) fs.unlinkSync(row.original_path);
    if (fs.existsSync(row.watermarked_path)) fs.unlinkSync(row.watermarked_path);
  } catch {
    // Ignore disk cleanup failure
  }
  db.prepare('DELETE FROM media_assets WHERE id = ?').run(id);
  writeAuditLog({
    actorUserId: ctx.user.id,
    actorPhone: ctx.user.phoneE164,
    actorRole: 'admin',
    action: 'admin.media_deleted',
    target: id,
    details: `Deleted media asset ${id}`,
    ipAddress: getClientIp(req),
  });
  res.json({ success: true });
});

// Settings & Batch Watermark Update
app.get('/api/v1/admin/settings', requireAuth, requireAdmin, (_req: Request, res: Response) => {
  res.json({
    settings: getSystemSettings(),
    primaryAdminEmail: PRIMARY_ADMIN_EMAIL,
  });
});

app.put('/api/v1/admin/settings', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const body = req.body as {
    platformName?: string;
    supportPhone?: string;
    defaultCity?: string;
    requireListingModeration?: boolean;
    watermark?: Record<string, unknown>;
    reapplyExistingMedia?: boolean;
  };

  const next = updateSystemSettings({
    platformName: body.platformName,
    supportPhone: body.supportPhone,
    defaultCity: body.defaultCity,
    requireListingModeration: body.requireListingModeration,
    watermark: body.watermark ? sanitizeWatermarkSettings(body.watermark) : undefined,
  });

  let reprocessedCount = 0;
  if (body.reapplyExistingMedia) {
    const db = getDb();
    const assets = db
      .prepare('SELECT id, original_path, watermarked_path FROM media_assets')
      .all() as Array<{ id: string; original_path: string; watermarked_path: string }>;
    for (const asset of assets) {
      if (fs.existsSync(asset.original_path)) {
        const meta = await applyOfficialWatermarkFromOriginal(
          asset.original_path,
          asset.watermarked_path,
          next.watermark
        );
        db.prepare(
          `UPDATE media_assets SET watermarked = ?, watermark_position = ?, watermark_opacity = ?, watermark_variant = ? WHERE id = ?`
        ).run(
          meta.watermarked ? 1 : 0,
          next.watermark.position,
          next.watermark.opacity,
          next.watermark.variant,
          asset.id
        );
        reprocessedCount += 1;
      }
    }
  }

  writeAuditLog({
    actorUserId: ctx.user.id,
    actorPhone: ctx.user.phoneE164,
    actorRole: 'admin',
    action: 'admin.settings_updated',
    target: 'global',
    details: `Updated platform & watermark settings (reprocessed ${reprocessedCount} images)`,
    ipAddress: getClientIp(req),
  });

  res.json({
    success: true,
    settings: next,
    reprocessedCount,
  });
});

// Reports & Statistics (strictly real DB aggregations)
app.get('/api/v1/admin/reports', requireAuth, requireAdmin, (_req: Request, res: Response) => {
  const db = getDb();
  const byDistrict = db
    .prepare(
      `SELECT district, COUNT(*) AS count, COALESCE(AVG(price), 0) AS avgPrice
       FROM listings GROUP BY district ORDER BY count DESC`
    )
    .all();
  const byPurpose = db
    .prepare(
      `SELECT purpose, COUNT(*) AS count, COALESCE(SUM(price), 0) AS totalValue
       FROM listings GROUP BY purpose`
    )
    .all();
  const byType = db
    .prepare('SELECT property_type AS propertyType, COUNT(*) AS count FROM listings GROUP BY property_type')
    .all();
  const byStatus = db
    .prepare('SELECT status, COUNT(*) AS count FROM listings GROUP BY status')
    .all();

  res.json({
    byDistrict,
    byPurpose,
    byType,
    byStatus,
    districtBenchmarks: DISTRICT_PRICE_TRENDS,
  });
});

// Data Exports (CSV / JSON)
app.get('/api/v1/admin/export/:resource', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const resource = String(req.params.resource || '').toLowerCase();
  const format = String(req.query.format || 'csv').toLowerCase();
  const db = getDb();

  const tableMap: Record<string, string> = {
    listings: 'listings',
    users: 'users',
    bookings: 'bookings',
    requests: 'search_requests',
    leases: 'lease_contracts',
    projects: 'projects',
    audit_logs: 'audit_logs',
  };

  const tableName = tableMap[resource];
  if (!tableName) {
    res.status(400).json({ error: 'Unsupported export resource.' });
    return;
  }

  const rows =
    tableName === 'users'
      ? (db
          .prepare(
            `SELECT id, username, email, phone_e164, role, is_primary_admin, email_verified, full_name, city, language, profile_completed, status, created_at, updated_at, last_login_at
             FROM users ORDER BY created_at DESC`
          )
          .all() as Array<Record<string, unknown>>)
      : (db.prepare(`SELECT * FROM ${tableName} ORDER BY created_at DESC`).all() as Array<
          Record<string, unknown>
        >);

  writeAuditLog({
    actorUserId: ctx.user.id,
    actorUsername: ctx.user.email || ctx.user.username,
    actorPhone: ctx.user.phoneE164,
    actorRole: ctx.user.role,
    action: 'admin.data_exported',
    target: `${resource}.${format}`,
    details: `Exported ${rows.length} rows from ${resource} as ${format.toUpperCase()}`,
    ipAddress: getClientIp(req),
  });

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="gurihel-${resource}.json"`);
    res.send(JSON.stringify(rows, null, 2));
    return;
  }

  const columns =
    rows.length > 0
      ? Object.keys(rows[0])
      : ['id', 'created_at'];
  const csvLines = [
    columns.map(csvSafeCell).join(','),
    ...rows.map((r) => columns.map((col) => csvSafeCell(r[col])).join(',')),
  ];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="gurihel-${resource}.csv"`);
  res.send(csvLines.join('\n'));
});

// Sessions & Audit Logs
app.get('/api/v1/admin/sessions', requireAuth, requireAdmin, (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, user_id, username, phone_e164, role, device_label, ip_address, remember_me, expires_at, refresh_expires_at, revoked_at, created_at, last_seen_at
       FROM sessions ORDER BY created_at DESC LIMIT 100`
    )
    .all() as Array<Record<string, unknown>>;
  res.json(
    rows.map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      username: String(r.username || ''),
      phoneE164: String(r.phone_e164 || ''),
      role: String(r.role),
      deviceLabel: String(r.device_label),
      ipAddress: String(r.ip_address),
      rememberMe: Boolean(r.remember_me),
      expiresAt: String(r.refresh_expires_at || r.expires_at),
      revokedAt: r.revoked_at ? String(r.revoked_at) : null,
      createdAt: String(r.created_at),
      lastSeenAt: String(r.last_seen_at),
    }))
  );
});

app.post('/api/v1/admin/sessions/:id/revoke', requireAuth, requireAdmin, (req: AuthedRequest, res: Response) => {
  const ctx = req.auth!;
  const id = String(req.params.id);
  const db = getDb();
  const nowIso = new Date().toISOString();
  const info = db
    .prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
    .run(nowIso, id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Active session not found.' });
    return;
  }
  writeAuditLog({
    actorUserId: ctx.user.id,
    actorUsername: ctx.user.username,
    actorPhone: ctx.user.phoneE164,
    actorRole: 'admin',
    action: 'admin.session_revoked',
    target: id,
    details: `Revoked session ${id}`,
    ipAddress: getClientIp(req),
  });
  res.json({ success: true });
});

app.get('/api/v1/admin/audit-logs', requireAuth, requireAdmin, (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 150')
    .all() as Array<Record<string, unknown>>;
  res.json(
    rows.map((r) => ({
      id: String(r.id),
      actorUserId: String(r.actor_user_id),
      actorUsername: String(r.actor_username || r.actor_phone || 'system'),
      actorPhone: String(r.actor_phone || ''),
      actorRole: String(r.actor_role),
      action: String(r.action),
      target: String(r.target),
      details: String(r.details),
      ipAddress: String(r.ip_address),
      createdAt: String(r.created_at),
    }))
  );
});

// ============================================================================
// 5. HEALTH & AI PROPERTY SEARCH
// ============================================================================

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    authMode: 'email-otp-rbac',
    emailProviderConfigured: isEmailProviderConfigured(),
    geminiConfigured: Boolean(apiKey),
    database: 'sqlite (persistent)',
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/ai/search', async (req: Request, res: Response) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: 'Query is required' });
    return;
  }

  const ai = (await getAiClient()) as {
    models: {
      generateContent: (args: unknown) => Promise<{ text?: string }>;
    };
  } | null;

  if (ai) {
    try {
      const { Type } = await import('@google/genai');
      const prompt = `
Waxaad tahay kaaliyaha caqliga macmalka ah (AI Assistant) ee hantida ma-guurtada ah ee GuriHel, oo ka hawlgalaya magaalada Hargeysa, Somaliland.
Macaamiilku wuxuu raadinayaa hanti isagoo adeegsanaya af-Soomaali ama Ingiriisi.
Falanqee codsiga raadinta: "${query}"

Magaalooyinka iyo degmooyinka ugu caansan Hargeysa waa:
- Jigjiga Yar
- Ibraahim Koodbuur
- 26 June
- Ahmed Dhagax
- Shacabka
- Masalaha
- Madaarka Cigaal / Airport Road
- Berbera
- Burco

Kala saar ujeedka (purpose: rent, sale, booking, ama any), nooca hantida (property_type: villa, apartment, land, commercial, building, ama all), degmada (district), qiimaha ugu yar (minPrice) iyo kan ugu sarreeya (maxPrice) haddii la xusay (USD ahaan), qolalka (minBedrooms), iyo sharaxaad kooban oo af-Soomaali ah (explanation) oo ku saabsan waxa la helay.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              purpose: { type: Type.STRING },
              property_type: { type: Type.STRING },
              district: { type: Type.STRING },
              minPrice: { type: Type.NUMBER },
              maxPrice: { type: Type.NUMBER },
              minBedrooms: { type: Type.INTEGER },
              keywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              explanation: { type: Type.STRING },
            },
            required: ['purpose', 'property_type', 'explanation'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      res.json({
        success: true,
        source: 'gemini-4-hydrogen',
        result: parsed,
      });
      return;
    } catch (err: unknown) {
      console.warn('Gemini search encountered an error, falling back to local NLP heuristics:', err);
    }
  }

  // Graceful deterministic fallback parser
  const qLower = query.toLowerCase();
  let purpose = 'any';
  if (qLower.includes('kiro') || qLower.includes('kiraysan') || qLower.includes('rent')) purpose = 'rent';
  else if (qLower.includes('iib') || qLower.includes('iibin') || qLower.includes('sale') || qLower.includes('buy')) purpose = 'sale';
  else if (qLower.includes('ballan') || qLower.includes('habeen') || qLower.includes('book') || qLower.includes('hotel')) purpose = 'booking';

  let property_type = 'all';
  if (qLower.includes('villa') || qLower.includes('fila')) property_type = 'villa';
  else if (qLower.includes('apartment') || qLower.includes('abaartman') || qLower.includes('flat')) property_type = 'apartment';
  else if (qLower.includes('dhul') || qLower.includes('boos') || qLower.includes('land') || qLower.includes('plot')) property_type = 'land';
  else if (qLower.includes('dabaq') || qLower.includes('building')) property_type = 'building';
  else if (qLower.includes('dukaan') || qLower.includes('xafiis') || qLower.includes('commercial')) property_type = 'commercial';

  let district = '';
  if (qLower.includes('jigjiga') || qLower.includes('jigjigayari')) district = 'Jigjiga Yar';
  else if (qLower.includes('koodbuur') || qLower.includes('ibraahim')) district = 'Ibraahim Koodbuur';
  else if (qLower.includes('26') || qLower.includes('june')) district = '26 June';
  else if (qLower.includes('ahmed') || qLower.includes('dhagax')) district = 'Ahmed Dhagax';
  else if (qLower.includes('shacabka')) district = 'Shacabka';
  else if (qLower.includes('masalaha')) district = 'Masalaha';
  else if (qLower.includes('berbera')) district = 'Berbera';
  else if (qLower.includes('burco')) district = 'Burco';

  let maxPrice: number | null = null;
  const priceMatch = query.match(/(?:<|ka yar|dhan|illaa|\$)\s*(\d{2,6})/i);
  if (priceMatch) {
    maxPrice = parseInt(priceMatch[1], 10);
  }

  let minBedrooms: number | null = null;
  const bedMatch = query.match(/(\d+)\s*(?:qol|bed|jiif)/i);
  if (bedMatch) {
    minBedrooms = parseInt(bedMatch[1], 10);
  }

  const explanation = `Waxaan fahannay inaad raadinayso ${property_type !== 'all' ? property_type : 'hanti'} ${purpose !== 'any' ? (purpose === 'rent' ? 'kiro ah' : purpose === 'sale' ? 'iib ah' : 'ballan kireysi ah') : ''}${district ? ` oo ku taal degmada ${district}` : ''}${minBedrooms ? ` leh ugu yaraan ${minBedrooms} qol` : ''}${maxPrice ? ` qiimihiisuna gaarayo illaa $${maxPrice}` : ''}.`;

  res.json({
    success: true,
    source: 'local-semantic',
    result: {
      purpose,
      property_type,
      district,
      minPrice: null,
      maxPrice,
      minBedrooms,
      keywords: [],
      explanation,
    },
  });
});

async function startServer() {
  const server = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vitePromise = import('vite').then(({ createServer: createViteServer }) =>
      createViteServer({
        server: {
          middlewareMode: true,
          hmr: process.env.DISABLE_HMR === 'true' ? false : { server },
          watch: process.env.DISABLE_HMR === 'true' ? null : {},
        },
        appType: 'spa',
      })
    );

    app.use(async (req: Request, res: Response, next: NextFunction) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, HOST, () => {
    console.log(`GuriHel Full-Stack Server running at http://${HOST}:${PORT}`);
  });
}

// Allow importing without auto-binding only when needed; normal startup always runs
startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
