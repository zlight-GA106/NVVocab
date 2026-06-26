import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient, type Database } from '../lib/supabase';

type ReviewLog = Database['public']['Tables']['review_logs']['Row'];
type WordbaseRow = Database['public']['Tables']['wordbase']['Row'];
type StudyTargetRow = Database['study']['Tables']['target']['Row'];
type ReviewLogEventFields = Pick<ReviewLog, 'quality' | 'reviewed_at' | 'word_id'>;
type TodayReviewLog = Pick<ReviewLog, 'quality' | 'word_id'>;
type WordStatusFields = Pick<WordbaseRow, 'id' | 'interval' | 'repetitions'>;
type ImportedWordFields = Pick<WordbaseRow, 'id' | 'introtime'>;

export type HeatmapDay = {
  date: string;
  count: number;
};

export type DashboardReviewEvent = {
  date: string;
  quality: number;
  reviewedAt: string;
  wordId: string | null;
};

export type DashboardImportEvent = {
  date: string;
  introtime: string;
  wordId: string;
};

export type WordStatusDistribution = {
  mastered: number;
  newWords: number;
  reviewing: number;
};

type DashboardStats = {
  dailyWordTarget: number;
  dueWordsCount: number;
  heatmapValues: HeatmapDay[];
  importEvents: DashboardImportEvent[];
  masteredWordIds: string[];
  reviewEvents: DashboardReviewEvent[];
  masteredCount: number;
  streakDays: number;
  todayImportedCount: number;
  todayReviewedCount: number;
  totalWords: number;
  wordStatusDistribution: WordStatusDistribution;
};

const oneYearInDays = 365;
const millisecondsPerDay = 24 * 60 * 60 * 1000;

function toDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getStartDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - oneYearInDays);
}

function getTodayStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

  return '看板数据加载失败。';
}

function buildReviewEvents(logs: ReviewLogEventFields[]): DashboardReviewEvent[] {
  return logs.reduce<DashboardReviewEvent[]>((events, log) => {
    if (!log.reviewed_at) {
      return events;
    }

    return [
      ...events,
      {
        date: toDateKey(new Date(log.reviewed_at)),
        quality: log.quality,
        reviewedAt: log.reviewed_at,
        wordId: log.word_id,
      },
    ];
  }, []);
}

function buildImportEvents(words: ImportedWordFields[]): DashboardImportEvent[] {
  return words.reduce<DashboardImportEvent[]>((events, word) => {
    if (!word.introtime) {
      return events;
    }

    return [
      ...events,
      {
        date: toDateKey(new Date(word.introtime)),
        introtime: word.introtime,
        wordId: word.id,
      },
    ];
  }, []);
}

function buildHeatmapValues(logs: DashboardReviewEvent[], startDate: Date): HeatmapDay[] {
  const countsByDate = logs.reduce<Map<string, number>>((memo, log) => {
    memo.set(log.date, (memo.get(log.date) ?? 0) + 1);
    return memo;
  }, new Map<string, number>());

  return Array.from({ length: oneYearInDays + 1 }, (_, index) => {
    const date = new Date(startDate.getTime() + index * millisecondsPerDay);
    const dateKey = toDateKey(date);
    return {
      count: countsByDate.get(dateKey) ?? 0,
      date: dateKey,
    };
  });
}

