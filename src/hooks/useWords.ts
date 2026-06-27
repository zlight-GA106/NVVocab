import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient, type Database } from '../lib/supabase';
import {
  appendOfflineReviewQueueItem,
  createOfflineReviewQueueItem,
  getOfflineReviewQueueCount,
  type OfflineWordUpdate,
} from '../lib/offlineReviewQueue';
import {
  clearCramMode,
  getCramModeCutoffDate,
  isCramModeEnabled,
} from '../lib/cramMode';
import {
  calculateAnkiNextState,
  type AnkiQuality,
} from '../utils/ankiScheduler';
import { compareByAdaptiveProficiency } from '../utils/proficiencyRating';

export type ReviewWord = Database['public']['Tables']['wordbase']['Row'];

type WordbaseUpdate = Database['public']['Tables']['wordbase']['Update'];
type ReviewLogInsert = Database['public']['Tables']['review_logs']['Insert'];

type ReviewResult = {
  isCorrect: boolean;
  usedHint: boolean;
  answer: string;
  quality?: AnkiQuality;
};

type Sm2State = {
  easiness: number;
  interval: number;
  next_review_at: string;
  repetitions: number;
  wrong_count: number;
  quality: AnkiQuality;
};

type UseWordsOptions = {
  bookTag?: string;
  enabled?: boolean;
  limit?: number;
  reloadKey?: number;
  sortMode?: WordQueueSort;
};

export type WordQueueSort = 'adaptive' | 'introtimeAsc' | 'introtimeDesc' | 'random';

export const allDueReviewBookTagValue = '__all_due_review_words__';

function getReviewQuality(isCorrect: boolean, usedHint: boolean): AnkiQuality {
  if (!isCorrect) {
    return 0;
  }

  return usedHint ? 3 : 5;
}

export function calculateSm2State(
  word: ReviewWord,
  result: ReviewResult,
  reviewedAt: Date = new Date(),
): Sm2State {
  const quality = result.quality ?? getReviewQuality(result.isCorrect, result.usedHint);
  const currentWrongCount = word.wrong_count ?? 0;
  const nextState = calculateAnkiNextState(
    {
      easiness: word.easiness,
      interval: word.interval,
      next_review_at: word.next_review_at,
      repetitions: word.repetitions,
    },
    quality,
    reviewedAt,
  );

  return {
    easiness: nextState.easiness,
    interval: nextState.interval,
    next_review_at: nextState.next_review_at,
    quality,
    repetitions: nextState.repetitions,
    wrong_count: result.isCorrect ? currentWrongCount : currentWrongCount + 1,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return '复习数据同步失败。';
}

function isOfflineNetworkError(error: unknown): boolean {
  if (typeof window !== 'undefined' && !window.navigator.onLine) {
    return true;
  }

  const message = getErrorMessage(error).toLocaleLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('load failed')
  );
}

