import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
import { INITIAL_LISTINGS, INITIAL_PROJECTS, INITIAL_SEARCH_REQUESTS, INITIAL_LEASE_CONTRACTS, DISTRICT_PRICE_TRENDS } from './src/data/mockData';

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

const app = express();
const cliPort = getArgValue('--port');
const PORT = cliPort ? parseInt(cliPort, 10) : (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);
const HOST = getArgValue('--host') || '0.0.0.0';

app.use(express.json());
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// Lazy-load Gemini SDK so server binds port 3000 immediately on cold start
const apiKey = process.env.GEMINI_API_KEY || '';
let cachedAi: any = null;
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

// In-memory data store reflecting PostgreSQL tables
let dbListings = [...INITIAL_LISTINGS];
let dbProjects = [...INITIAL_PROJECTS];
let dbSearchRequests = [...INITIAL_SEARCH_REQUESTS];
let dbLeaseContracts = [...INITIAL_LEASE_CONTRACTS];

// ============================================================================
// SECTION 12: API DESIGN (REST Endpoints under /api/v1)
// ============================================================================

// 12.1 Auth & Users
app.post('/api/v1/auth/otp/request', (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone) {
    res.status(400).json({ error: 'Phone number required' });
    return;
  }
  res.json({
    success: true,
    message: `OTP 6-digit code loo diray ${phone}`,
    expiresInSeconds: 300,
  });
});

app.post('/api/v1/auth/otp/verify', (req: Request, res: Response) => {
  const { phone, code } = req.body;
  res.json({
    success: true,
    accessToken: `jwt_access_${Date.now()}`,
    refreshToken: `jwt_refresh_${Date.now()}`,
    user: {
      id: 'u-user-01',
      phone,
      role: 'seeker',
      status: 'active',
    },
  });
});

// 12.2 & 12.4 Listings & Map Viewport Query
// Response format verbatim matching Blueprint Section 12.4 Page 25
app.get('/api/v1/listings/map', (req: Request, res: Response) => {
  const purpose = req.query.purpose as string;
  const type = req.query.type as string;
  const maxPrice = req.query.price_max ? parseFloat(req.query.price_max as string) : null;

  let filtered = dbListings.filter((l) => l.status === 'live');
  if (purpose && purpose !== 'all') {
    filtered = filtered.filter((l) => l.purpose === purpose);
  }
  if (type && type !== 'all') {
    filtered = filtered.filter((l) => l.property_type === type);
  }
  if (maxPrice) {
    filtered = filtered.filter((l) => l.price <= maxPrice);
  }

  const pins = filtered.map((l) => ({
    id: l.id,
    lat: l.lat,
    lng: l.lng,
    price: l.price,
    label: l.price >= 1000000 ? `${(l.price / 1000000).toFixed(1)}M` : l.price >= 1000 ? `${Math.round(l.price / 1000)}K` : `$${l.price}`,
    verified: l.verified,
    featured: l.featured,
  }));

  res.json({
    total_matching: 23540,
    returned: filtered.length,
    pins,
    clusters: [
      { lat: 9.5600, lng: 44.0650, count: 18 },
      { lat: 9.5350, lng: 44.0850, count: 8 },
    ],
    cards: {
      broker: {
        name: 'District Broker',
        district: 'Jigjiga Yar',
        unread: true,
      },
      company: {
        name: 'Dahabshiil Real Estate',
        projects: 7,
      },
    },
  });
});

app.get('/api/v1/listings', (req: Request, res: Response) => {
  res.json({
    data: dbListings,
    total: dbListings.length,
  });
});

app.get('/api/v1/listings/:id', (req: Request, res: Response) => {
  const item = dbListings.find((l) => l.id === req.params.id);
  if (!item) {
    res.status(404).json({ error: 'Listing not found' });
    return;
  }
  res.json(item);
});

app.post('/api/v1/listings', (req: Request, res: Response) => {
  const newListing = {
    ...req.body,
    id: `hga-${Date.now().toString().slice(-4)}`,
    status: 'pending', // Pending moderation
    createdAt: new Date().toISOString(),
  };
  dbListings.unshift(newListing);
  res.status(201).json(newListing);
});

// 12.3 Projects, Bookings, Analytics
app.get('/api/v1/projects', (_req: Request, res: Response) => {
  res.json(dbProjects);
});

app.get('/api/v1/stats/avg-prices', (_req: Request, res: Response) => {
  res.json(DISTRICT_PRICE_TRENDS);
});

app.get('/api/v1/search-requests', (_req: Request, res: Response) => {
  res.json(dbSearchRequests);
});

