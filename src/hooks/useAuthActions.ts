import { useCallback, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';

type AuthActionStatus = 'idle' | 'submitting' | 'success' | 'error';

type AuthErrorShape = {
  code?: unknown;
  message?: unknown;
  name?: unknown;
  status?: unknown;
};

function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase();
}

function getAuthErrorShape(error: unknown): AuthErrorShape {
  if (typeof error !== 'object' || error === null) {
    return {};
  }

  return error as AuthErrorShape;
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  const { message } = getAuthErrorShape(error);
  return typeof message === 'string' ? message : '';
}

function readErrorStatus(error: unknown): number | null {
  const { status } = getAuthErrorShape(error);
  return typeof status === 'number' ? status : null;
}

function readErrorCode(error: unknown): string {
  const { code } = getAuthErrorShape(error);
  return typeof code === 'string' ? code : '';
}

function getErrorMessage(error: unknown): string {
  const message = readErrorMessage(error).trim();
  const status = readErrorStatus(error);
  const code = readErrorCode(error);
  const normalizedMessage = message.toLocaleLowerCase();

  if (status !== null && status >= 500) {
    return 'Supabase Auth 服务返回 500。前端注册请求已移除 redirect_to，请检查后端 Auth 是否开启邮箱注册，以及邮件确认或 SMTP 配置是否可用。';
  }

  if (message === '{}' || normalizedMessage === '[object object]') {
    return 'Supabase Auth 返回了空错误对象。请检查后端 Auth 配置，常见原因是注册功能未开启或邮件确认配置不可用。';
  }

  if (message === 'Invalid login credentials' || code === 'invalid_credentials') {
    return '邮箱或密码不正确。若刚刚注册，请确认注册已经成功完成。';
  }

  if (normalizedMessage.includes('email not confirmed') || code === 'email_not_confirmed') {
    return '邮箱尚未确认。请先完成邮箱确认后再登录，或在 Supabase Auth 中关闭邮箱确认。';
  }

  if (
    normalizedMessage.includes('signups not allowed') ||
    normalizedMessage.includes('signup') ||
    code === 'signup_disabled'
  ) {
    return '当前 Supabase Auth 不允许邮箱注册，请在 Auth 配置中开启邮箱注册。';
  }

  if (normalizedMessage.includes('user already registered') || code === 'user_already_exists') {
    return '该邮箱已经注册，请切换到登录。';
  }

  if (message) {
    return message;
  }

  return '身份操作失败，请稍后重试。';
}

function validateCredentials(email: string, password: string): void {
  if (!email.trim() || !password) {
    throw new Error('请填写邮箱和密码。');
  }

  if (password.length < 6) {
    throw new Error('密码长度至少为 6 位。');
  }
}

export function useAuthActions() {
  const [status, setStatus] = useState<AuthActionStatus>('idle');
  const [message, setMessage] = useState('');

  const signIn = useCallback(async (email: string, password: string) => {
    setStatus('submitting');
    setMessage('');

    try {
      validateCredentials(email, password);

      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('尚未配置数据库连接。');
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: normalizeEmail(email),
        password,
      });

      if (error) {
        throw error;
      }

      setStatus('success');
      setMessage('登录成功。');
      return true;
    } catch (error: unknown) {
      setStatus('error');
      setMessage(getErrorMessage(error));
      return false;
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setStatus('submitting');
    setMessage('');

    try {
      validateCredentials(email, password);

      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('尚未配置数据库连接。');
      }

      const normalizedEmail = normalizeEmail(email);
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });

      if (error) {
        throw error;
      }

      if (!data.user && !data.session) {
        throw new Error('注册请求没有创建账号，请检查 Supabase Auth 是否允许邮箱注册。');
      }

      const identities = data.user?.identities ?? [];
      if (data.user && identities.length === 0) {
        throw new Error('该邮箱可能已经注册。请切换到登录，或使用其他邮箱注册。');
      }

      if (data.session) {
        setStatus('success');
        setMessage('注册成功，已自动登录。');
        return true;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (!signInError) {
        setStatus('success');
        setMessage('注册成功，已自动登录。');
        return true;
      }

      setStatus('success');
      setMessage('注册成功，但当前 Supabase Auth 要求邮箱确认。请确认邮箱后再登录。');
      return false;
    } catch (error: unknown) {
      setStatus('error');
      setMessage(getErrorMessage(error));
      return false;
    }
  }, []);

  const signOut = useCallback(async () => {
    setStatus('submitting');
    setMessage('');

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('尚未配置数据库连接。');
      }

      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }

      setStatus('success');
      setMessage('已退出登录。');
      return true;
    } catch (error: unknown) {
      setStatus('error');
      setMessage(getErrorMessage(error));
      return false;
    }
  }, []);

  return {
    isSubmitting: status === 'submitting',
    message,
    signIn,
    signOut,
    signUp,
    status,
  };
}
