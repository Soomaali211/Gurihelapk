import { Capacitor } from '@capacitor/core';
import {
  AccountStatus,
  AdminOverview,
  AdminReports,
  AdminSessionRecord,
  AuditLogEntry,
  AuthUser,
  BookingReservation,
  ChatMessage,
  ChatThread,
  LeaseContract,
  Listing,
  MediaAssetItem,
  PasswordResetRequestItem,
  Project,
  SearchRequest,
  SystemSettings,
  UserRole,
} from '../types';

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const NATIVE_REFRESH_KEY = 'gurihel_native_rt_v1';

// In-memory access token (never written to browser localStorage/sessionStorage)
let memoryAccessToken: string | null = null;
let memoryNativeRefreshToken: string | null = null;
let inflightRefresh: Promise<AuthUser | null> | null = null;

export function resolveApiUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return '';
  if (/^(https?:\/\/|data:|blob:)/i.test(pathOrUrl)) return pathOrUrl;
  if (pathOrUrl.startsWith('/api/')) return `${API_BASE}${pathOrUrl}`;
  return pathOrUrl;
}

export function getAccessToken(): string | null {
  return memoryAccessToken;
}

export function setSessionTokens(accessToken: string | null, refreshToken?: string | null): void {
  memoryAccessToken = accessToken;
  if (refreshToken !== undefined) {
    memoryNativeRefreshToken = refreshToken;
    if (Capacitor.isNativePlatform()) {
      try {
        if (refreshToken) {
          window.localStorage.setItem(NATIVE_REFRESH_KEY, refreshToken);
        } else {
          window.localStorage.removeItem(NATIVE_REFRESH_KEY);
        }
      } catch {
        // Ignore native storage issues
      }
    }
  }
}

export function clearSessionTokens(): void {
  memoryAccessToken = null;
  memoryNativeRefreshToken = null;
  if (Capacitor.isNativePlatform()) {
    try {
      window.localStorage.removeItem(NATIVE_REFRESH_KEY);
    } catch {
      // Ignore
    }
  }
}

function getNativeRefreshToken(): string | null {
  if (memoryNativeRefreshToken) return memoryNativeRefreshToken;
  if (!Capacitor.isNativePlatform()) return null;
  try {
    return window.localStorage.getItem(NATIVE_REFRESH_KEY);
  } catch {
    return null;
  }
}

export async function refreshAuthSession(): Promise<AuthUser | null> {
  if (inflightRefresh) {
    return inflightRefresh;
  }

  inflightRefresh = (async (): Promise<AuthUser | null> => {
    try {
      const nativeRt = getNativeRefreshToken();
      const resp = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'GuriHel-App',
        },
        body: JSON.stringify(nativeRt ? { refreshToken: nativeRt } : {}),
      });
      if (!resp.ok) {
        clearSessionTokens();
        return null;
      }
      const data = (await resp.json().catch(() => ({}))) as {
        token?: string;
        refreshToken?: string;
        user?: AuthUser;
      };
      if (!data.token || !data.user) {
        clearSessionTokens();
        return null;
      }
      setSessionTokens(data.token, data.refreshToken);
      return data.user;
    } catch {
      return null;
    } finally {
      inflightRefresh = null;
    }
  })();

  return inflightRefresh;
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  requireToken = true,
  allowRefreshRetry = true
): Promise<T> {
  if (requireToken && !memoryAccessToken) {
    await refreshAuthSession();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'GuriHel-App',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (memoryAccessToken) {
    headers.Authorization = `Bearer ${memoryAccessToken}`;
  } else if (requireToken) {
    const err = new Error('Authentication required. Please sign in.') as Error & { status?: number };
    err.status = 401;
    throw err;
  }

  const resp = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (resp.status === 401 && requireToken && allowRefreshRetry) {
    const refreshed = await refreshAuthSession();
    if (refreshed && memoryAccessToken) {
      return apiRequest<T>(path, options, requireToken, false);
    }
  }

  const payload = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(
      typeof payload?.error === 'string' ? payload.error : `Request failed (${resp.status})`
    ) as Error & { status?: number; code?: string; retryAfterSeconds?: number };
    err.status = resp.status;
    err.code = payload?.code;
    err.retryAfterSeconds = payload?.retryAfterSeconds;
    throw err;
  }

  return payload as T;
}

