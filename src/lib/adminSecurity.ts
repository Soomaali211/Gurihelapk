import { AdminSessionState } from '../types';

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '';

const DEVICE_FP_STORAGE_KEY = 'gurihel_admin_device_fp';

export function getOrCreateDeviceFingerprint(): { fingerprint: string; label: string } {
  let fp = '';
  try {
    fp = localStorage.getItem(DEVICE_FP_STORAGE_KEY) || '';
    if (!fp) {
      const rand =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
          : Math.random().toString(36).slice(2, 14);
      fp = `web-${rand}`;
      localStorage.setItem(DEVICE_FP_STORAGE_KEY, fp);
    }
  } catch {
    fp = 'web-ephemeral-device';
  }

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  let browser = 'Browser';
  if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari')) browser = 'Safari';

  let os = 'Desktop';
  if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Linux')) os = 'Linux';

  return {
    fingerprint: fp,
    label: `${browser} on ${os}`,
  };
}

export async function request2FASetup(idToken: string): Promise<{
  qrDataUrl: string;
  manualKey: string;
  encryptedSecret: string;
}> {
  const res = await fetch(`${API_BASE}/api/admin/2fa/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '2FA setup waa fashilmay.');
  return data;
}

export async function confirm2FASetup(params: {
  idToken: string;
  encryptedSecret: string;
  code: string;
  deviceFp: string;
  sessionEpoch: number;
}): Promise<{
  encryptedSecret: string;
  recoveryCodes: string[];
  recoveryCodeHashes: string[];
  session: AdminSessionState;
}> {
  const res = await fetch(`${API_BASE}/api/admin/2fa/confirm-setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Xaqiijinta 2FA way fashilantay.');
  return {
    encryptedSecret: data.encryptedSecret,
    recoveryCodes: data.recoveryCodes,
    recoveryCodeHashes: data.recoveryCodeHashes,
    session: {
      token: data.adminSessionToken,
      expiresAt: data.expiresAt,
      stepUpUntil: data.stepUpUntil,
      sessionEpoch: data.sessionEpoch,
    },
  };
}

export async function verifyDaily2FA(params: {
  idToken: string;
  encryptedSecret: string;
  code: string;
  recoveryCodeHashes?: string[];
  deviceFp: string;
  sessionEpoch: number;
}): Promise<{
  session: AdminSessionState;
  usedRecoveryIndex: number;
}> {
  const res = await fetch(`${API_BASE}/api/admin/2fa/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Xogtu waa khalad.');
  return {
    session: {
      token: data.adminSessionToken,
      expiresAt: data.expiresAt,
      stepUpUntil: data.stepUpUntil,
      sessionEpoch: params.sessionEpoch,
    },
    usedRecoveryIndex: typeof data.usedRecoveryIndex === 'number' ? data.usedRecoveryIndex : -1,
  };
}

export async function refreshAdminSessionToken(params: {
  idToken: string;
  adminSessionToken: string;
  sessionEpoch: number;
}): Promise<AdminSessionState> {
  const res = await fetch(`${API_BASE}/api/admin/session/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Session-ku wuu dhacay.');
  return {
    token: data.adminSessionToken,
    expiresAt: data.expiresAt,
    stepUpUntil: data.stepUpUntil,
    sessionEpoch: params.sessionEpoch,
  };
}

export async function verifyStepUp2FA(params: {
  idToken: string;
  adminSessionToken: string;
  encryptedSecret: string;
  code: string;
  sessionEpoch: number;
}): Promise<AdminSessionState> {
  const res = await fetch(`${API_BASE}/api/admin/step-up`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Koodhka Step-Up 2FA waa khalad.');
  return {
    token: data.adminSessionToken,
    expiresAt: data.expiresAt,
    stepUpUntil: data.stepUpUntil,
    sessionEpoch: params.sessionEpoch,
  };
}
