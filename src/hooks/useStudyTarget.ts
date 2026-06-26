import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';

export type StudyTargetStatus = 'active' | 'paused';

export type StudyTarget = {
  created_at: string | null;
  daily_word_target: number;
  end_at: string;
  id: string;
  start_at: string;
  status: StudyTargetStatus;
  time_invested_seconds: number;
  title: string;
};

export type StudyTargetPayload = {
  daily_word_target: number;
  end_at: string;
  start_at: string;
  title: string;
};

type StudyTargetActionStatus = 'idle' | 'loading' | 'submitting' | 'error';

type StudyTargetRow = {
  created_at: string | null;
  daily_word_target: number | null;
  end_at: string;
  id: string;
  start_at: string;
  status: StudyTargetStatus | null;
  time_invested_seconds: number | null;
  title: string;
};

function normalizeTarget(row: StudyTargetRow): StudyTarget {
  return {
    created_at: row.created_at,
    daily_word_target: row.daily_word_target ?? 50,
    end_at: row.end_at,
    id: row.id,
    start_at: row.start_at,
    status: row.status === 'paused' ? 'paused' : 'active',
    time_invested_seconds: row.time_invested_seconds ?? 0,
    title: row.title,
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

  return '学习目标同步失败，请稍后重试。';
}

export function useStudyTarget() {
  const [target, setTarget] = useState<StudyTarget | null>(null);
  const [status, setStatus] = useState<StudyTargetActionStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const loadTarget = useCallback(async () => {
    setStatus('loading');
    setErrorMessage('');

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('尚未配置 Supabase 连接。');
      }

      const { data, error } = await supabase
        .schema('study')
        .from('target')
        .select('id,title,start_at,end_at,status,time_invested_seconds,daily_word_target,created_at')
        .in('status', ['active', 'paused'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        throw error;
      }

      const latestTarget = data[0] ?? null;
      setTarget(latestTarget ? normalizeTarget(latestTarget) : null);
      setStatus('idle');
    } catch (error: unknown) {
      setStatus('error');
      setErrorMessage(getErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (!cancelled) {
        void loadTarget();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadTarget]);

  const persistInvestedSeconds = useCallback(async (targetId: string, seconds: number) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return false;
    }

    const { error } = await supabase
      .schema('study')
      .from('target')
      .update({ time_invested_seconds: Math.max(0, Math.floor(seconds)) })
      .eq('id', targetId);

    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
      return false;
    }

    return true;
  }, []);

  const saveTarget = useCallback(
    async (payload: StudyTargetPayload, localInvestedSeconds: number) => {
      setStatus('submitting');
      setErrorMessage('');

      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          throw new Error('尚未配置 Supabase 连接。');
        }

        if (target) {
          const { data, error } = await supabase
            .schema('study')
            .from('target')
            .update(payload)
            .eq('id', target.id)
            .select('id,title,start_at,end_at,status,time_invested_seconds,daily_word_target,created_at')
            .single();

          if (error) {
            throw error;
          }

          const nextTarget = {
            ...normalizeTarget(data),
            time_invested_seconds: Math.max(0, Math.floor(localInvestedSeconds)),
          };
          setTarget(nextTarget);
          setStatus('idle');
          return nextTarget;
        }

        const { data, error } = await supabase
          .schema('study')
          .from('target')
          .insert({
            ...payload,
            status: 'active',
            time_invested_seconds: Math.max(0, Math.floor(localInvestedSeconds)),
          })
          .select('id,title,start_at,end_at,status,time_invested_seconds,daily_word_target,created_at')
          .single();

        if (error) {
          throw error;
        }

        const nextTarget = normalizeTarget(data);
        setTarget(nextTarget);
        setStatus('idle');
        return nextTarget;
      } catch (error: unknown) {
        setStatus('error');
        setErrorMessage(getErrorMessage(error));
        return null;
      }
    },
    [target],
  );

  const updateTargetStatus = useCallback(
    async (targetId: string, nextStatus: StudyTargetStatus, seconds: number) => {
      setStatus('submitting');
      setErrorMessage('');

      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          throw new Error('尚未配置 Supabase 连接。');
        }

        const { data, error } = await supabase
          .schema('study')
          .from('target')
          .update({
            status: nextStatus,
            time_invested_seconds: Math.max(0, Math.floor(seconds)),
          })
          .eq('id', targetId)
          .select('id,title,start_at,end_at,status,time_invested_seconds,daily_word_target,created_at')
          .single();

        if (error) {
          throw error;
        }

        const nextTarget = normalizeTarget(data);
        setTarget(nextTarget);
        setStatus('idle');
        return nextTarget;
      } catch (error: unknown) {
        setStatus('error');
        setErrorMessage(getErrorMessage(error));
        return null;
      }
    },
    [],
  );

  const deleteTarget = useCallback(
    async (targetId: string, seconds: number) => {
      setStatus('submitting');
      setErrorMessage('');

      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          throw new Error('尚未配置 Supabase 连接。');
        }

        const persisted = await persistInvestedSeconds(targetId, seconds);
        if (!persisted) {
          throw new Error('删除前同步已投入时间失败。');
        }

        const { error } = await supabase.schema('study').from('target').delete().eq('id', targetId);

        if (error) {
          throw error;
        }

        setTarget(null);
        setStatus('idle');
        return true;
      } catch (error: unknown) {
        setStatus('error');
        setErrorMessage(getErrorMessage(error));
        return false;
      }
    },
    [persistInvestedSeconds],
  );

  const loadTodayImportedWordCount = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return 0;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const { count, error } = await supabase
      .from('wordbase')
      .select('id', { count: 'exact', head: true })
      .gte('introtime', `${todayStr}T00:00:00.000Z`);

    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
      return 0;
    }

    return count ?? 0;
  }, []);

  return {
    deleteTarget,
    errorMessage,
    isLoading: status === 'loading',
    isSubmitting: status === 'submitting',
    loadTodayImportedWordCount,
    loadTarget,
    persistInvestedSeconds,
    saveTarget,
    status,
    target,
    updateTargetStatus,
  };
}