function calculateStreakDays(logs: DashboardReviewEvent[], today: Date): number {
  const activeDates = new Set<string>();

  logs.forEach((log) => {
    activeDates.add(log.date);
  });

  let streak = 0;
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  while (activeDates.has(toDateKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
  }

  return streak;
}

function calculateTodayReviewedCount(logs: TodayReviewLog[]): number {
  const passedWordIds = new Set<string>();

  logs.forEach((log) => {
    if (log.word_id && log.quality >= 3) {
      passedWordIds.add(log.word_id);
    }
  });

  return passedWordIds.size;
}

function buildDistribution(words: WordStatusFields[]): WordStatusDistribution {
  return words.reduce<WordStatusDistribution>(
    (memo, word) => {
      const repetitions = word.repetitions ?? 0;
      const interval = word.interval ?? 1;

      if (repetitions === 0) {
        memo.newWords += 1;
        return memo;
      }

      if (interval > 7) {
        memo.mastered += 1;
        return memo;
      }

      memo.reviewing += 1;
      return memo;
    },
    { mastered: 0, newWords: 0, reviewing: 0 },
  );
}

function getMasteredWordIds(words: WordStatusFields[]): string[] {
  return words.reduce<string[]>((ids, word) => {
    if ((word.repetitions ?? 0) >= 3) {
      return [...ids, word.id];
    }

    return ids;
  }, []);
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    dailyWordTarget: 0,
    dueWordsCount: 0,
    heatmapValues: buildHeatmapValues([], getStartDate()),
    importEvents: [],
    masteredWordIds: [],
    reviewEvents: [],
    masteredCount: 0,
    streakDays: 0,
    todayImportedCount: 0,
    todayReviewedCount: 0,
    totalWords: 0,
    wordStatusDistribution: { mastered: 0, newWords: 0, reviewing: 0 },
  });
  const [loading, setLoading] = useState(() => getSupabaseClient() !== null);
  const [errorMessage, setErrorMessage] = useState('');

  const startDate = useMemo(() => getStartDate(), []);
  const endDate = useMemo(() => new Date(), []);

  const refresh = useCallback(async () => {
    const supabase = getSupabaseClient();

    if (!supabase) {
      setLoading(false);
      setErrorMessage('尚未配置数据库连接。');
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
        throw new Error('请先登录账号，再查看学习看板。');
      }

      const now = new Date();
      const todayStart = getTodayStart();
      const [logsResult, wordsResult, importedWordsResult, dueWordsResult, todayReviewedResult, targetResult] = await Promise.all([
        supabase
          .from('review_logs')
          .select('reviewed_at,quality,word_id')
          .eq('user_id', user.id)
          .gte('reviewed_at', startDate.toISOString()),
        supabase.from('wordbase').select('id,interval,repetitions').eq('user_id', user.id),
        supabase
          .from('wordbase')
          .select('id,introtime')
          .eq('user_id', user.id)
          .gte('introtime', startDate.toISOString()),
        supabase
          .from('wordbase')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .lte('next_review_at', now.toISOString()),
        supabase
          .from('review_logs')
          .select('word_id,quality')
          .eq('user_id', user.id)
          .gte('reviewed_at', todayStart.toISOString())
          .gte('quality', 3),
        supabase
          .schema('study')
          .from('target')
          .select('daily_word_target,status,created_at')
          .in('status', ['active', 'paused'])
          .order('created_at', { ascending: false })
          .limit(1),
      ]);

      if (logsResult.error) {
        throw logsResult.error;
      }

      if (wordsResult.error) {
        throw wordsResult.error;
      }

      if (dueWordsResult.error) {
        throw dueWordsResult.error;
      }

      if (importedWordsResult.error) {
        throw importedWordsResult.error;
      }

      if (todayReviewedResult.error) {
        throw todayReviewedResult.error;
      }

      if (targetResult.error) {
        throw targetResult.error;
      }

      const words = wordsResult.data ?? [];
      const distribution = buildDistribution(words);
      const reviewEvents = buildReviewEvents(logsResult.data ?? []);
      const importEvents = buildImportEvents(importedWordsResult.data ?? []);
      const latestTarget = (targetResult.data?.[0] ?? null) as Pick<StudyTargetRow, 'daily_word_target'> | null;

      setStats({
        dailyWordTarget: latestTarget?.daily_word_target ?? 0,
        dueWordsCount: dueWordsResult.count ?? 0,
        heatmapValues: buildHeatmapValues(reviewEvents, startDate),
        importEvents,
        masteredWordIds: getMasteredWordIds(words),
        reviewEvents,
        masteredCount: distribution.mastered,
        streakDays: calculateStreakDays(reviewEvents, now),
        todayImportedCount: importEvents.filter((event) => event.introtime >= todayStart.toISOString()).length,
        todayReviewedCount: calculateTodayReviewedCount(todayReviewedResult.data ?? []),
        totalWords: words.length,
        wordStatusDistribution: distribution,
      });
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [startDate]);

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(async () => {
      if (!cancelled) {
        await refresh();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return {
    endDate,
    errorMessage,
    loading,
    refresh,
    startDate,
    ...stats,
  };
}
