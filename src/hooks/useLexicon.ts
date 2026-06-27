import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseClient, type Database } from '../lib/supabase';
import { getWordProficiency } from '../utils/proficiencyRating';

export type AlphabetFilter = 'all' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z';

export type LexiconSortMode = 'introtimeAsc' | 'introtimeDesc' | 'proficiencyAsc' | 'proficiencyDesc';

export interface WordItem {
  book_tag: string | null;
  easiness: number | null;
  id: string;
  interval: number | null;
  introtime: string | null;
  next_review_at: string | null;
  phonetic: string | null;
  repetitions: number | null;
  translate: string;
  words: string;
  wrong_count: number | null;
}

type WordbaseRow = Database['public']['Tables']['wordbase']['Row'];

type UseLexiconOptions = {
  alphabetFilter: AlphabetFilter;
  bookTag: string;
  sortMode: LexiconSortMode;
};

type LexiconState = {
  bookTags: string[];
  deletingWordId: string | null;
  deleteWord: (wordId: string) => Promise<boolean>;
  errorMessage: string;
  filteredCount: number;
  loading: boolean;
  reload: () => Promise<void>;
  totalCount: number;
  words: WordItem[];
};

type LexiconDataState = Omit<LexiconState, 'deletingWordId' | 'deleteWord' | 'reload'>;

export const allBookTagValue = '__all_units__';

export const alphabetFilters: AlphabetFilter[] = [
  'all',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
];

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

  return '词库数据加载失败，请稍后重试。';
}

function normalizeWord(row: WordbaseRow): WordItem {
  return {
    book_tag: row.book_tag,
    easiness: row.easiness,
    id: row.id,
    interval: row.interval,
    introtime: row.introtime,
    next_review_at: row.next_review_at,
    phonetic: row.phonetic,
    repetitions: row.repetitions,
    translate: row.translate,
    words: row.words,
    wrong_count: row.wrong_count,
  };
}

function extractBookTags(rows: Pick<WordbaseRow, 'book_tag'>[]): string[] {
  const tags = new Set<string>();

  rows.forEach((row) => {
    const tag = row.book_tag?.trim();
    if (tag) {
      tags.add(tag);
    }
  });

  return Array.from(tags).sort((first, second) => first.localeCompare(second, 'zh-CN'));
}

function sortWordsByProficiency(words: WordItem[], sortMode: LexiconSortMode): WordItem[] {
  if (sortMode !== 'proficiencyAsc' && sortMode !== 'proficiencyDesc') {
    return words;
  }

  const now = new Date();
  const direction = sortMode === 'proficiencyAsc' ? 1 : -1;

  return [...words].sort((first, second) => {
    const firstRating = getWordProficiency(first, now);
    const secondRating = getWordProficiency(second, now);
    const scoreDelta = (firstRating.score - secondRating.score) * direction;

    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return secondRating.priority - firstRating.priority;
  });
}

export function useLexicon({ alphabetFilter, bookTag, sortMode }: UseLexiconOptions): LexiconState {
  const [state, setState] = useState<LexiconDataState>({
    bookTags: [],
    errorMessage: '',
    filteredCount: 0,
    loading: true,
    totalCount: 0,
    words: [],
  });
  const [deletingWordId, setDeletingWordId] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const loadLexicon = useCallback(async (showLoading = true) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const supabase = getSupabaseClient();

    if (!supabase) {
      setState((current) => ({
        ...current,
        errorMessage: '尚未配置 Supabase 连接。',
        loading: false,
      }));
      return;
    }

    setState((current) => ({
      ...current,
      errorMessage: '',
      loading: showLoading ? true : current.loading,
    }));

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('请先登录账号，再查看自己的词库。');
      }

      let wordsQuery = supabase
        .from('wordbase')
        .select(
          'id,words,phonetic,translate,book_tag,introtime,repetitions,interval,easiness,next_review_at,wrong_count,user_id',
          { count: 'exact' },
        )
        .eq('user_id', user.id);

      if (alphabetFilter !== 'all') {
        wordsQuery = wordsQuery.ilike('words', `${alphabetFilter.toLocaleLowerCase()}%`);
      }

      if (bookTag !== allBookTagValue) {
        wordsQuery = wordsQuery.eq('book_tag', bookTag);
      }

      const [totalResult, tagResult, wordResult] = await Promise.all([
        supabase.from('wordbase').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('wordbase').select('book_tag').eq('user_id', user.id),
        wordsQuery.order('introtime', { ascending: sortMode === 'introtimeAsc' }),
      ]);

      if (totalResult.error) {
        throw totalResult.error;
      }

      if (tagResult.error) {
        throw tagResult.error;
      }

      if (wordResult.error) {
        throw wordResult.error;
      }

      const normalizedWords = (wordResult.data ?? []).map(normalizeWord);

      if (requestId !== requestIdRef.current) {
        return;
      }

      setState({
        bookTags: extractBookTags(tagResult.data ?? []),
        errorMessage: '',
        filteredCount: wordResult.count ?? wordResult.data?.length ?? 0,
        loading: false,
        totalCount: totalResult.count ?? 0,
        words: sortWordsByProficiency(normalizedWords, sortMode),
      });
    } catch (error: unknown) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      setState((current) => ({
        ...current,
        errorMessage: getErrorMessage(error),
        loading: false,
      }));
    }
  }, [alphabetFilter, bookTag, sortMode]);

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(async () => {
      if (!cancelled) {
        await loadLexicon();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadLexicon]);

  const deleteWord = useCallback(
    async (wordId: string) => {
      const supabase = getSupabaseClient();

      if (!supabase) {
        setState((current) => ({
          ...current,
          errorMessage: '尚未配置 Supabase 连接。',
        }));
        return false;
      }

      setDeletingWordId(wordId);
      setState((current) => ({
        ...current,
        errorMessage: '',
      }));

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error('请先登录账号，再删除词条。');
        }

        const { error: logsError } = await supabase
          .from('review_logs')
          .delete()
          .eq('user_id', user.id)
          .eq('word_id', wordId);

        if (logsError) {
          throw logsError;
        }

        const { error: wordError } = await supabase
          .from('wordbase')
          .delete()
          .eq('user_id', user.id)
          .eq('id', wordId);

        if (wordError) {
          throw wordError;
        }

        await loadLexicon(false);
        return true;
      } catch (error: unknown) {
        setState((current) => ({
          ...current,
          errorMessage: getErrorMessage(error),
        }));
        return false;
      } finally {
        setDeletingWordId(null);
      }
    },
    [loadLexicon],
  );

  return {
    ...state,
    deletingWordId,
    deleteWord,
    reload: loadLexicon,
  };
}
