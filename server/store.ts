import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  DEFAULT_WATERMARK_SETTINGS,
  WatermarkSettings,
  sanitizeWatermarkSettings,
} from './watermark';

export type AuthRole = 'super_admin' | 'admin' | 'user';
export type AccountStatus = 'active' | 'blocked';

export const PRIMARY_ADMIN_EMAIL = 'ddhamaan@gmail.com';

export function isAdminRole(role?: string | null): boolean {
  return role === 'super_admin' || role === 'admin';
}

export interface DbUser {
  id: string;
  username: string;
  email: string;
  phoneE164: string;
  role: AuthRole;
  isPrimaryAdmin: boolean;
  emailVerified: boolean;
  fullName: string;
  city: string;
  language: 'SO' | 'EN' | 'AR';
  profileCompleted: boolean;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface DbSession {
  id: string;
  userId: string;
  username: string;
  phoneE164: string;
  role: AuthRole;
  deviceLabel: string;
  ipAddress: string;
  rememberMe: boolean;
  expiresAt: string;
  refreshExpiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  lastSeenAt: string;
}

export interface SystemSettings {
  watermark: WatermarkSettings;
  platformName: string;
  supportPhone: string;
  defaultCity: string;
  requireListingModeration: boolean;
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  watermark: DEFAULT_WATERMARK_SETTINGS,
  platformName: 'GuriHel',
  supportPhone: '+252636786709',
  defaultCity: 'Hargeisa',
  requireListingModeration: true,
};

const DB_PATH =
  process.env.GURIHEL_DB_PATH || path.resolve(process.cwd(), 'data', 'gurihel.sqlite');

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  migrateSchemaNonDestructive(db);
  ensurePrimaryAdminProvisioned(db);
  dbInstance = db;
  return db;
}

function getColumnNames(db: DatabaseSync, tableName: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return new Set(rows.map((r) => String(r.name)));
}