app.post('/api/v1/search-requests', (req: Request, res: Response) => {
  const newReq = {
    ...req.body,
    id: `SR-${Date.now().toString().slice(-4)}`,
    createdAt: new Date().toISOString(),
    status: 'open',
  };
  dbSearchRequests.unshift(newReq);
  res.status(201).json(newReq);
});

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    geminiConfigured: Boolean(apiKey),
    techStack: {
      mobile: 'Flutter 3.x (Dart) + Riverpod',
      adminWeb: 'Next.js / React (TypeScript) + Tailwind',
      backendApi: 'NestJS / Express (TypeScript)',
      database: 'PostgreSQL 16 + PostGIS',
      cache: 'Redis 7',
    },
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// SUPER ADMIN SECURITY ENGINE (Doorashada A: Google Auth + 2FA TOTP + Step-Up)
// ============================================================================
const SUPER_ADMIN_EMAIL = 'ccasafari40@gmail.com';
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

let cachedFirebaseCfg: { apiKey?: string; firestoreDatabaseId?: string } | null = null;
function getFirebaseRuntimeConfig() {
  if (cachedFirebaseCfg) return cachedFirebaseCfg;
  try {
    const raw = fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf8');
    cachedFirebaseCfg = JSON.parse(raw);
  } catch {
    cachedFirebaseCfg = {};
  }
  return cachedFirebaseCfg!;
}

function getServerMasterKey(): Buffer {
  const cfg = getFirebaseRuntimeConfig();
  const seed =
    process.env.ADMIN_SESSION_SECRET ||
    `${cfg.apiKey || 'gurihel'}:${cfg.firestoreDatabaseId || 'default'}:superadmin-v1`;
  return crypto.createHash('sha256').update(seed).digest();
}

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function generateTotpCode(secretBase32: string, stepOffset = 0): string {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / 30) + stepOffset;
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter), 0);
  const hmac = crypto.createHmac('sha1', key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

function verifyTotpCode(secretBase32: string, code: string): boolean {
  const normalized = code.replace(/\s+/g, '').trim();
  if (!/^\d{6}$/.test(normalized)) return false;
  for (const offset of [-1, 0, 1]) {
    const candidate = generateTotpCode(secretBase32, offset);
    if (
      crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(normalized))
    ) {
      return true;
    }
  }
  return false;
}