// ============================================================================
// EMAIL-FIRST PASSWORDLESS OTP AUTHENTICATION API
// ============================================================================

export async function requestEmailOtp(email: string): Promise<{
  success: boolean;
  expiresInSeconds: number;
  resendCooldownSeconds: number;
  message: string;
}> {
  return apiRequest(
    '/api/v1/auth/otp/request',
    {
      method: 'POST',
      body: JSON.stringify({ email }),
    },
    false
  );
}

export async function verifyEmailOtp(params: {
  email: string;
  code: string;
  deviceLabel?: string;
}): Promise<{
  success: boolean;
  token: string;
  refreshToken: string;
  expiresAt: string;
  isNewUser: boolean;
  requiresProfileCompletion: boolean;
  user: AuthUser;
}> {
  const res = await apiRequest<{
    success: boolean;
    token: string;
    refreshToken: string;
    expiresAt: string;
    isNewUser: boolean;
    requiresProfileCompletion: boolean;
    user: AuthUser;
  }>(
    '/api/v1/auth/otp/verify',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    false
  );
  if (res.token) {
    setSessionTokens(res.token, res.refreshToken);
  }
  return res;
}

export async function restoreSessionOnBoot(): Promise<{
  user: AuthUser;
  sessionId: string;
  expiresAt: string;
} | null> {
  if (!memoryAccessToken) {
    const refreshedUser = await refreshAuthSession();
    if (!refreshedUser || !memoryAccessToken) {
      return null;
    }
  }
  try {
    return await fetchCurrentSession();
  } catch {
    clearSessionTokens();
    return null;
  }
}

export async function fetchCurrentSession(): Promise<{
  user: AuthUser;
  sessionId: string;
  expiresAt: string;
}> {
  return apiRequest('/api/v1/auth/me', { method: 'GET' }, true);
}

export async function updateMyProfile(patch: {
  fullName?: string;
  city?: string;
  phoneE164?: string;
  language?: 'SO' | 'EN' | 'AR';
}): Promise<{
  success: boolean;
  user: AuthUser;
}> {
  return apiRequest(
    '/api/v1/auth/profile',
    {
      method: 'POST',
      body: JSON.stringify(patch),
    },
    true
  );
}