function migrateSchemaNonDestructive(db: DatabaseSync): void {
  const existingUsersTable = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
    .get() as { sql?: string } | undefined;

  if (!existingUsersTable) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        phone_e164 TEXT NOT NULL DEFAULT '',
        password_hash TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'user',
        is_primary_admin INTEGER NOT NULL DEFAULT 0,
        email_verified INTEGER NOT NULL DEFAULT 0,
        full_name TEXT NOT NULL DEFAULT '',
        city TEXT NOT NULL DEFAULT 'Hargeisa',
        language TEXT NOT NULL DEFAULT 'SO',
        profile_completed INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_login_at TEXT
      );
    `);
  } else {
    const userCols = getColumnNames(db, 'users');
    const needsUsersMigration =
      /phone_e164\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i.test(String(existingUsersTable.sql || '')) ||
      !userCols.has('username') ||
      !userCols.has('email') ||
      !userCols.has('password_hash') ||
      !userCols.has('is_primary_admin') ||
      !userCols.has('last_login_at');

    if (needsUsersMigration) {
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.exec(`
          CREATE TABLE users_migrated (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL DEFAULT '',
            email TEXT NOT NULL DEFAULT '',
            phone_e164 TEXT NOT NULL DEFAULT '',
            password_hash TEXT NOT NULL DEFAULT '',
            role TEXT NOT NULL DEFAULT 'user',
            is_primary_admin INTEGER NOT NULL DEFAULT 0,
            email_verified INTEGER NOT NULL DEFAULT 0,
            full_name TEXT NOT NULL DEFAULT '',
            city TEXT NOT NULL DEFAULT 'Hargeisa',
            language TEXT NOT NULL DEFAULT 'SO',
            profile_completed INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_login_at TEXT
          );
        `);

        const hasUsername = userCols.has('username');
        const hasEmail = userCols.has('email');
        const hasPhone = userCols.has('phone_e164');
        const hasPasswordHash = userCols.has('password_hash');
        const hasPrimary = userCols.has('is_primary_admin');
        const hasEmailVerified = userCols.has('email_verified');
        const hasFullName = userCols.has('full_name');
        const hasCity = userCols.has('city');
        const hasLanguage = userCols.has('language');
        const hasProfileCompleted = userCols.has('profile_completed');
        const hasStatus = userCols.has('status');
        const hasLastLogin = userCols.has('last_login_at');

        const emailExpr = hasEmail ? "COALESCE(email, '')" : "''";
        const roleExpr = hasEmail
          ? `CASE WHEN LOWER(COALESCE(email, '')) = '${PRIMARY_ADMIN_EMAIL}' THEN 'super_admin' WHEN role = 'super_admin' THEN 'super_admin' WHEN role = 'admin' THEN 'admin' ELSE 'user' END`
          : `CASE WHEN role = 'super_admin' THEN 'super_admin' WHEN role = 'admin' THEN 'admin' ELSE 'user' END`;
        const primaryExpr = hasPrimary
          ? 'COALESCE(is_primary_admin, 0)'
          : hasEmail
          ? `CASE WHEN LOWER(COALESCE(email, '')) = '${PRIMARY_ADMIN_EMAIL}' THEN 1 ELSE 0 END`
          : '0';

        db.exec(`
          INSERT INTO users_migrated (
            id, username, email, phone_e164, password_hash, role, is_primary_admin, email_verified,
            full_name, city, language, profile_completed, status, created_at, updated_at, last_login_at
          )
          SELECT
            id,
            ${hasUsername ? "COALESCE(username, '')" : "''"},
            ${emailExpr},
            ${hasPhone ? "COALESCE(phone_e164, '')" : "''"},
            ${hasPasswordHash ? "COALESCE(password_hash, '')" : "''"},
            ${roleExpr},
            ${primaryExpr},
            ${hasEmailVerified ? 'COALESCE(email_verified, 0)' : '0'},
            ${hasFullName ? "COALESCE(full_name, '')" : "''"},
            ${hasCity ? "COALESCE(city, 'Hargeisa')" : "'Hargeisa'"},
            ${hasLanguage ? "COALESCE(language, 'SO')" : "'SO'"},
            ${hasProfileCompleted ? 'COALESCE(profile_completed, 1)' : '1'},
            ${hasStatus ? "CASE WHEN status IN ('suspended', 'blocked') THEN 'blocked' ELSE 'active' END" : "'active'"},
            created_at,
            updated_at,
            ${hasLastLogin ? 'last_login_at' : 'NULL'}
          FROM users;
        `);

        db.exec('DROP TABLE users;');
        db.exec('ALTER TABLE users_migrated RENAME TO users;');
        db.exec('COMMIT;');
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }
    } else if (!userCols.has('email_verified')) {
      db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;');
    }
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique
      ON users(LOWER(username)) WHERE TRIM(username) != '';
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
      ON users(LOWER(email)) WHERE TRIM(email) != '';
    CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL DEFAULT '',
      phone_e164 TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      refresh_token_hash TEXT NOT NULL DEFAULT '',
      device_label TEXT NOT NULL DEFAULT 'Client Device',
      ip_address TEXT NOT NULL DEFAULT '',
      remember_me INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      refresh_expires_at TEXT NOT NULL DEFAULT '',
      revoked_at TEXT,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_rate_limits (
      rate_key TEXT PRIMARY KEY,
      window_start INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS email_otp_codes (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 5,
      consumed_at TEXT,
      invalidated_at TEXT,
      requested_ip TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_email_otp_lookup
      ON email_otp_codes(LOWER(email), created_at DESC);

    CREATE TABLE IF NOT EXISTS password_reset_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      reset_token_hash TEXT NOT NULL DEFAULT '',
      expires_at TEXT NOT NULL DEFAULT '',
      requested_ip TEXT NOT NULL DEFAULT '',
      handled_by_admin_id TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      uploaded_by_user_id TEXT NOT NULL,
      original_path TEXT NOT NULL,
      watermarked_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      width INTEGER NOT NULL DEFAULT 0,
      height INTEGER NOT NULL DEFAULT 0,
      watermarked INTEGER NOT NULL DEFAULT 1,
      watermark_position TEXT NOT NULL DEFAULT 'bottom-right',
      watermark_opacity REAL NOT NULL DEFAULT 0.34,
      watermark_variant TEXT NOT NULL DEFAULT 'primary',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      purpose TEXT NOT NULL,
      property_type TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      price_unit TEXT NOT NULL DEFAULT 'total',
      area_m2 REAL NOT NULL DEFAULT 0,
      bedrooms INTEGER NOT NULL DEFAULT 0,
      living_rooms INTEGER NOT NULL DEFAULT 1,
      bathrooms INTEGER NOT NULL DEFAULT 1,
      city TEXT NOT NULL DEFAULT 'Hargeisa',
      district TEXT NOT NULL DEFAULT 'Jigjiga Yar',
      address TEXT NOT NULL DEFAULT '',
      lat REAL NOT NULL DEFAULT 9.558,
      lng REAL NOT NULL DEFAULT 44.068,
      verified INTEGER NOT NULL DEFAULT 0,
      featured INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      images_json TEXT NOT NULL DEFAULT '[]',
      original_images_json TEXT NOT NULL DEFAULT '[]',
      amenities_json TEXT NOT NULL DEFAULT '[]',
      broker_json TEXT NOT NULL DEFAULT '{}',
      views INTEGER NOT NULL DEFAULT 0,
      rejection_reason TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      developer_name TEXT NOT NULL,
      developer_logo TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT 'Hargeisa',
      district TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      stage TEXT NOT NULL DEFAULT 'off_plan',
      starting_price REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      types_json TEXT NOT NULL DEFAULT '[]',
      hero_image TEXT NOT NULL DEFAULT '',
      featured INTEGER NOT NULL DEFAULT 0,
      handover_date TEXT NOT NULL DEFAULT '',
      units_json TEXT NOT NULL DEFAULT '[]',
      description TEXT NOT NULL DEFAULT '',
      leads_count INTEGER NOT NULL DEFAULT 0,
      progress_percent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      listing_id TEXT NOT NULL,
      listing_title TEXT NOT NULL,
      district TEXT NOT NULL DEFAULT '',
      check_in TEXT NOT NULL,
      check_out TEXT NOT NULL,
      nights INTEGER NOT NULL DEFAULT 1,
      nightly_price REAL NOT NULL DEFAULT 0,
      service_fee REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'Zaad Service',
      guest_name TEXT NOT NULL DEFAULT '',
      guest_phone TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'held',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS search_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      seeker_name TEXT NOT NULL,
      seeker_phone TEXT NOT NULL,
      purpose TEXT NOT NULL,
      property_type TEXT NOT NULL,
      district TEXT NOT NULL DEFAULT '',
      budget_min REAL NOT NULL DEFAULT 0,
      budget_max REAL NOT NULL DEFAULT 0,
      bedrooms INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      responses_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lease_contracts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      listing_id TEXT NOT NULL DEFAULT '',
      property_title TEXT NOT NULL,
      district TEXT NOT NULL DEFAULT '',
      landlord_name TEXT NOT NULL,
      landlord_phone TEXT NOT NULL,
      tenant_name TEXT NOT NULL,
      tenant_phone TEXT NOT NULL,
      tenant_id_number TEXT NOT NULL DEFAULT '',
      monthly_rent REAL NOT NULL DEFAULT 0,
      security_deposit REAL NOT NULL DEFAULT 0,
      start_date TEXT NOT NULL,
      duration_months INTEGER NOT NULL DEFAULT 12,
      terms_json TEXT NOT NULL DEFAULT '[]',
      landlord_signed INTEGER NOT NULL DEFAULT 0,
      tenant_signed INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_threads (
      id TEXT PRIMARY KEY,
      participant_user_id TEXT NOT NULL,
      listing_id TEXT NOT NULL DEFAULT '',
      listing_title TEXT NOT NULL DEFAULT '',
      listing_price REAL NOT NULL DEFAULT 0,
      listing_image TEXT NOT NULL DEFAULT '',
      contact_name TEXT NOT NULL DEFAULT 'GuriHel Support',
      contact_phone TEXT NOT NULL DEFAULT '',
      last_message TEXT NOT NULL DEFAULT '',
      last_time TEXT NOT NULL DEFAULT '',
      unread INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      sender_user_id TEXT NOT NULL,
      sender_type TEXT NOT NULL DEFAULT 'user',
      body TEXT NOT NULL,
      time_label TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS favorites (
      user_id TEXT NOT NULL,
      listing_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, listing_id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL,
      actor_username TEXT NOT NULL DEFAULT '',
      actor_phone TEXT NOT NULL DEFAULT '',
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT NOT NULL,
      details TEXT NOT NULL,
      ip_address TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Ensure new columns exist on pre-existing sessions / audit_logs tables
  const sessionCols = getColumnNames(db, 'sessions');
  if (!sessionCols.has('username')) {
    db.exec("ALTER TABLE sessions ADD COLUMN username TEXT NOT NULL DEFAULT '';");
  }
  if (!sessionCols.has('refresh_token_hash')) {
    db.exec("ALTER TABLE sessions ADD COLUMN refresh_token_hash TEXT NOT NULL DEFAULT '';");
  }
  if (!sessionCols.has('refresh_expires_at')) {
    db.exec("ALTER TABLE sessions ADD COLUMN refresh_expires_at TEXT NOT NULL DEFAULT '';");
  }
  if (!sessionCols.has('remember_me')) {
    db.exec('ALTER TABLE sessions ADD COLUMN remember_me INTEGER NOT NULL DEFAULT 0;');
  }

  const auditCols = getColumnNames(db, 'audit_logs');
  if (!auditCols.has('actor_username')) {
    db.exec("ALTER TABLE audit_logs ADD COLUMN actor_username TEXT NOT NULL DEFAULT '';");
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_refresh_hash ON sessions(refresh_token_hash);
    CREATE INDEX IF NOT EXISTS idx_reset_requests_status ON password_reset_requests(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status, created_at);
  `);

  // Seed only authentic system configuration if absent (never inserts fake business records)
  const existingSettings = db
    .prepare('SELECT key FROM system_settings WHERE key = ?')
    .get('global');
  if (!existingSettings) {
    db.prepare('INSERT INTO system_settings (key, value_json, updated_at) VALUES (?, ?, ?)').run(
      'global',
      JSON.stringify(DEFAULT_SYSTEM_SETTINGS),
      new Date().toISOString()
    );
  }
}

