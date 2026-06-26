import { getSupabaseClient, type Database } from './supabase';

export const OFFLINE_REVIEW_QUEUE_STORAGE_KEY = 'WORD_JIFFY_OFFLINE_QUEUE';
export const OFFLINE_REVIEW_QUEUE_EVENT = 'word-jiffy-offline-queue';

type WordbaseUpdate = Database['public']['Tables']['wordbase']['Update'];
type ReviewLogInsert = Database['public']['Tables']['review_logs']['Insert'];

export type OfflineWordUpdate = Pick<
  WordbaseUpdate,
  'easiness' | 'interval' | 'next_review_at' | 'repetitions' | 'wrong_count'
>;

export interface OfflineReviewQueueItem {
  created_at: string;
  id: string;
  review_log: ReviewLogInsert;
  user_id: string;
  word_id: string;
  word_update: OfflineWordUpdate;
}

export interface OfflineReviewSyncResult {
  errorMessage: string;
  remaining: number;
  synced: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOfflineWordUpdate(value: unknown): value is OfflineWordUpdate {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.easiness === 'number' &&
    typeof value.interval === 'number' &&
    typeof value.next_review_at === 'string' &&
    typeof value.repetitions === 'number' &&
    typeof value.wrong_count === 'number'
  );
}

function isReviewLogInsert(value: unknown): value is ReviewLogInsert {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.quality === 'number' &&
    typeof value.reviewed_at === 'string' &&
    typeof value.user_id === 'string' &&
    typeof value.word_id === 'string'
  );
}

function isOfflineReviewQueueItem(value: unknown): value is OfflineReviewQueueItem {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.created_at === 'string' &&
    typeof value.id === 'string' &&
    typeof value.user_id === 'string' &&
    typeof value.word_id === 'string' &&
    isOfflineWordUpdate(value.word_update) &&
    isReviewLogInsert(value.review_log)
  );
}

function notifyOfflineQueueChanged(): void {
  window.dispatchEvent(new Event(OFFLINE_REVIEW_QUEUE_EVENT));
}

export function createOfflineReviewQueueItem(input: {
  reviewLog: ReviewLogInsert;
  userId: string;
  wordId: string;
  wordUpdate: OfflineWordUpdate;
}): OfflineReviewQueueItem {
  return {
    created_at: new Date().toISOString(),
    id: `${input.wordId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    review_log: input.reviewLog,
    user_id: input.userId,
    word_id: input.wordId,
    word_update: input.wordUpdate,
  };
}

export function readOfflineReviewQueue(): OfflineReviewQueueItem[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const rawQueue = window.localStorage.getItem(OFFLINE_REVIEW_QUEUE_STORAGE_KEY);
  if (!rawQueue) {
    return [];
  }

  try {
    const parsedQueue: unknown = JSON.parse(rawQueue);
    if (!Array.isArray(parsedQueue)) {
      return [];
    }

    return parsedQueue.filter(isOfflineReviewQueueItem);
  } catch {
    return [];
  }
}

export function writeOfflineReviewQueue(queue: OfflineReviewQueueItem[]): void {
  window.localStorage.setItem(OFFLINE_REVIEW_QUEUE_STORAGE_KEY, JSON.stringify(queue));
  notifyOfflineQueueChanged();
}

export function appendOfflineReviewQueueItem(item: OfflineReviewQueueItem): number {
  const nextQueue = [...readOfflineReviewQueue(), item];
  writeOfflineReviewQueue(nextQueue);
  return nextQueue.length;
}

export function getOfflineReviewQueueCount(): number {
  return readOfflineReviewQueue().length;
}

export async function syncOfflineReviewQueue(): Promise<OfflineReviewSyncResult> {
  if (typeof window !== 'undefined' && !window.navigator.onLine) {
    return {
      errorMessage: '',
      remaining: getOfflineReviewQueueCount(),
      synced: 0,
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      errorMessage: '尚未配置数据库连接。',
      remaining: getOfflineReviewQueueCount(),
      synced: 0,
    };
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.user) {
    return {
      errorMessage: '尚未登录，无法同步离线复习队列。',
      remaining: getOfflineReviewQueueCount(),
      synced: 0,
    };
  }

  const queue = readOfflineReviewQueue();
  const remainingQueue: OfflineReviewQueueItem[] = [];
  let synced = 0;
  let errorMessage = '';

  for (const item of queue) {
    if (item.user_id !== session.user.id) {
      remainingQueue.push(item);
      continue;
    }

    const [wordUpdateResult, reviewLogResult] = await Promise.all([
      supabase
        .from('wordbase')
        .update(item.word_update)
        .eq('id', item.word_id)
        .eq('user_id', item.user_id),
      supabase.from('review_logs').insert(item.review_log),
    ]);

    if (wordUpdateResult.error || reviewLogResult.error) {
      remainingQueue.push(item);
      errorMessage = wordUpdateResult.error?.message ?? reviewLogResult.error?.message ?? errorMessage;
      continue;
    }

    synced += 1;
  }

  writeOfflineReviewQueue(remainingQueue);

  return {
    errorMessage,
    remaining: remainingQueue.length,
    synced,
  };
}