export async function logoutSession(): Promise<void> {
  try {
    const nativeRt = getNativeRefreshToken();
    await fetch(`${API_BASE}/api/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'GuriHel-App',
        ...(memoryAccessToken ? { Authorization: `Bearer ${memoryAccessToken}` } : {}),
      },
      body: JSON.stringify(nativeRt ? { refreshToken: nativeRt } : {}),
    });
  } catch {
    // Clear local memory even if network fails
  } finally {
    clearSessionTokens();
  }
}

export async function logoutAllSessions(): Promise<void> {
  try {
    if (memoryAccessToken) {
      await apiRequest('/api/v1/auth/logout-all', { method: 'POST' }, true);
    }
  } finally {
    clearSessionTokens();
  }
}

// ============================================================================
// MARKETPLACE & USER API
// ============================================================================

export async function fetchListings(): Promise<Listing[]> {
  const res = await apiRequest<{ data: Listing[]; total: number }>(
    '/api/v1/listings',
    { method: 'GET' },
    false
  );
  return res.data || [];
}

export async function createListingApi(payload: Partial<Listing>): Promise<Listing> {
  return apiRequest('/api/v1/listings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadPropertyMedia(dataUrl: string): Promise<{
  id: string;
  url: string;
  width: number;
  height: number;
  watermarked: boolean;
}> {
  return apiRequest('/api/v1/media/upload', {
    method: 'POST',
    body: JSON.stringify({ dataUrl }),
  });
}

export async function fetchProjectsApi(): Promise<Project[]> {
  return apiRequest('/api/v1/projects', { method: 'GET' }, false);
}

export async function registerProjectInterestApi(projectId: string): Promise<void> {
  await apiRequest(`/api/v1/projects/${encodeURIComponent(projectId)}/interest`, {
    method: 'POST',
  });
}

export async function fetchFavoritesApi(): Promise<string[]> {
  return apiRequest('/api/v1/favorites', { method: 'GET' }, true);
}

export async function toggleFavoriteApi(listingId: string, favorite: boolean): Promise<void> {
  await apiRequest(`/api/v1/favorites/${encodeURIComponent(listingId)}`, {
    method: favorite ? 'POST' : 'DELETE',
  });
}

export async function fetchBookingsApi(): Promise<BookingReservation[]> {
  return apiRequest('/api/v1/bookings', { method: 'GET' }, true);
}

export async function createBookingApi(payload: {
  listingId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  paymentMethod: string;
}): Promise<BookingReservation> {
  return apiRequest('/api/v1/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchSearchRequestsApi(): Promise<SearchRequest[]> {
  return apiRequest('/api/v1/search-requests', { method: 'GET' }, true);
}

export async function createSearchRequestApi(payload: Partial<SearchRequest>): Promise<SearchRequest> {
  return apiRequest('/api/v1/search-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchLeaseContractsApi(): Promise<LeaseContract[]> {
  return apiRequest('/api/v1/lease-contracts', { method: 'GET' }, true);
}

export async function createLeaseContractApi(payload: Partial<LeaseContract>): Promise<LeaseContract> {
  return apiRequest('/api/v1/lease-contracts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchChatThreadsApi(): Promise<ChatThread[]> {
  return apiRequest('/api/v1/chat/threads', { method: 'GET' }, true);
}

export async function createChatThreadApi(payload: {
  listingId?: string;
  listingTitle?: string;
  listingPrice?: number;
  listingImage?: string;
  contactName?: string;
  contactPhone?: string;
  initialMessage?: string;
}): Promise<ChatThread> {
  return apiRequest('/api/v1/chat/threads', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function sendChatMessageApi(threadId: string, body: string): Promise<ChatMessage> {
  return apiRequest(`/api/v1/chat/threads/${encodeURIComponent(threadId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

// ============================================================================
// ADMIN API
// ============================================================================

export async function fetchAdminOverview(): Promise<AdminOverview> {
  return apiRequest('/api/v1/admin/overview', { method: 'GET' }, true);
}

export async function fetchAdminListings(status = 'all', q = ''): Promise<Listing[]> {
  const qs = new URLSearchParams({ status, q }).toString();
  return apiRequest(`/api/v1/admin/listings?${qs}`, { method: 'GET' }, true);
}

export async function createAdminListing(payload: Partial<Listing>): Promise<Listing> {
  return apiRequest('/api/v1/admin/listings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAdminListing(id: string, patch: Partial<Listing>): Promise<Listing> {
  return apiRequest(`/api/v1/admin/listings/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteAdminListing(id: string): Promise<void> {
  await apiRequest(`/api/v1/admin/listings/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function fetchAdminProjects(): Promise<Project[]> {
  return apiRequest('/api/v1/admin/projects', { method: 'GET' }, true);
}

export async function createAdminProject(payload: Partial<Project>): Promise<Project> {
  return apiRequest('/api/v1/admin/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminProject(id: string): Promise<void> {
  await apiRequest(`/api/v1/admin/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function fetchAdminUsers(params?: {
  q?: string;
  role?: 'all' | UserRole;
  status?: 'all' | AccountStatus;
}): Promise<AuthUser[]> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.role && params.role !== 'all') qs.set('role', params.role);
  if (params?.status && params.status !== 'all') qs.set('status', params.status);
  const query = qs.toString();
  return apiRequest(`/api/v1/admin/users${query ? `?${query}` : ''}`, { method: 'GET' }, true);
}

export async function updateAdminUser(
  id: string,
  patch: { status?: AccountStatus; role?: UserRole; fullName?: string; city?: string }
): Promise<AuthUser> {
  return apiRequest(`/api/v1/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteAdminUser(id: string): Promise<void> {
  await apiRequest(`/api/v1/admin/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function fetchAdminPasswordResets(): Promise<PasswordResetRequestItem[]> {
  return apiRequest('/api/v1/admin/password-resets', { method: 'GET' }, true);
}

export async function issueAdminPasswordReset(id: string): Promise<{
  success: boolean;
  id: string;
  username: string;
  resetCode: string;
  expiresAt: string;
}> {
  return apiRequest(`/api/v1/admin/password-resets/${encodeURIComponent(id)}/issue`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function rejectAdminPasswordReset(id: string): Promise<void> {
  await apiRequest(`/api/v1/admin/password-resets/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function fetchAdminBookings(): Promise<Array<Record<string, unknown>>> {
  return apiRequest('/api/v1/admin/bookings', { method: 'GET' }, true);
}

export async function updateAdminBookingStatus(
  id: string,
  status: 'held' | 'confirmed' | 'cancelled'
): Promise<void> {
  await apiRequest(`/api/v1/admin/bookings/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function fetchAdminRequests(): Promise<Array<Record<string, unknown>>> {
  return apiRequest('/api/v1/admin/requests', { method: 'GET' }, true);
}

export async function updateAdminRequestStatus(
  id: string,
  status: 'open' | 'matched' | 'closed'
): Promise<void> {
  await apiRequest(`/api/v1/admin/requests/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function fetchAdminLeases(): Promise<Array<Record<string, unknown>>> {
  return apiRequest('/api/v1/admin/leases', { method: 'GET' }, true);
}

export async function fetchAdminMedia(): Promise<MediaAssetItem[]> {
  return apiRequest('/api/v1/admin/media', { method: 'GET' }, true);
}

export async function rewatermarkAdminMedia(id: string): Promise<void> {
  await apiRequest(`/api/v1/admin/media/${encodeURIComponent(id)}/rewatermark`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function deleteAdminMedia(id: string): Promise<void> {
  await apiRequest(`/api/v1/admin/media/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function updateAdminSettings(payload: {
  platformName?: string;
  supportPhone?: string;
  defaultCity?: string;
  requireListingModeration?: boolean;
  watermark?: Partial<SystemSettings['watermark']>;
  reapplyExistingMedia?: boolean;
}): Promise<{ success: boolean; settings: SystemSettings; reprocessedCount: number }> {
  return apiRequest('/api/v1/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminReports(): Promise<AdminReports> {
  return apiRequest('/api/v1/admin/reports', { method: 'GET' }, true);
}

export async function fetchAdminSessions(): Promise<AdminSessionRecord[]> {
  return apiRequest('/api/v1/admin/sessions', { method: 'GET' }, true);
}

export async function revokeAdminSession(id: string): Promise<void> {
  await apiRequest(`/api/v1/admin/sessions/${encodeURIComponent(id)}/revoke`, {
    method: 'POST',
  });
}

export async function fetchAdminAuditLogs(): Promise<AuditLogEntry[]> {
  return apiRequest('/api/v1/admin/audit-logs', { method: 'GET' }, true);
}

export async function downloadAdminExport(
  resource: 'listings' | 'users' | 'bookings' | 'requests' | 'leases' | 'projects' | 'audit_logs',
  format: 'csv' | 'json' = 'csv'
): Promise<void> {
  if (!memoryAccessToken) {
    await refreshAuthSession();
  }
  if (!memoryAccessToken) throw new Error('Authentication required');
  const resp = await fetch(`${API_BASE}/api/v1/admin/export/${resource}?format=${format}`, {
    credentials: 'include',
    headers: { Authorization: `Bearer ${memoryAccessToken}` },
  });
  if (!resp.ok) {
    throw new Error(`Export failed (${resp.status})`);
  }
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gurihel-${resource}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
