import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient, type Database } from '../lib/supabase';
import { allDueReviewBookTagValue, type WordQueueSort } from './useWords';
import { compareByAdaptiveProficiency } from '../utils/proficiencyRating';

export type PracticeWord = Database['public']['Tables']['wordbase']['Row'];

type UsePracticeWordsOptions = {
  bookTag?: string;
  enabled: boolean;
  limit?: number;
  sortMode?: WordQueueSort;
};

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

  return '练习词库加载失败。';
}

function shuffleWords(words: PracticeWord[]): PracticeWord[] {
  const shuffledWords = [...words];

  for (let index = shuffledWords.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const currentWord = shuffledWords[index];
    shuffledWords[index] = shuffledWords[randomIndex];
    shuffledWords[randomIndex] = currentWord;
  }

  return shuffledWords;
}

function sortAdaptiveWords(words: PracticeWord[], limit: number): PracticeWord[] {
  const now = new Date();
  return [...words].sort((first, second) => compareByAdaptiveProficiency(first, second, now)).slice(0, limit);
}

export function usePracticeWords({
  bookTag = allDueReviewBookTagValue,
  enabled,
  limit = 80,
  sortMode = 'introtimeAsc',
}: UsePracticeWordsOptions) {
  const [words, setWords] = useState<PracticeWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(enabled && getSupabaseClient() !== null);
  const [errorMessage, setErrorMessage] = useState('');

  const currentWord = useMemo(() => words[currentIndex] ?? null, [currentIndex, words]);
  const completed = words.length > 0 && currentIndex >= words.length;
  const remainingCount = Math.max(words.length - currentIndex, 0);

  const fetchPracticeWords = useCallback(async () => {
    const supabase = getSupabaseClient();

    if (!supabase) {
      setErrorMessage('尚未配置数据库连接。');
      setLoading(false);
      setWords([]);
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
        throw new Error('请先登录账号，再开始练习。');
      }

      let practiceWordsQuery = supabase
        .from('wordbase')
        .select('*')
        .eq('user_id', user.id);

      if (bookTag !== allDueReviewBookTagValue) {
        practiceWordsQuery = practiceWordsQuery.eq('book_tag', bookTag);
      }

      if (sortMode === 'adaptive') {
        practiceWordsQuery = practiceWordsQuery
          .order('repetitions', { ascending: true })
          .order('wrong_count', { ascending: false })
          .order('next_review_at', { ascending: true });
      }

      if (sortMode === 'introtimeAsc') {
        practiceWordsQuery = practiceWordsQuery.order('introtime', { ascending: true });
      }

      if (sortMode === 'introtimeDesc') {
        practiceWordsQuery = practiceWordsQuery.order('introtime', { ascending: false });
      }

      const queryLimit = sortMode === 'adaptive' ? Math.min(500, Math.max(limit * 4, limit)) : limit;
      const { data, error } = await practiceWordsQuery.limit(queryLimit);

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
      setLoading(false);
    }
  }, [bookTag, limit, sortMode]);

  const advance = useCallback(() => {
    setCurrentIndex((index) => {
      if (words.length === 0) {
        return 0;
      }

      return Math.min(index + 1, words.length);
    });
  }, [words.length]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let cancelled = false;

    Promise.resolve().then(async () => {
      if (!cancelled) {
        await fetchPracticeWords();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, fetchPracticeWords]);

  return {
    advance,
    completed,
    currentWord,
    errorMessage,
    fetchPracticeWords,
    loading,
    queueLength: remainingCount,
  };
}