export function normalizeSpelling(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

export function isSpellingCorrect(answer: string, word: ReviewWord): boolean {
  return normalizeSpelling(answer) === normalizeSpelling(word.words);
}

function extractBookTags(rows: Pick<ReviewWord, 'book_tag'>[]): string[] {
  const tags = new Set<string>();

  rows.forEach((row) => {
    const tag = row.book_tag?.trim();
    if (tag) {
      tags.add(tag);
    }
  });

  return Array.from(tags).sort((first, second) => first.localeCompare(second, 'zh-CN'));
}

function shuffleWords(words: ReviewWord[]): ReviewWord[] {
  const shuffledWords = [...words];

  for (let index = shuffledWords.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const currentWord = shuffledWords[index];
    shuffledWords[index] = shuffledWords[randomIndex];
    shuffledWords[randomIndex] = currentWord;
  }

  return shuffledWords;
}

function sortAdaptiveWords(words: ReviewWord[], limit: number): ReviewWord[] {
  const now = new Date();
  return [...words].sort((first, second) => compareByAdaptiveProficiency(first, second, now)).slice(0, limit);
}

export function useWords(options: UseWordsOptions = {}) {
  const bookTag = options.bookTag ?? allDueReviewBookTagValue;
  const enabled = options.enabled ?? true;
  const limit = options.limit ?? 50;
  const reloadKey = options.reloadKey ?? 0;
  const sortMode = options.sortMode ?? 'introtimeAsc';
  const [bookTags, setBookTags] = useState<string[]>([]);
  const [words, setWords] = useState<ReviewWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(() => enabled && getSupabaseClient() !== null);
  const [errorMessage, setErrorMessage] = useState('');
  const [loadedReloadKey, setLoadedReloadKey] = useState<number | null>(enabled ? null : reloadKey);
  const [offlineMessage, setOfflineMessage] = useState('');
  const [offlineQueueCount, setOfflineQueueCount] = useState(() => getOfflineReviewQueueCount());
  const [submitting, setSubmitting] = useState(false);

  const currentWord = useMemo(() => words[currentIndex] ?? null, [currentIndex, words]);

  const fetchDueWords = useCallback(async () => {
    const supabase = getSupabaseClient();

    if (!supabase) {
      setErrorMessage('尚未配置数据库连接。');
      setLoading(false);
      setWords([]);
      setLoadedReloadKey(reloadKey);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('请先登录账号，再开始默写复习。');
      }

      const tagResult = await supabase.from('wordbase').select('book_tag').eq('user_id', user.id);

      if (tagResult.error) {
        throw tagResult.error;
      }

      setBookTags(extractBookTags(tagResult.data ?? []));

      if (!enabled) {
        setWords([]);
        setCurrentIndex(0);
        setLoadedReloadKey(reloadKey);
        return;
      }

      const now = new Date();
      const reviewCutoff = isCramModeEnabled() ? getCramModeCutoffDate(now) : now;
      let dueWordsQuery = supabase
        .from('wordbase')
        .select('*')
        .eq('user_id', user.id)
        .lte('next_review_at', reviewCutoff.toISOString());

      if (bookTag !== allDueReviewBookTagValue) {
        dueWordsQuery = dueWordsQuery.eq('book_tag', bookTag);
      }

      if (sortMode === 'adaptive') {
        dueWordsQuery = dueWordsQuery
          .order('repetitions', { ascending: true })
          .order('wrong_count', { ascending: false })
          .order('next_review_at', { ascending: true });
      }

      if (sortMode === 'introtimeAsc') {
        dueWordsQuery = dueWordsQuery.order('introtime', { ascending: true });
      }

      if (sortMode === 'introtimeDesc') {
        dueWordsQuery = dueWordsQuery.order('introtime', { ascending: false });
      }

      const queryLimit = sortMode === 'adaptive' ? Math.min(500, Math.max(limit * 4, limit)) : limit;
      const dueWordsResult = await dueWordsQuery.limit(queryLimit);

      const { data, error } = dueWordsResult;

      if (error) {
        throw error;
      }

      const loadedWords = data ?? [];
      const nextWords =
        sortMode === 'random'
          ? shuffleWords(loadedWords)
          : sortMode === 'adaptive'
            ? sortAdaptiveWords(loadedWords, limit)
            : loadedWords;

      setWords(nextWords);
      setCurrentIndex(0);
    } catch (error: unknown) {
      setWords([]);
      setCurrentIndex(0);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoadedReloadKey(reloadKey);
      setLoading(false);
    }
  }, [bookTag, enabled, limit, reloadKey, sortMode]);

  const submitReview = useCallback(async (word: ReviewWord, result: ReviewResult) => {
    const supabase = getSupabaseClient();

    if (!supabase) {
      setErrorMessage('尚未配置数据库连接。');
      return false;
    }

    setSubmitting(true);
    setErrorMessage('');
    setOfflineMessage('');

    let offlineItem:
      | {
          reviewLog: ReviewLogInsert;
          userId: string;
          wordId: string;
          wordUpdate: OfflineWordUpdate;
        }
      | null = null;

    const finishLocalReview = () => {
      setWords((previousWords) => {
        const nextWords = previousWords.filter((queuedWord) => queuedWord.id !== word.id);

        if (nextWords.length === 0) {
          clearCramMode();
        }

        return nextWords;
      });
      setCurrentIndex(0);
    };

    const enqueueOfflineReview = () => {
      if (!offlineItem) {
        return false;
      }

      const nextQueueCount = appendOfflineReviewQueueItem(
        createOfflineReviewQueueItem({
          reviewLog: offlineItem.reviewLog,
          userId: offlineItem.userId,
          wordId: offlineItem.wordId,
          wordUpdate: offlineItem.wordUpdate,
        }),
      );
      setOfflineQueueCount(nextQueueCount);
      setOfflineMessage(`离线暂存成功，待同步 ${nextQueueCount} 条。`);
      finishLocalReview();
      return true;
    };

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        throw new Error('请先登录账号，再提交默写结果。');
      }

      const user = session.user;
      const reviewedAt = new Date();
      const nextState = calculateSm2State(word, result, reviewedAt);
      const wordUpdate: OfflineWordUpdate = {
        easiness: nextState.easiness,
        interval: nextState.interval,
        next_review_at: nextState.next_review_at,
        repetitions: nextState.repetitions,
        wrong_count: nextState.wrong_count,
      };
      const reviewLog: ReviewLogInsert = {
        quality: nextState.quality,
        reviewed_at: reviewedAt.toISOString(),
        user_id: user.id,
        word_id: word.id,
      };
      offlineItem = {
        reviewLog,
        userId: user.id,
        wordId: word.id,
        wordUpdate,
      };

      if (!window.navigator.onLine) {
        return enqueueOfflineReview();
      }

      const [wordUpdateResult, logInsertResult] = await Promise.all([
        supabase.from('wordbase').update(wordUpdate as WordbaseUpdate).eq('id', word.id).eq('user_id', user.id),
        supabase.from('review_logs').insert(reviewLog),
      ]);

      if (wordUpdateResult.error) {
        throw wordUpdateResult.error;
      }

      if (logInsertResult.error) {
        throw logInsertResult.error;
      }

      finishLocalReview();
      return true;
    } catch (error: unknown) {
      if (offlineItem && isOfflineNetworkError(error)) {
        return enqueueOfflineReview();
      }

      setErrorMessage(getErrorMessage(error));
      return false;
    } finally {
      setSubmitting(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(async () => {
      if (!cancelled) {
        await fetchDueWords();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [fetchDueWords, reloadKey]);

  return {
    bookTags,
    currentIndex,
    currentWord,
    errorMessage,
    fetchDueWords,
    isSpellingCorrect,
    loading,
    loadedReloadKey,
    offlineMessage,
    offlineQueueCount,
    queueLength: words.length,
    submitReview,
    submitting,
    words,
  };
}