export function ensurePrimaryAdminProvisioned(db: DatabaseSync): void {
  const nowIso = new Date().toISOString();

  // Ensure only ddhamaan@gmail.com carries is_primary_admin = 1
  db.prepare(
    'UPDATE users SET is_primary_admin = 0 WHERE LOWER(email) != LOWER(?) AND is_primary_admin = 1'
  ).run(PRIMARY_ADMIN_EMAIL);

  const row = db
    .prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)')
    .get(PRIMARY_ADMIN_EMAIL) as { id?: string } | undefined;

  if (!row?.id) {
    const id = `adm_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    db.prepare(
      `INSERT INTO users (
        id, username, email, phone_e164, password_hash, role, is_primary_admin, email_verified,
        full_name, city, language, profile_completed, status, created_at, updated_at, last_login_at
      ) VALUES (?, 'ddhamaan', ?, '', '', 'super_admin', 1, 1, 'Primary Administrator', 'Hargeisa', 'EN', 1, 'active', ?, ?, NULL)`
    ).run(id, PRIMARY_ADMIN_EMAIL, nowIso, nowIso);
  } else {
    // Idempotently reconcile critical Primary Admin privileges without overwriting profile details
    db.prepare(
      `UPDATE users SET
        email = ?,
        role = 'super_admin',
        is_primary_admin = 1,
        email_verified = 1,
        status = 'active',
        profile_completed = 1,
        updated_at = ?
       WHERE id = ?`
    ).run(PRIMARY_ADMIN_EMAIL, nowIso, String(row.id));
  }
}

export function getSystemSettings(): SystemSettings {
  const db = getDb();
  const row = db
    .prepare('SELECT value_json FROM system_settings WHERE key = ?')
    .get('global') as { value_json?: string } | undefined;
  if (!row?.value_json) return DEFAULT_SYSTEM_SETTINGS;
  try {
    const parsed = JSON.parse(row.value_json) as Partial<SystemSettings>;
    return {
      watermark: sanitizeWatermarkSettings(parsed.watermark),
      platformName: String(parsed.platformName || DEFAULT_SYSTEM_SETTINGS.platformName),
      supportPhone: String(parsed.supportPhone || DEFAULT_SYSTEM_SETTINGS.supportPhone),
      defaultCity: String(parsed.defaultCity || DEFAULT_SYSTEM_SETTINGS.defaultCity),
      requireListingModeration:
        typeof parsed.requireListingModeration === 'boolean'
          ? parsed.requireListingModeration
          : true,
    };
  } catch {
    return DEFAULT_SYSTEM_SETTINGS;
  }
}

export function updateSystemSettings(patch: Partial<SystemSettings>): SystemSettings {
  const db = getDb();
  const current = getSystemSettings();
  const next: SystemSettings = {
    watermark: patch.watermark
      ? sanitizeWatermarkSettings({ ...current.watermark, ...patch.watermark })
      : current.watermark,
    platformName: patch.platformName
      ? String(patch.platformName).slice(0, 60)
      : current.platformName,
    supportPhone: patch.supportPhone
      ? String(patch.supportPhone).slice(0, 32)
      : current.supportPhone,
    defaultCity: patch.defaultCity ? String(patch.defaultCity).slice(0, 60) : current.defaultCity,
    requireListingModeration:
      typeof patch.requireListingModeration === 'boolean'
        ? patch.requireListingModeration
        : current.requireListingModeration,
  };
  db.prepare(
    'INSERT OR REPLACE INTO system_settings (key, value_json, updated_at) VALUES (?, ?, ?)'
  ).run('global', JSON.stringify(next), new Date().toISOString());
  return next;
}

export function rowToDbUser(row: Record<string, unknown>): DbUser {
  const email = String(row.email || '').trim().toLowerCase();
  const isPrimaryAdmin = Boolean(row.is_primary_admin) || email === PRIMARY_ADMIN_EMAIL;
  const rawRole = String(row.role || 'user');
  const authoritativeRole: AuthRole = isPrimaryAdmin
    ? 'super_admin'
    : rawRole === 'super_admin'
    ? 'super_admin'
    : rawRole === 'admin'
    ? 'admin'
    : 'user';
  const rawStatus = String(row.status || 'active');
  const status: AccountStatus =
    !isPrimaryAdmin && (rawStatus === 'blocked' || rawStatus === 'suspended') ? 'blocked' : 'active';

  return {
    id: String(row.id),
    username: String(row.username || ''),
    email: String(row.email || ''),
    phoneE164: String(row.phone_e164 || ''),
    role: authoritativeRole,
    isPrimaryAdmin,
    emailVerified: Boolean(row.email_verified) || isPrimaryAdmin,
    fullName: String(row.full_name || ''),
    city: String(row.city || 'Hargeisa'),
    language: (['SO', 'EN', 'AR'].includes(String(row.language))
      ? String(row.language)
      : 'SO') as 'SO' | 'EN' | 'AR',
    profileCompleted: Boolean(row.profile_completed ?? 1),
    status,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
  };
}

export function writeAuditLog(params: {
  actorUserId: string;
  actorUsername?: string;
  actorPhone?: string;
  actorRole: AuthRole;
  action: string;
  target: string;
  details: string;
  ipAddress?: string;
}): void {
  const db = getDb();
  const id = `log_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  const actorUsername = String(params.actorUsername || params.actorPhone || 'system').slice(0, 80);
  const actorPhone = String(params.actorPhone || '').slice(0, 40);
  db.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, actor_username, actor_phone, actor_role, action, target, details, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.actorUserId,
    actorUsername,
    actorPhone,
    params.actorRole,
    params.action.slice(0, 100),
    params.target.slice(0, 160),
    params.details.slice(0, 600),
    String(params.ipAddress || '').slice(0, 80),
    new Date().toISOString()
  );
}
