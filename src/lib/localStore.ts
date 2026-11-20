export const APP_VERSION: string =
  (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null) || '4.0.3';
export const APP_BUILD: string =
  (typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : null) || '401';

const STORAGE_KEY = 'gurihel_preferences_v2';

export interface AppPreferences {
  lastAppVersion: string;
  lastBuild: string;
  githubOwner: string;
  language: 'SO' | 'EN' | 'AR';
}

const DEFAULT_PREFS: AppPreferences = {
  lastAppVersion: APP_VERSION,
  lastBuild: APP_BUILD,
  githubOwner: '',
  language: 'SO',
};

export function loadPersistedState(): {
  state: AppPreferences;
  upgradedFromVersion: string | null;
} {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PREFS));
      return { state: { ...DEFAULT_PREFS }, upgradedFromVersion: null };
    }
    const parsed = JSON.parse(raw) as Partial<AppPreferences>;
    const previousVersion = parsed.lastAppVersion || null;
    const upgraded =
      previousVersion && previousVersion !== APP_VERSION ? previousVersion : null;

    const next: AppPreferences = {
      lastAppVersion: APP_VERSION,
      lastBuild: APP_BUILD,
      githubOwner: typeof parsed.githubOwner === 'string' ? parsed.githubOwner : '',
      language:
        parsed.language === 'EN' || parsed.language === 'AR' || parsed.language === 'SO'
          ? parsed.language
          : 'SO',
    };
    if (upgraded) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    return { state: next, upgradedFromVersion: upgraded };
  } catch {
    return { state: { ...DEFAULT_PREFS }, upgradedFromVersion: null };
  }
}

export function savePersistedPatch(patch: Partial<AppPreferences>): void {
  try {
    const { state } = loadPersistedState();
    const next: AppPreferences = {
      ...state,
      ...patch,
      lastAppVersion: APP_VERSION,
      lastBuild: APP_BUILD,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors cleanly
  }
}
