import { useCallback, useState } from 'react';
import {
  createSupabaseClientFromCredentials,
  normalizeSupabaseCredentials,
  persistSupabaseCredentials,
  validateSupabaseCredentials,
  type SupabaseCredentials,
} from '../lib/supabase';

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';

function getReadableError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return '连接测试失败，请检查 Supabase 地址、匿名密钥与 wordbase 表权限。';
}

export function useSupabaseConnection() {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const testAndPersist = useCallback(async (input: SupabaseCredentials) => {
    setStatus('testing');
    setErrorMessage('');

    try {
      const credentials = normalizeSupabaseCredentials(input);
      validateSupabaseCredentials(credentials);

      const supabase = createSupabaseClientFromCredentials(credentials, {
        persistSession: false,
        storageKey: `word-jiffy-oobe-test-${Date.now().toString(36)}`,
      });
      await supabase.auth.getSession();

      persistSupabaseCredentials(credentials);
      setStatus('success');
      return true;
    } catch (error: unknown) {
      setStatus('error');
      setErrorMessage(getReadableError(error));
      return false;
    }
  }, []);

  return {
    errorMessage,
    isTesting: status === 'testing',
    status,
    testAndPersist,
  };
}
