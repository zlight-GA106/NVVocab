import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  UserPlus,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAuthActions } from '../hooks/useAuthActions';

type AuthMode = 'signIn' | 'signUp';

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

export default function Auth() {
  const navigate = useNavigate();
  const { isAuthenticated, loading, user } = useAuth();
  const { isSubmitting, message, signIn, signOut, signUp, status } = useAuthActions();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const authenticated =
      mode === 'signIn' ? await signIn(email, password) : await signUp(email, password);

    if (authenticated) {
      navigate('/import', { replace: true });
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-4xl items-center">
      <section className="grid w-full grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,440px)] lg:items-center">
        <div className="space-y-5">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-[28px] bg-[#e8def8] text-[#4f378b] dark:bg-[#4f378b] dark:text-[#eaddff]">
            <UserRound aria-hidden="true" className="size-7" strokeWidth={2} />
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium text-[#6750a4] dark:text-[#d0bcff]">
              身份管理
            </p>
            <h1 className="text-3xl font-normal text-[#1d1b20] dark:text-[#e6e0e9]">
              登录后同步你的词库和复习记录
            </h1>
            <p className="max-w-xl text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
              导入词库和默写回写都绑定当前账号，数据库策略会校验 user_id 与 auth.uid() 一致。
            </p>
          </div>
        </div>

        <div className="rounded-[28px] border border-[#cac4d0] bg-[#fef7ff] p-5 shadow-sm dark:border-[#49454f] dark:bg-[#211f26] sm:p-6">
          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center text-sm text-[#49454f] dark:text-[#cac4d0]">
              <LoaderCircle aria-hidden="true" className="mr-3 size-5 animate-spin" strokeWidth={2} />
              <span>正在检查登录状态</span>
            </div>
          ) : isAuthenticated ? (
            <div className="space-y-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8def8] text-[#4f378b] dark:bg-[#4f378b] dark:text-[#eaddff]">
                  <CheckCircle2 aria-hidden="true" className="size-5" strokeWidth={2} />
                </div>
                <div>
                  <h2 className="text-xl font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                    已登录
                  </h2>
                  <p className="mt-1 break-all text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
                    {user?.email ?? user?.id}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  className="flex h-12 items-center justify-center rounded-full bg-[#6750a4] px-5 text-sm font-medium text-white transition-colors hover:bg-[#5b4398] dark:bg-[#d0bcff] dark:text-[#381e72] dark:hover:bg-[#eaddff]"
                  onClick={() => navigate('/import')}
                  type="button"
                >
                  进入导入页
                </button>
                <button
                  className="flex h-12 items-center justify-center gap-2 rounded-full border border-[#79747e] px-5 text-sm font-medium text-[#6750a4] transition-colors hover:bg-[#f3edf7] dark:border-[#938f99] dark:text-[#d0bcff] dark:hover:bg-[#2b2930]"
                  disabled={isSubmitting}
                  onClick={handleSignOut}
                  type="button"
                >
                  <LogOut aria-hidden="true" className="size-4" strokeWidth={2} />
                  <span>{isSubmitting ? '正在退出' : '退出登录'}</span>
                </button>
              </div>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="flex rounded-full bg-[#e8def8] p-1 dark:bg-[#4a4458]">
                <button
                  className={`h-10 flex-1 rounded-full text-sm font-medium transition-colors ${
                    mode === 'signIn'
                      ? 'bg-[#fef7ff] text-[#4f378b] shadow-sm dark:bg-[#211f26] dark:text-[#eaddff]'
                      : 'text-[#49454f] dark:text-[#cac4d0]'
                  }`}
                  onClick={() => setMode('signIn')}
                  type="button"
                >
                  登录
                </button>
                <button
                  className={`h-10 flex-1 rounded-full text-sm font-medium transition-colors ${
                    mode === 'signUp'
                      ? 'bg-[#fef7ff] text-[#4f378b] shadow-sm dark:bg-[#211f26] dark:text-[#eaddff]'
                      : 'text-[#49454f] dark:text-[#cac4d0]'
                  }`}
                  onClick={() => setMode('signUp')}
                  type="button"
                >
                  注册
                </button>
              </div>

              <OutlinedField icon={Mail} label="邮箱">
                <input
                  autoComplete="email"
                  className="h-full min-w-0 flex-1 bg-transparent text-base text-[#1d1b20] outline-none placeholder:text-[#79747e] dark:text-[#e6e0e9] dark:placeholder:text-[#938f99]"
                  disabled={isSubmitting}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  type="email"
                  value={email}
                />
              </OutlinedField>

              <OutlinedField icon={LockKeyhole} label="密码">
                <input
                  autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                  className="h-full min-w-0 flex-1 bg-transparent text-base text-[#1d1b20] outline-none placeholder:text-[#79747e] dark:text-[#e6e0e9] dark:placeholder:text-[#938f99]"
                  disabled={isSubmitting}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="至少 6 位"
                  type="password"
                  value={password}
                />
              </OutlinedField>

              {message && (
                <div
                  className={`flex items-start gap-3 rounded-[16px] border p-4 text-sm leading-6 ${
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
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#6750a4] px-6 text-sm font-medium text-white transition-colors hover:bg-[#5b4398] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6750a4] disabled:cursor-not-allowed disabled:bg-[#1d1b20]/12 disabled:text-[#1d1b20]/40 dark:bg-[#d0bcff] dark:text-[#381e72] dark:hover:bg-[#eaddff] dark:disabled:bg-[#e6e0e9]/12 dark:disabled:text-[#e6e0e9]/40"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? (
                  <LoaderCircle aria-hidden="true" className="size-4 animate-spin" strokeWidth={2} />
                ) : mode === 'signIn' ? (
                  <LogIn aria-hidden="true" className="size-4" strokeWidth={2} />
                ) : (
                  <UserPlus aria-hidden="true" className="size-4" strokeWidth={2} />
                )}
                <span>{isSubmitting ? '正在处理' : mode === 'signIn' ? '登录' : '注册'}</span>
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
