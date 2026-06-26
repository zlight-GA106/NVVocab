import { useState, type ClipboardEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ClipboardPaste,
  Database,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { useSupabaseConnection } from '../hooks/useSupabaseConnection';
import {
  SUPABASE_KEY_STORAGE_KEY,
  SUPABASE_URL_STORAGE_KEY,
  readSupabaseCredentials,
} from '../lib/supabase';

type OutlinedFieldProps = {
  autoComplete?: string;
  disabled: boolean;
  error: boolean;
  id: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: 'text' | 'password' | 'url';
  value: string;
  icon: LucideIcon;
};

function OutlinedField({
  autoComplete,
  disabled,
  error,
  id,
  label,
  name,
  onChange,
  placeholder,
  type = 'text',
  value,
  icon: Icon,
}: OutlinedFieldProps) {
  const outlineClass = error
    ? 'border-[#ba1a1a] text-[#ba1a1a] focus-within:ring-[#ba1a1a]'
    : 'border-[#79747e] text-[#49454f] focus-within:border-[#6750a4] focus-within:ring-[#6750a4] dark:border-[#938f99] dark:text-[#cac4d0]';

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pastedText = event.clipboardData.getData('text');

    if (!pastedText) {
      return;
    }

    event.preventDefault();

    const input = event.currentTarget;
    const selectionStart = input.selectionStart ?? value.length;
    const selectionEnd = input.selectionEnd ?? value.length;
    const nextValue = `${value.slice(0, selectionStart)}${pastedText}${value.slice(selectionEnd)}`;
    const nextCursorPosition = selectionStart + pastedText.length;

    onChange(nextValue);

    window.requestAnimationFrame(() => {
      try {
        input.setSelectionRange(nextCursorPosition, nextCursorPosition);
      } catch {
        input.blur();
        input.focus();
      }
    });
  };

  const handlePasteButtonClick = async () => {
    if (!navigator.clipboard) {
      return;
    }

    try {
      const pastedText = await navigator.clipboard.readText();
      if (pastedText) {
        onChange(pastedText.trim());
      }
    } catch {
      document.getElementById(id)?.focus();
    }
  };

  return (
    <div>
      <div
        className={`relative min-h-16 rounded-[16px] border bg-transparent px-4 py-2 transition-colors focus-within:ring-2 ${outlineClass}`}
      >
        <label
          className="absolute -top-2 left-4 cursor-text bg-[#fffbff] px-1 text-xs leading-4 dark:bg-[#141218]"
          htmlFor={id}
        >
          {label}
        </label>
        <div className="flex h-12 items-center gap-3">
          <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={2} />
          <input
            autoCapitalize="none"
            autoComplete={autoComplete}
            className="h-full min-w-0 flex-1 bg-transparent text-base text-[#1d1b20] outline-none placeholder:text-[#79747e] disabled:cursor-not-allowed disabled:opacity-60 dark:text-[#e6e0e9] dark:placeholder:text-[#938f99]"
            disabled={disabled}
            id={id}
            name={name}
            onChange={(event) => onChange(event.target.value)}
            onPaste={handlePaste}
            placeholder={placeholder}
            spellCheck={false}
            type={type}
            value={value}
          />
          <button
            aria-label={`粘贴 ${label}`}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-[#49454f] transition-colors hover:bg-[#f3edf7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6750a4] disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#cac4d0] dark:hover:bg-[#2b2930]"
            disabled={disabled}
            onClick={handlePasteButtonClick}
            title="粘贴"
            type="button"
          >
            <ClipboardPaste aria-hidden="true" className="size-5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OOBE() {
  const navigate = useNavigate();
  const existingCredentials = readSupabaseCredentials();
  const [url, setUrl] = useState(existingCredentials?.url ?? '');
  const [key, setKey] = useState(existingCredentials?.key ?? '');
  const { errorMessage, isTesting, status, testAndPersist } = useSupabaseConnection();
  const hasError = status === 'error';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const connected = await testAndPersist({ url, key });
    if (connected) {
      navigate('/oobe/register', { replace: true });
    }
  };

  return (
    <main className="min-h-screen bg-[#fffbff] px-4 py-6 text-[#1d1b20] dark:bg-[#141218] dark:text-[#e6e0e9] sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center">
        <section className="grid w-full grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,480px)] lg:items-center">
          <div className="space-y-6 py-4">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-[28px] bg-[#eaddff] text-[#21005d] dark:bg-[#4f378b] dark:text-[#eaddff]">
              <Database aria-hidden="true" className="size-7" strokeWidth={2} />
            </div>
            <div className="max-w-2xl space-y-4">
              <p className="text-sm font-medium text-[#6750a4] dark:text-[#d0bcff]">
                单词速记首航引导
              </p>
              <h1 className="text-4xl font-normal leading-tight sm:text-5xl">
                连接你自己的 Supabase 数据库
              </h1>
              <p className="max-w-xl text-base leading-7 text-[#49454f] dark:text-[#cac4d0]">
                本应用采用 BYOB 模式，凭证仅保存在当前设备的浏览器本地存储中。连接测试会读取一次 wordbase 表，成功后进入学习工作区。
              </p>
            </div>
          </div>

          <form
            className="rounded-[28px] border border-[#cac4d0] bg-[#fef7ff] p-5 shadow-sm dark:border-[#49454f] dark:bg-[#211f26] sm:p-6"
            onSubmit={handleSubmit}
          >
            <div className="mb-6 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8def8] text-[#4f378b] dark:bg-[#4f378b] dark:text-[#eaddff]">
                <ShieldCheck aria-hidden="true" className="size-5" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-xl font-medium leading-7">数据库凭证</h2>
                <p className="mt-1 text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
                  使用 Supabase Project URL 与 anon public key。
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <OutlinedField
                autoComplete="url"
                disabled={isTesting}
                error={hasError}
                icon={Database}
                id="supabase-url"
                label={SUPABASE_URL_STORAGE_KEY}
                name="supabaseUrl"
                onChange={setUrl}
                placeholder="https://project-ref.supabase.co"
                type="url"
                value={url}
              />
              <OutlinedField
                autoComplete="off"
                disabled={isTesting}
                error={hasError}
                icon={KeyRound}
                id="supabase-key"
                label={SUPABASE_KEY_STORAGE_KEY}
                name="supabaseKey"
                onChange={setKey}
                placeholder="粘贴 anon public key"
                type="password"
                value={key}
              />
            </div>

            {hasError && (
              <div className="mt-5 flex items-start gap-3 rounded-[16px] border border-[#ba1a1a] bg-[#ffdad6] p-4 text-sm leading-6 text-[#410002] dark:bg-[#93000a] dark:text-[#ffdad6]">
                <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#6750a4] px-6 text-sm font-medium text-white transition-colors hover:bg-[#5b4398] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6750a4] disabled:cursor-not-allowed disabled:bg-[#1d1b20]/12 disabled:text-[#1d1b20]/40 dark:bg-[#d0bcff] dark:text-[#381e72] dark:hover:bg-[#eaddff] dark:disabled:bg-[#e6e0e9]/12 dark:disabled:text-[#e6e0e9]/40"
              disabled={isTesting}
              type="submit"
            >
              {isTesting && (
                <RefreshCw aria-hidden="true" className="size-4 animate-spin" strokeWidth={2} />
              )}
              <span>{isTesting ? '正在测试连接' : '测试并连接'}</span>
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