function encryptSecret(plainText: string): string {
  const key = getServerMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}.${tag.toString('hex')}.${encrypted.toString('hex')}`;
}

function decryptSecret(payload: string): string | null {
  try {
    const parts = payload.split('.');
    if (parts.length !== 3) return null;
    const [ivHex, tagHex, dataHex] = parts;
    const key = getServerMasterKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    return plain.toString('utf8');
  } catch {
    return null;
  }
}

function sha256Hex(val: string): string {
  return crypto.createHash('sha256').update(val).digest('hex');
}

function generateRecoveryCodes(): { plain: string[]; hashes: string[] } {
  const plain: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const partA = crypto.randomBytes(2).toString('hex').toUpperCase();
    const partB = crypto.randomBytes(2).toString('hex').toUpperCase();
    const code = `GH-${partA}-${partB}`;
    plain.push(code);
    hashes.push(sha256Hex(code));
  }
  return { plain, hashes };
}

interface AdminTokenClaims {
  uid: string;
  email: string;
  subRole: 'super';
  epoch: number;
  deviceFp: string;
  iat: number;
  exp: number;
  stepUpUntil: number;
}

function signAdminSessionToken(claims: AdminTokenClaims): string {
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const sig = crypto.createHmac('sha256', getServerMasterKey()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyAdminSessionToken(token: string): AdminTokenClaims | null {
  try {
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = crypto.createHmac('sha256', getServerMasterKey()).update(body).digest('base64url');
    if (
      sig.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return null;
    }
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AdminTokenClaims;
    if (!claims || claims.exp < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

// Rate limiter: 5 failed 2FA attempts -> 15-minute lockout
const adminAuthAttempts = new Map<string, { failures: number; lockedUntil: number }>();

function checkAdminRateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const entry = adminAuthAttempts.get(key);
  if (!entry) return { allowed: true, retryAfterSeconds: 0 };
  if (entry.lockedUntil > Date.now()) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((entry.lockedUntil - Date.now()) / 1000),
    };
  }
  if (entry.lockedUntil > 0 && entry.lockedUntil <= Date.now()) {
    adminAuthAttempts.delete(key);
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

function recordAdminAuthFailure(key: string): { locked: boolean; remainingAttempts: number } {
  const prev = adminAuthAttempts.get(key) || { failures: 0, lockedUntil: 0 };
  const failures = prev.failures + 1;
  if (failures >= 5) {
    adminAuthAttempts.set(key, {
      failures,
      lockedUntil: Date.now() + 15 * 60 * 1000,
    });
    return { locked: true, remainingAttempts: 0 };
  }
  adminAuthAttempts.set(key, { failures, lockedUntil: 0 });
  return { locked: false, remainingAttempts: 5 - failures };
}

function clearAdminAuthFailures(key: string) {
  adminAuthAttempts.delete(key);
}

async function verifyFirebaseSuperAdminIdToken(
  idToken: string
): Promise<{ uid: string; email: string } | null> {
  if (!idToken || typeof idToken !== 'string') return null;
  const cfg = getFirebaseRuntimeConfig();
  if (!cfg.apiKey) return null;

  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(cfg.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      users?: Array<{ localId?: string; email?: string; emailVerified?: boolean }>;
    };
    const user = data.users?.[0];
    if (
      !user ||
      !user.localId ||
      !user.email ||
      !user.emailVerified ||
      user.email.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()
    ) {
      return null;
    }
    return { uid: user.localId, email: user.email };
  } catch {
    return null;
  }
}

// 1. Setup 2FA QR Code for Seeded Super Admin
app.post('/api/admin/2fa/setup', async (req: Request, res: Response) => {
  const { idToken } = req.body as { idToken?: string };
  const verifiedUser = await verifyFirebaseSuperAdminIdToken(idToken || '');
  if (!verifiedUser) {
    res.status(401).json({ error: 'Aqoonsiga Super Admin lama xaqiijin.' });
    return;
  }

  const secretBase32 = base32Encode(crypto.randomBytes(20));
  const issuer = 'GuriHel SuperAdmin';
  const otpauthUri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(
    verifiedUser.email
  )}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

  const qrDataUrl = await QRCode.toDataURL(otpauthUri, {
    width: 220,
    margin: 1,
    color: { dark: '#0F3D2A', light: '#FFFFFF' },
  });

  res.json({
    qrDataUrl,
    manualKey: secretBase32,
    encryptedSecret: encryptSecret(secretBase32),
  });
});

// 2. Confirm 2FA Setup + Issue 8 Recovery Codes + Initial 15-min Session
app.post('/api/admin/2fa/confirm-setup', async (req: Request, res: Response) => {
  const { idToken, encryptedSecret, code, deviceFp, sessionEpoch } = req.body as {
    idToken?: string;
    encryptedSecret?: string;
    code?: string;
    deviceFp?: string;
    sessionEpoch?: number;
  };

  const verifiedUser = await verifyFirebaseSuperAdminIdToken(idToken || '');
  if (!verifiedUser) {
    res.status(401).json({ error: 'Xogtu waa khalad ama lama xaqiijin.' });
    return;
  }

  const secret = encryptedSecret ? decryptSecret(encryptedSecret) : null;
  if (!secret || !code || !verifyTotpCode(secret, code)) {
    res.status(401).json({ error: 'Koodhka 6-da god ee 2FA waa khalad. Hubi saacadda taleefankaaga.' });
    return;
  }

  const recovery = generateRecoveryCodes();
  const now = Date.now();
  const expiresAt = now + 15 * 60 * 1000;
  const stepUpUntil = now + 5 * 60 * 1000;
  const epoch = typeof sessionEpoch === 'number' && sessionEpoch >= 1 ? sessionEpoch : 1;

  const adminSessionToken = signAdminSessionToken({
    uid: verifiedUser.uid,
    email: verifiedUser.email,
    subRole: 'super',
    epoch,
    deviceFp: String(deviceFp || 'web-device').slice(0, 120),
    iat: now,
    exp: expiresAt,
    stepUpUntil,
  });

  res.json({
    success: true,
    encryptedSecret,
    recoveryCodes: recovery.plain,
    recoveryCodeHashes: recovery.hashes,
    adminSessionToken,
    expiresAt,
    stepUpUntil,
    sessionEpoch: epoch,
  });
});

// 3. Daily 2FA Login Verify (TOTP or Single-Use Recovery Code) + Rate Limit
app.post('/api/admin/2fa/verify', async (req: Request, res: Response) => {
  const { idToken, encryptedSecret, code, recoveryCodeHashes, deviceFp, sessionEpoch } = req.body as {
    idToken?: string;
    encryptedSecret?: string;
    code?: string;
    recoveryCodeHashes?: string[];
    deviceFp?: string;
    sessionEpoch?: number;
  };

  const verifiedUser = await verifyFirebaseSuperAdminIdToken(idToken || '');
  if (!verifiedUser) {
    res.status(401).json({ error: 'Xogtu waa khalad.' });
    return;
  }

  const rateKey = `${verifiedUser.uid}:${req.ip || 'unknown'}`;
  const rate = checkAdminRateLimit(rateKey);
  if (!rate.allowed) {
    res.status(429).json({
      error: `Isku dayo badan oo khaldan awgood, fadlan sug ${Math.ceil(
        rate.retryAfterSeconds / 60
      )} daqiiqo.`,
      retryAfterSeconds: rate.retryAfterSeconds,
    });
    return;
  }

  const secret = encryptedSecret ? decryptSecret(encryptedSecret) : null;
  const rawCode = String(code || '').trim().toUpperCase();
  let verifiedByRecoveryIndex = -1;
  let valid = false;

  if (secret && verifyTotpCode(secret, rawCode)) {
    valid = true;
  } else if (Array.isArray(recoveryCodeHashes) && rawCode.startsWith('GH-')) {
    const incomingHash = sha256Hex(rawCode);
    const idx = recoveryCodeHashes.findIndex((h) => h === incomingHash);
    if (idx !== -1) {
      valid = true;
      verifiedByRecoveryIndex = idx;
    }
  }

  if (!valid) {
    const failInfo = recordAdminAuthFailure(rateKey);
    res.status(failInfo.locked ? 429 : 401).json({
      error: failInfo.locked
        ? '5 isku day oo khaldan: xisaabta waxaa la xidhay 15 daqiiqo.'
        : `Xogtu waa khalad. Waxaa kuu hadhay ${failInfo.remainingAttempts} isku day.`,
    });
    return;
  }

  clearAdminAuthFailures(rateKey);
  const now = Date.now();
  const expiresAt = now + 15 * 60 * 1000;
  const stepUpUntil = now + 5 * 60 * 1000;
  const epoch = typeof sessionEpoch === 'number' && sessionEpoch >= 1 ? sessionEpoch : 1;

  const adminSessionToken = signAdminSessionToken({
    uid: verifiedUser.uid,
    email: verifiedUser.email,
    subRole: 'super',
    epoch,
    deviceFp: String(deviceFp || 'web-device').slice(0, 120),
    iat: now,
    exp: expiresAt,
    stepUpUntil,
  });

  res.json({
    success: true,
    adminSessionToken,
    expiresAt,
    stepUpUntil,
    usedRecoveryIndex: verifiedByRecoveryIndex,
  });
});

// 4. Silent Access Token Refresh (15-min window rotation while active)
app.post('/api/admin/session/refresh', async (req: Request, res: Response) => {
  const { idToken, adminSessionToken, sessionEpoch } = req.body as {
    idToken?: string;
    adminSessionToken?: string;
    sessionEpoch?: number;
  };

  const verifiedUser = await verifyFirebaseSuperAdminIdToken(idToken || '');
  const claims = adminSessionToken ? verifyAdminSessionToken(adminSessionToken) : null;
  if (
    !verifiedUser ||
    !claims ||
    claims.uid !== verifiedUser.uid ||
    (typeof sessionEpoch === 'number' && claims.epoch !== sessionEpoch)
  ) {
    res.status(401).json({ error: 'Session-ku wuu dhacay. Fadlan mar kale gal.' });
    return;
  }

  const now = Date.now();
  const expiresAt = now + 15 * 60 * 1000;
  const nextToken = signAdminSessionToken({
    ...claims,
    iat: now,
    exp: expiresAt,
  });

  res.json({
    success: true,
    adminSessionToken: nextToken,
    expiresAt,
    stepUpUntil: claims.stepUpUntil,
  });
});

// 5. Step-Up Auth (Re-verify 2FA for high-risk actions -> 5-min window)
app.post('/api/admin/step-up', async (req: Request, res: Response) => {
  const { idToken, adminSessionToken, encryptedSecret, code } = req.body as {
    idToken?: string;
    adminSessionToken?: string;
    encryptedSecret?: string;
    code?: string;
  };

  const verifiedUser = await verifyFirebaseSuperAdminIdToken(idToken || '');
  const claims = adminSessionToken ? verifyAdminSessionToken(adminSessionToken) : null;
  if (!verifiedUser || !claims || claims.uid !== verifiedUser.uid) {
    res.status(401).json({ error: 'Session-ka Admin ma shaqaynayo.' });
    return;
  }

  const secret = encryptedSecret ? decryptSecret(encryptedSecret) : null;
  if (!secret || !code || !verifyTotpCode(secret, code)) {
    res.status(401).json({ error: 'Koodhka 2FA ee Step-Up waa khalad.' });
    return;
  }

  const now = Date.now();
  const stepUpUntil = now + 5 * 60 * 1000;
  const expiresAt = now + 15 * 60 * 1000;
  const nextToken = signAdminSessionToken({
    ...claims,
    iat: now,
    exp: expiresAt,
    stepUpUntil,
  });

  res.json({
    success: true,
    adminSessionToken: nextToken,
    expiresAt,
    stepUpUntil,
  });
});

// AI Search endpoint
app.post('/api/ai/search', async (req: Request, res: Response) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: 'Query is required' });
    return;
  }

  const ai = await getAiClient();
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
        model: 'gemini-3.8-flash',
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
        source: 'gemini-3.8-flash',
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

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
