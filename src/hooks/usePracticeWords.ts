import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient, type Database } from '../lib/supabase';
import { allDueReviewBookTagValue, type WordQueueSort } from './useWords';

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

      if (sortMode === 'introtimeAsc') {
        practiceWordsQuery = practiceWordsQuery.order('introtime', { ascending: true });
      }

      if (sortMode === 'introtimeDesc') {
        practiceWordsQuery = practiceWordsQuery.order('introtime', { ascending: false });
      }

      const { data, error } = await practiceWordsQuery.limit(limit);

      if (error) {
        throw error;
      }

      setWords(sortMode === 'random' ? shuffleWords(data ?? []) : (data ?? []));
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

      return (index + 1) % words.length;
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
  }, [fetchPracticeWords]);

  return {
    advance,
    currentWord,
    errorMessage,
    fetchPracticeWords,
    loading,
    queueLength: words.length,
  };
}
