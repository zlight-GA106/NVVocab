import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient, type Database } from '../lib/supabase';

export const printAllBookTagValue = '__all_print_units__';

export interface PrintWordItem {
  book_tag: string | null;
  id: string;
  introtime: string | null;
  phonetic: string | null;
  translate: string;
  words: string;
}

type WordbaseRow = Database['public']['Tables']['wordbase']['Row'];
type PrintWordRow = Pick<WordbaseRow, 'book_tag' | 'id' | 'introtime' | 'phonetic' | 'translate' | 'words'>;

type UsePrintWordsOptions = {
  bookTag: string;
  wordIds?: string[];
};

type PrintWordsState = {
  bookTags: string[];
  errorMessage: string;
  filteredCount: number;
  loading: boolean;
  reload: () => Promise<void>;
  totalCount: number;
  words: PrintWordItem[];
};

type PrintWordsDataState = Omit<PrintWordsState, 'reload'>;

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

  return '打印词库加载失败，请稍后重试。';
}

function normalizeWord(row: PrintWordRow): PrintWordItem {
  return {
    book_tag: row.book_tag,
    id: row.id,
    introtime: row.introtime,
    phonetic: row.phonetic,
    translate: row.translate,
    words: row.words,
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

function sortWordsByQueueOrder(words: PrintWordItem[], wordIds: string[] | undefined): PrintWordItem[] {
  if (!wordIds) {
    return words;
  }

  const orderById = new Map(wordIds.map((id, index) => [id, index]));

  return [...words].sort((first, second) => {
    const firstIndex = orderById.get(first.id) ?? Number.MAX_SAFE_INTEGER;
    const secondIndex = orderById.get(second.id) ?? Number.MAX_SAFE_INTEGER;
    return firstIndex - secondIndex;
  });
}

export function usePrintWords({ bookTag, wordIds }: UsePrintWordsOptions): PrintWordsState {
  const [state, setState] = useState<PrintWordsDataState>({
    bookTags: [],
    errorMessage: '',
    filteredCount: 0,
    loading: true,
    totalCount: 0,
    words: [],
  });
  const wordIdsKey = wordIds?.join('\n') ?? '';

  const loadWords = useCallback(async () => {
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
      loading: true,
    }));

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('请先登录账号，再读取可打印词库。');
      }

      const wordIdsFilter = wordIds ? [...wordIds] : undefined;
      const shouldUseQueueFilter = wordIdsFilter !== undefined;

      const [totalResult, tagResult, wordResult] = await Promise.all([
        supabase.from('wordbase').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('wordbase').select('book_tag').eq('user_id', user.id),
        shouldUseQueueFilter && wordIdsFilter.length === 0
          ? Promise.resolve({ count: 0, data: [], error: null })
          : (() => {
              let wordsQuery = supabase
                .from('wordbase')
                .select('id,words,phonetic,translate,book_tag,introtime,user_id', { count: 'exact' })
                .eq('user_id', user.id);

              if (shouldUseQueueFilter && wordIdsFilter.length > 0) {
                wordsQuery = wordsQuery.in('id', wordIdsFilter);
              } else if (bookTag !== printAllBookTagValue) {
                wordsQuery = wordsQuery.eq('book_tag', bookTag);
              }

              return wordsQuery.order('introtime', { ascending: true });
            })(),
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

      setState({
        bookTags: extractBookTags(tagResult.data ?? []),
        errorMessage: '',
        filteredCount: wordResult.count ?? wordResult.data?.length ?? 0,
        loading: false,
        totalCount: totalResult.count ?? 0,
        words: sortWordsByQueueOrder(normalizedWords, wordIdsFilter),
      });
    } catch (error: unknown) {
      setState((current) => ({
        ...current,
        errorMessage: getErrorMessage(error),
        loading: false,
      }));
    }
  }, [bookTag, wordIds, wordIdsKey]);

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(async () => {
      if (!cancelled) {
        await loadWords();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadWords]);

  return {
    ...state,
    reload: loadWords,
  };
}
