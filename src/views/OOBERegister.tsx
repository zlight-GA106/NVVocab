import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  Mail,
  ShieldCheck,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAuthActions } from '../hooks/useAuthActions';
import { getSupabaseClient } from '../lib/supabase';

type OutlinedFieldProps = {
  children: ReactNode;
  icon: LucideIcon;
  label: string;
};

function OutlinedField({ children, icon: Icon, label }: OutlinedFieldProps) {
  return (
    <label className="block">
      <div className="relative min-h-16 rounded-[16px] border border-[#79747e] bg-transparent px-4 py-2 text-[#49454f] transition-colors focus-within:border-[#6750a4] focus-within:ring-2 focus-within:ring-[#6750a4] dark:border-[#938f99] dark:text-[#cac4d0]">
        <span className="absolute -top-2 left-4 bg-[#fef7ff] px-1 text-xs leading-4 dark:bg-[#211f26]">
          {label}
        </span>
        <div className="flex h-12 items-center gap-3">
          <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={2} />
          {children}
        </div>
      </div>
    </label>
  );
}

export default function OOBERegister() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const { isSubmitting, message, signUp, status } = useAuthActions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const hasClient = getSupabaseClient() !== null;

  useEffect(() => {
    if (!hasClient) {
      navigate('/oobe', { replace: true });
      return;
    }

    if (!loading && isAuthenticated) {
      navigate('/import?setup=1', { replace: true });
    }
  }, [hasClient, isAuthenticated, loading, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const registered = await signUp(email, password);
    if (registered) {
      navigate('/import?setup=1', { replace: true });
    }
  };

  return (
    <main className="route-transition-page min-h-screen bg-[#fffbff] px-4 py-6 text-[#1d1b20] dark:bg-[#141218] dark:text-[#e6e0e9] sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center">
        <section className="grid w-full grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,460px)] lg:items-center">
          <div className="space-y-6 py-4">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-[28px] bg-[#eaddff] text-[#21005d] dark:bg-[#4f378b] dark:text-[#eaddff]">
              <ShieldCheck aria-hidden="true" className="size-7" strokeWidth={2} />
            </div>
            <div className="max-w-2xl space-y-4">
              <p className="text-sm font-medium text-[#6750a4] dark:text-[#d0bcff]">
                第一步
              </p>
              <h1 className="text-4xl font-normal leading-tight sm:text-5xl">
                创建管理员账号
              </h1>
              <p className="max-w-xl text-base leading-7 text-[#49454f] dark:text-[#cac4d0]">
                登入你的单词速记，请妥善保管您的超管账号。
              </p>
            </div>
          </div>

          <form
            className="rounded-[28px] border border-[#cac4d0] bg-[#fef7ff] p-5 shadow-sm dark:border-[#49454f] dark:bg-[#211f26] sm:p-6"
            onSubmit={handleSubmit}
          >
            <div className="mb-6 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8def8] text-[#4f378b] dark:bg-[#4f378b] dark:text-[#eaddff]">
                <Database aria-hidden="true" className="size-5" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-xl font-medium leading-7">账号初始化</h2>
                <p className="mt-1 text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
                  使用 Supabase Auth 创建首个可写入数据的账号。
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <OutlinedField icon={Mail} label="邮箱">
                <input
                  autoComplete="email"
                  className="h-full min-w-0 flex-1 bg-transparent text-base text-[#1d1b20] outline-none placeholder:text-[#79747e] disabled:cursor-not-allowed disabled:opacity-60 dark:text-[#e6e0e9] dark:placeholder:text-[#938f99]"
                  disabled={isSubmitting}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  type="email"
                  value={email}
                />
              </OutlinedField>

              <OutlinedField icon={LockKeyhole} label="密码">
                <input
                  autoComplete="new-password"
                  className="h-full min-w-0 flex-1 bg-transparent text-base text-[#1d1b20] outline-none placeholder:text-[#79747e] disabled:cursor-not-allowed disabled:opacity-60 dark:text-[#e6e0e9] dark:placeholder:text-[#938f99]"
                  disabled={isSubmitting}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="至少 6 位"
                  type="password"
                  value={password}
                />
              </OutlinedField>
            </div>

            {message && (
              <div
                className={`mt-5 flex items-start gap-3 rounded-[16px] border p-4 text-sm leading-6 ${
                  status === 'success'
                    ? 'border-[#146c2e] bg-[#dff7df] text-[#0b3d1a] dark:border-[#7ddc82] dark:bg-[#14361d] dark:text-[#b8f5b9]'
                    : 'border-[#ba1a1a] bg-[#ffdad6] text-[#410002] dark:border-[#ffb4ab] dark:bg-[#93000a] dark:text-[#ffdad6]'
                }`}
              >
                {status === 'success' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
                ) : (
                  <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
                )}
                <span>{message}</span>
              </div>
            )}

            <button
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#6750a4] px-6 text-sm font-medium text-white transition-colors hover:bg-[#5b4398] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6750a4] disabled:cursor-not-allowed disabled:bg-[#1d1b20]/12 disabled:text-[#1d1b20]/40 dark:bg-[#d0bcff] dark:text-[#381e72] dark:hover:bg-[#eaddff] dark:disabled:bg-[#e6e0e9]/12 dark:disabled:text-[#e6e0e9]/40"
              disabled={isSubmitting || loading}
              type="submit"
            >
              {isSubmitting ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" strokeWidth={2} />
              ) : (
                <UserPlus aria-hidden="true" className="size-4" strokeWidth={2} />
              )}
              <span>{isSubmitting ? '正在创建账号' : '创建并登录'}</span>
            </button>

            <button
              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[#79747e] px-6 text-sm font-medium text-[#6750a4] transition-colors hover:bg-[#f3edf7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6750a4] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#938f99] dark:text-[#d0bcff] dark:hover:bg-[#2b2930]"
              disabled={isSubmitting}
              onClick={() => navigate('/auth')}
              type="button"
            >
              <LogIn aria-hidden="true" className="size-4" strokeWidth={2} />
              <span>已有账号，去登录</span>
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
