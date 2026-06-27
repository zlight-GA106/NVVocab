export const NV_SUPABASE_URL_STORAGE_KEY = 'NV_SUPABASE_URL';
export const NV_SUPABASE_ANON_KEY_STORAGE_KEY = 'NV_SUPABASE_ANON_KEY';
export const NV_THEME_SEED_COLOR_STORAGE_KEY = 'NV_THEME_SEED_COLOR';
export const DEFAULT_THEME_SEED_COLOR = '#005faf';

export type SupabaseRuntimeCredentials = {
  key: string;
  url: string;
};

export type CascadingRuntimeConfig = {
  shouldShowOOBE: boolean;
  supabaseAnonKey: string;
  supabaseUrl: string;
  themeSeedColor: string;
};

type KnownViteEnv = ImportMetaEnv & {
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_THEME_SEED_COLOR?: string;
};

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
  const quotePairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ['`', '`'],
  ];

  for (const [start, end] of quotePairs) {
    if (trimmed.startsWith(start) && trimmed.endsWith(end)) {
      return trimmed.slice(start.length, trimmed.length - end.length).trim();
    }
  }

  return trimmed;
}

export function normalizeConfigValue(value: string): string {
  return stripWrappingQuotes(value);
}

function readStorageValue(key: string): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return normalizeConfigValue(window.localStorage.getItem(key) ?? '');
}

function readEnvValue(key: keyof KnownViteEnv): string {
  const value = (import.meta.env as KnownViteEnv)[key];
  return typeof value === 'string' ? normalizeConfigValue(value) : '';
}

function normalizeSeedColor(value: string): string {
  const normalized = normalizeConfigValue(value);

  if (/^#[0-9a-fA-F]{6}$/u.test(normalized)) {
    return normalized.toLowerCase();
  }

  return '';
}

export function resolveRuntimeConfig(): CascadingRuntimeConfig {
  const supabaseUrl =
    readStorageValue(NV_SUPABASE_URL_STORAGE_KEY) || readEnvValue('VITE_SUPABASE_URL');
  const supabaseAnonKey =
    readStorageValue(NV_SUPABASE_ANON_KEY_STORAGE_KEY) || readEnvValue('VITE_SUPABASE_ANON_KEY');
  const themeSeedColor =
    normalizeSeedColor(readStorageValue(NV_THEME_SEED_COLOR_STORAGE_KEY)) ||
    normalizeSeedColor(readEnvValue('VITE_THEME_SEED_COLOR')) ||
    DEFAULT_THEME_SEED_COLOR;

  return {
    shouldShowOOBE: supabaseUrl === '' || supabaseAnonKey === '',
    supabaseAnonKey,
    supabaseUrl,
    themeSeedColor,
  };
}

export function persistRuntimeSupabaseCredentials(credentials: SupabaseRuntimeCredentials): SupabaseRuntimeCredentials {
  const normalizedCredentials = {
    key: normalizeConfigValue(credentials.key).replace(/\s+/g, ''),
    url: normalizeConfigValue(credentials.url),
  };

  window.localStorage.setItem(NV_SUPABASE_URL_STORAGE_KEY, normalizedCredentials.url);
  window.localStorage.setItem(NV_SUPABASE_ANON_KEY_STORAGE_KEY, normalizedCredentials.key);

  return normalizedCredentials;
}

export function persistThemeSeedColor(seedColor: string): void {
  const normalizedSeedColor = normalizeSeedColor(seedColor);

  if (normalizedSeedColor) {
    window.localStorage.setItem(NV_THEME_SEED_COLOR_STORAGE_KEY, normalizedSeedColor);
  }
}
