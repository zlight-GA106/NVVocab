import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { allDueReviewBookTagValue } from './useWords';

type NextReviewScheduleState = {
  errorMessage: string;
  loading: boolean;
  nextReviewAt: string | null;
  nextReviewWordCount: number;
};

type UseNextReviewScheduleOptions = {
  bookTag?: string;
  enabled?: boolean;
  reloadKey?: number;
};

const millisecondsPerSecond = 1000;

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

  return '下一轮复习计划加载失败。';
}

function formatCountdown(nextReviewAt: string | null, now: Date): string {
  if (!nextReviewAt) {
    return '暂无安排';
  }

  const targetDate = new Date(nextReviewAt);
  if (Number.isNaN(targetDate.getTime())) {
    return '暂无安排';
  }

  const totalSeconds = Math.max(0, Math.floor((targetDate.getTime() - now.getTime()) / millisecondsPerSecond));
  if (totalSeconds === 0) {
    return '现在';
  }

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${days}天 ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatReviewDate(nextReviewAt: string | null): string {
  if (!nextReviewAt) {
    return '暂无安排';
  }

  const targetDate = new Date(nextReviewAt);
  if (Number.isNaN(targetDate.getTime())) {
    return '暂无安排';
  }

  return targetDate.toLocaleString('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function useNextReviewSchedule({
  bookTag = allDueReviewBookTagValue,
  enabled = true,
  reloadKey = 0,
}: UseNextReviewScheduleOptions = {}) {
  const [state, setState] = useState<NextReviewScheduleState>({
    errorMessage: '',
    loading: enabled && getSupabaseClient() !== null,
    nextReviewAt: null,
    nextReviewWordCount: 0,
  });
  const [now, setNow] = useState(() => new Date());

  const refresh = useCallback(async () => {
    if (!enabled) {
      setState({
        errorMessage: '',
        loading: false,
        nextReviewAt: null,
        nextReviewWordCount: 0,
      });
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setState({
        errorMessage: '尚未配置 Supabase 连接。',
        loading: false,
        nextReviewAt: null,
        nextReviewWordCount: 0,
      });
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
        throw new Error('请先登录账号，再查看下一轮复习计划。');
      }

      const nowIso = new Date().toISOString();
      let nextReviewQuery = supabase
        .from('wordbase')
        .select('next_review_at')
        .eq('user_id', user.id)
        .gt('next_review_at', nowIso)
        .order('next_review_at', { ascending: true })
        .limit(1);

      if (bookTag !== allDueReviewBookTagValue) {
        nextReviewQuery = nextReviewQuery.eq('book_tag', bookTag);
      }

      const nextReviewResult = await nextReviewQuery;

      if (nextReviewResult.error) {
        throw nextReviewResult.error;
      }

      const nextReviewAt = nextReviewResult.data?.[0]?.next_review_at ?? null;

      if (!nextReviewAt) {
        setState({
          errorMessage: '',
          loading: false,
          nextReviewAt: null,
          nextReviewWordCount: 0,
        });
        return;
      }

      let countQuery = supabase
        .from('wordbase')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gt('next_review_at', nowIso)
        .lte('next_review_at', nextReviewAt);

      if (bookTag !== allDueReviewBookTagValue) {
        countQuery = countQuery.eq('book_tag', bookTag);
      }

      const countResult = await countQuery;

      if (countResult.error) {
        throw countResult.error;
      }

      setState({
        errorMessage: '',
        loading: false,
        nextReviewAt,
        nextReviewWordCount: countResult.count ?? 0,
      });
    } catch (error: unknown) {
      setState({
        errorMessage: getErrorMessage(error),
        loading: false,
        nextReviewAt: null,
        nextReviewWordCount: 0,
      });
    }
  }, [bookTag, enabled]);

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
  }, [refresh, reloadKey]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, millisecondsPerSecond);

    return () => window.clearInterval(intervalId);
  }, []);

  const countdownText = useMemo(() => formatCountdown(state.nextReviewAt, now), [now, state.nextReviewAt]);
  const reviewDateText = useMemo(() => formatReviewDate(state.nextReviewAt), [state.nextReviewAt]);

  return {
    ...state,
    countdownText,
    refresh,
    reviewDateText,
  };
}
