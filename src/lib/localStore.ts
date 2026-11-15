import {
  Listing,
  ChatThread,
  SearchRequest,
  LeaseContract,
  UserRole,
} from '../types';

export const APP_VERSION: string =
  (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null) || '4.0.3';
export const APP_BUILD: string =
  (typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : null) || '401';

const STORAGE_KEY = 'gurihel_app_state_v1';
const SCHEMA_VERSION = 1;

export interface PersistedAppState {
  schemaVersion: number;
  lastAppVersion: string;
  lastBuild: string;
  userRole: UserRole;
  favorites: string[];
  customListings: Listing[];
  chatThreads: ChatThread[] | null;
  searchRequests: SearchRequest[] | null;
  leaseContracts: LeaseContract[] | null;
  githubOwner: string;
  updatedAt: string;
}

const DEFAULT_STATE: PersistedAppState = {
  schemaVersion: SCHEMA_VERSION,
  lastAppVersion: APP_VERSION,
  lastBuild: APP_BUILD,
  userRole: 'seeker',
  favorites: ['A1042', 'wf-65k'],
  customListings: [],
  chatThreads: null,
  searchRequests: null,
  leaseContracts: null,
  githubOwner: '',
  updatedAt: new Date().toISOString(),
};

export function loadPersistedState(): {
  state: PersistedAppState;
  upgradedFromVersion: string | null;
} {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = { ...DEFAULT_STATE };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return { state: initial, upgradedFromVersion: null };
    }

    const parsed = JSON.parse(raw) as Partial<PersistedAppState>;
    const previousVersion = parsed.lastAppVersion || null;
    const upgraded =
      previousVersion && previousVersion !== APP_VERSION ? previousVersion : null;

    // Non-destructive additive migration preserving all user data across APK updates
    const migrated: PersistedAppState = {
      schemaVersion: SCHEMA_VERSION,
      lastAppVersion: APP_VERSION,
      lastBuild: APP_BUILD,
      userRole: parsed.userRole || 'seeker',
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : DEFAULT_STATE.favorites,
      customListings: Array.isArray(parsed.customListings) ? parsed.customListings : [],
      chatThreads: Array.isArray(parsed.chatThreads) ? parsed.chatThreads : null,
      searchRequests: Array.isArray(parsed.searchRequests) ? parsed.searchRequests : null,
      leaseContracts: Array.isArray(parsed.leaseContracts) ? parsed.leaseContracts : null,
      githubOwner: typeof parsed.githubOwner === 'string' ? parsed.githubOwner : '',
      updatedAt: new Date().toISOString(),
    };

    if (upgraded || parsed.schemaVersion !== SCHEMA_VERSION) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    }

    return { state: migrated, upgradedFromVersion: upgraded };
  } catch {
    return { state: { ...DEFAULT_STATE }, upgradedFromVersion: null };
  }
}

export function savePersistedPatch(patch: Partial<PersistedAppState>): void {
  try {
    const { state } = loadPersistedState();
    const next: PersistedAppState = {
      ...state,
      ...patch,
      schemaVersion: SCHEMA_VERSION,
      lastAppVersion: APP_VERSION,
      lastBuild: APP_BUILD,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors gracefully
  }
}
