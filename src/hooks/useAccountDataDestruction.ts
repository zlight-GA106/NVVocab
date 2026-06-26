import { useCallback, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';

type DestructionStatus = 'idle' | 'submitting' | 'success' | 'error';

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

  return '数据清空失败，请稍后重试。';
}

export function useAccountDataDestruction() {
  const [status, setStatus] = useState<DestructionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const destroyAccountData = useCallback(async () => {
    setStatus('submitting');
    setErrorMessage('');

    try {
      const supabase = getSupabaseClient();

      if (!supabase) {
        throw new Error('尚未配置 Supabase 连接。');
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error('请先登录账户，再执行数据清空。');
      }

      const { error: reviewLogsError } = await supabase
        .from('review_logs')
        .delete()
        .eq('user_id', user.id);

      if (reviewLogsError) {
        throw reviewLogsError;
      }

      const { error: wordbaseError } = await supabase.from('wordbase').delete().eq('user_id', user.id);

      if (wordbaseError) {
        throw wordbaseError;
      }

      setStatus('success');
      return true;
    } catch (error: unknown) {
      setStatus('error');
      setErrorMessage(getErrorMessage(error));
      return false;
    }
  }, []);

  return {
    destroyAccountData,
    errorMessage,
    isDestroying: status === 'submitting',
    status,
  };
}
