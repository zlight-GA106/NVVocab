import { useCallback, useMemo, useState } from 'react';
import { getSupabaseClient, type Database } from '../lib/supabase';

export type ParsedWord = {
  words: string;
  phonetic: string;
  translate: string;
};

type ImportStatus = 'idle' | 'submitting' | 'success' | 'error';

type ImportWordsInput = {
  bookTag: string;
  parsedWords: ParsedWord[];
};

type WordbaseInsert = Database['public']['Tables']['wordbase']['Insert'];

const phoneticLineRegex =
  /^([A-Za-z][A-Za-z'’-]*(?:\s+[A-Za-z][A-Za-z'’-]*)*)\s*(?:\[([^\]]+)\]|\/([^/]+)\/)\s+(.+)$/u;

const plainLineRegex = /^([A-Za-z][A-Za-z'’-]*)\s+(.+)$/u;

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

  return '向 Supabase 写入数据时发生异常。';
}

function parseWordLine(line: string): ParsedWord | null {
  const trimmed = line.trim();

  if (!trimmed) {
    return null;
  }

  const phoneticMatch = trimmed.match(phoneticLineRegex);
  if (phoneticMatch) {
    return {
      words: phoneticMatch[1].trim(),
      phonetic: (phoneticMatch[2] ?? phoneticMatch[3] ?? '').trim(),
      translate: phoneticMatch[4].trim(),
    };
  }

  const plainMatch = trimmed.match(plainLineRegex);
  if (plainMatch) {
    return {
      words: plainMatch[1].trim(),
      phonetic: '',
      translate: plainMatch[2].trim(),
    };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) {
    return null;
  }

  return {
    words: parts[0],
    phonetic: '',
    translate: parts.slice(1).join(' '),
  };
}

export function useParsedWords(rawText: string): ParsedWord[] {
  return useMemo(
    () =>
      rawText
        .split('\n')
        .map(parseWordLine)
        .filter((word): word is ParsedWord => word !== null),
    [rawText],
  );
}

export function useWordImporter() {
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [message, setMessage] = useState('');

  const importWords = useCallback(async ({ bookTag, parsedWords }: ImportWordsInput) => {
    if (parsedWords.length === 0) {
      return false;
    }

    setStatus('submitting');
    setMessage('');

    const supabase = getSupabaseClient();
    if (!supabase) {
      setStatus('error');
      setMessage('检测到尚未配置本地数据库连接，请先完成数据库连接引导。');
      return false;
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('请先登录账号，再导入自己的词库。');
      }

      const tag = bookTag.trim() || '未分类自增';
      const now = new Date().toISOString();
      const payload: WordbaseInsert[] = parsedWords.map((word) => ({
        user_id: user.id,
        words: word.words,
        phonetic: word.phonetic || null,
        translate: word.translate,
        book_tag: tag,
        repetitions: 0,
        interval: 1,
        easiness: 2.5,
        next_review_at: now,
        wrong_count: 0,
      }));

      const { error } = await supabase.from('wordbase').insert(payload);
      if (error) {
        throw error;
      }

      setStatus('success');
      setMessage(`成功将 ${parsedWords.length} 个单词导入到 ${tag}。`);
      return true;
    } catch (error: unknown) {
      setStatus('error');
      setMessage(getErrorMessage(error));
      return false;
    }
  }, []);

  return {
    importWords,
    isSubmitting: status === 'submitting',
    message,
    status,
  };
}
