import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  NV_SUPABASE_ANON_KEY_STORAGE_KEY,
  NV_SUPABASE_URL_STORAGE_KEY,
  normalizeConfigValue,
  persistRuntimeSupabaseCredentials,
  resolveRuntimeConfig,
} from '../utils/config';

export const SUPABASE_URL_STORAGE_KEY = NV_SUPABASE_URL_STORAGE_KEY;
export const SUPABASE_KEY_STORAGE_KEY = NV_SUPABASE_ANON_KEY_STORAGE_KEY;

type WordbaseRow = {
  id: string;
  user_id: string;
  words: string;
  phonetic: string | null;
  translate: string;
  book_tag: string | null;
  introtime: string | null;
  repetitions: number | null;
  interval: number | null;
  easiness: number | null;
  next_review_at: string | null;
  wrong_count: number | null;
};

type WordbaseInsert = {
  id?: string;
  user_id?: string;
  words: string;
  phonetic?: string | null;
  translate: string;
  book_tag?: string | null;
  introtime?: string | null;
  repetitions?: number;
  interval?: number;
  easiness?: number;
  next_review_at?: string;
  wrong_count?: number;
};

type WordbaseUpdate = Partial<WordbaseInsert>;

type ReviewLogRow = {
  id: string;
  user_id: string;
  word_id: string | null;
  reviewed_at: string | null;
  quality: number;
};

type ReviewLogInsert = {
  id?: string;
  user_id?: string;
  word_id?: string | null;
  reviewed_at?: string | null;
  quality: number;
};

type ReviewLogUpdate = Partial<ReviewLogInsert>;

type StudyTargetStatus = 'active' | 'paused';

type StudyTargetRow = {
  id: string;
  user_id: string;
  title: string;
  start_at: string;
  end_at: string;
  status: StudyTargetStatus | null;
  time_invested_seconds: number | null;
  daily_word_target: number | null;
  created_at: string | null;
};

type StudyTargetInsert = {
  id?: string;
  title: string;
  start_at: string;
  end_at: string;
  status?: StudyTargetStatus;
  time_invested_seconds?: number;
  daily_word_target?: number;
  created_at?: string;
};

type StudyTargetUpdate = Partial<StudyTargetInsert>;

export type Database = {
  public: {
    Tables: {
      wordbase: {
        Row: WordbaseRow;
        Insert: WordbaseInsert;
        Update: WordbaseUpdate;
        Relationships: [];
      };
      review_logs: {
        Row: ReviewLogRow;
        Insert: ReviewLogInsert;
        Update: ReviewLogUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
  study: {
    Tables: {
      target: {
        Row: StudyTargetRow;
        Insert: StudyTargetInsert;
        Update: StudyTargetUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

export type WordJiffySupabaseClient = SupabaseClient<Database>;

export type SupabaseCredentials = {
  url: string;
  key: string;
};

type CreateSupabaseClientOptions = {
  persistSession?: boolean;
  storageKey?: string;
};

let cachedClient: WordJiffySupabaseClient | null = null;
let cachedCredentialsKey: string | null = null;

function hasHeaderSafeCharacters(value: string): boolean {
  return /^[\x21-\x7E]+$/u.test(value);
}

function hasSupabaseKeyCharacters(value: string): boolean {
  return /^[A-Za-z0-9._-]+$/u.test(value);
}

function getStorageFingerprint(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

function getAuthStorageKey(credentials: SupabaseCredentials): string {
  return `word-jiffy-auth-${getStorageFingerprint(credentials.url)}`;
}

export function normalizeSupabaseCredentials(credentials: SupabaseCredentials): SupabaseCredentials {
  return {
    key: normalizeConfigValue(credentials.key).replace(/\s+/g, ''),
    url: normalizeConfigValue(credentials.url),
  };
}

export function validateSupabaseCredentials(credentials: SupabaseCredentials): void {
  if (!credentials.url || !credentials.key) {
    throw new Error('Supabase URL and Publishable key are required.');
  }

  if (!hasHeaderSafeCharacters(credentials.url)) {
    throw new Error('Supabase URL contains unsupported characters.');
  }

  if (!hasHeaderSafeCharacters(credentials.key) || !hasSupabaseKeyCharacters(credentials.key)) {
    throw new Error('Supabase Publishable key contains unsupported characters.');
  }

  try {
    const parsedUrl = new URL(credentials.url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Supabase URL must use http or https.');
    }
  } catch {
    throw new Error('Supabase URL is invalid.');
  }
}

export function createSupabaseClientFromCredentials(
  credentials: SupabaseCredentials,
  options: CreateSupabaseClientOptions = {},
): WordJiffySupabaseClient {
  const normalizedCredentials = normalizeSupabaseCredentials(credentials);
  validateSupabaseCredentials(normalizedCredentials);
  const persistSession = options.persistSession ?? true;

  return createClient<Database>(normalizedCredentials.url, normalizedCredentials.key, {
    auth: {
      autoRefreshToken: persistSession,
      detectSessionInUrl: false,
      persistSession,
      storageKey: options.storageKey ?? getAuthStorageKey(normalizedCredentials),
    },
    global: {
      headers: {
        'x-client-info': 'word-jiffy-web',
      },
    },
  });
}

export function readSupabaseCredentials(): SupabaseCredentials | null {
  const config = resolveRuntimeConfig();

  if (config.shouldShowOOBE) {
    return null;
  }

  try {
    const credentials = normalizeSupabaseCredentials({
      key: config.supabaseAnonKey,
      url: config.supabaseUrl,
    });
    validateSupabaseCredentials(credentials);
    return credentials;
  } catch {
    return null;
  }
}

export function persistSupabaseCredentials(credentials: SupabaseCredentials): void {
  const normalizedCredentials = normalizeSupabaseCredentials(credentials);
  validateSupabaseCredentials(normalizedCredentials);
  persistRuntimeSupabaseCredentials(normalizedCredentials);
  cachedClient = null;
  cachedCredentialsKey = null;
}

export function getSupabaseClient(): WordJiffySupabaseClient | null {
  const credentials = readSupabaseCredentials();

  if (!credentials) {
    return null;
  }

  try {
    const credentialsKey = `${credentials.url}\n${credentials.key}`;
    if (cachedClient && cachedCredentialsKey === credentialsKey) {
      return cachedClient;
    }

    cachedClient = createSupabaseClientFromCredentials(credentials);
    cachedCredentialsKey = credentialsKey;
    return cachedClient;
  } catch {
    return null;
  }
}
