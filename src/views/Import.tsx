import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileText,
  RefreshCw,
  Tags,
  UploadCloud,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useParsedWords, useWordImporter } from '../hooks/useWordImport';

type OutlinedFieldProps = {
  children: ReactNode;
  error?: boolean;
  icon: LucideIcon;
  label: string;
};

function OutlinedField({ children, error = false, icon: Icon, label }: OutlinedFieldProps) {
  const outlineClass = error
    ? 'border-[#ba1a1a] text-[#ba1a1a] focus-within:ring-[#ba1a1a]'
    : 'border-[#79747e] text-[#49454f] focus-within:border-[#6750a4] focus-within:ring-[#6750a4] dark:border-[#938f99] dark:text-[#cac4d0]';

  return (
    <label className="block">
      <div
        className={`relative rounded-[16px] border bg-transparent px-4 py-2 transition-colors focus-within:ring-2 ${outlineClass}`}
      >
        <span className="absolute -top-2 left-4 bg-[#fef7ff] px-1 text-xs leading-4 dark:bg-[#211f26]">
          {label}
        </span>
        <div className="flex gap-3">
          <Icon aria-hidden="true" className="mt-3 size-5 shrink-0" strokeWidth={2} />
          {children}
        </div>
      </div>
    </label>
  );
}

export default function Import() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [bookTag, setBookTag] = useState('');
  const [rawText, setRawText] = useState('');
  const parsedWords = useParsedWords(rawText);
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const { importWords, isSubmitting, message, status } = useWordImporter();
  const hasError = status === 'error';
  const hasSuccess = status === 'success';
  const canSubmit = parsedWords.length > 0 && !isSubmitting && !authLoading && isAuthenticated;
  const isSetupFlow = searchParams.get('setup') === '1';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const imported = await importWords({ bookTag, parsedWords });
    if (imported) {
      setRawText('');
      if (isSetupFlow) {
        navigate('/', { replace: true });
      }
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="mb-2 text-2xl font-normal text-[#1d1b20] dark:text-[#e6e0e9]">
          词库自增导入
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
          按章节粘贴教辅书文本，系统会实时拆分单词、音标与释义。
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
        <form
          className="rounded-[28px] border border-[#cac4d0] bg-[#fef7ff] p-5 shadow-sm dark:border-[#49454f] dark:bg-[#211f26] sm:p-6"
          onSubmit={handleSubmit}
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8def8] text-[#4f378b] dark:bg-[#4f378b] dark:text-[#eaddff]">
              <FileText aria-hidden="true" className="size-5" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-base font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                文本录入区
              </h2>
              <p className="text-xs leading-5 text-[#79747e] dark:text-[#938f99]">
                {user?.email ? `当前账号：${user.email}` : '仅已登录用户可导入词库'}
              </p>
            </div>
          </div>

          {!authLoading && !isAuthenticated && (
            <div className="mb-5 flex items-start gap-3 rounded-[16px] border border-[#ba1a1a] bg-[#ffdad6] p-4 text-sm leading-6 text-[#410002] dark:border-[#ffb4ab] dark:bg-[#93000a] dark:text-[#ffdad6]">
              <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
              <span>请先登录账号，再录入自己的词库。当前 RLS 策略要求 user_id 与 auth.uid() 一致。</span>
            </div>
          )}

          <div className="space-y-5">
            <OutlinedField icon={Tags} label="章节或书籍标识 book_tag">
              <input
                className="h-12 min-w-0 flex-1 bg-transparent text-base text-[#1d1b20] outline-none placeholder:text-[#79747e] dark:text-[#e6e0e9] dark:placeholder:text-[#938f99]"
                disabled={isSubmitting}
                onChange={(event) => setBookTag(event.target.value)}
                placeholder="Unit 1 核心词"
                spellCheck={false}
                type="text"
                value={bookTag}
              />
            </OutlinedField>

            <OutlinedField error={hasError} icon={FileText} label="批量文本">
              <textarea
                className="min-h-[320px] w-full resize-y bg-transparent py-3 text-sm leading-6 text-[#1d1b20] outline-none placeholder:text-[#79747e] disabled:cursor-not-allowed disabled:opacity-60 dark:text-[#e6e0e9] dark:placeholder:text-[#938f99] sm:min-h-[420px]"
                disabled={isSubmitting}
                onChange={(event) => setRawText(event.target.value)}
                placeholder={'abandon [əˈbændən] vt. 放弃\nability n. 能力'}
                spellCheck={false}
                value={rawText}
              />
            </OutlinedField>
          </div>

          {message && (
            <div
              className={`mt-5 flex items-start gap-3 rounded-[16px] border p-4 text-sm leading-6 ${
                hasSuccess
                  ? 'border-[#146c2e] bg-[#dff7df] text-[#0b3d1a] dark:border-[#7ddc82] dark:bg-[#14361d] dark:text-[#b8f5b9]'
                  : 'border-[#ba1a1a] bg-[#ffdad6] text-[#410002] dark:border-[#ffb4ab] dark:bg-[#93000a] dark:text-[#ffdad6]'
              }`}
            >
              {hasSuccess ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
              ) : (
                <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
              )}
              <span>{message}</span>
            </div>
          )}

          <button
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#6750a4] px-6 text-sm font-medium text-white transition-colors hover:bg-[#5b4398] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6750a4] disabled:cursor-not-allowed disabled:bg-[#1d1b20]/12 disabled:text-[#1d1b20]/40 dark:bg-[#d0bcff] dark:text-[#381e72] dark:hover:bg-[#eaddff] dark:disabled:bg-[#e6e0e9]/12 dark:disabled:text-[#e6e0e9]/40"
            disabled={!canSubmit}
            type="submit"
          >
            {isSubmitting ? (
              <RefreshCw aria-hidden="true" className="size-4 animate-spin" strokeWidth={2} />
            ) : (
              <UploadCloud aria-hidden="true" className="size-4" strokeWidth={2} />
            )}
            <span>
              {isSubmitting
                ? '正在导入'
                : authLoading
                  ? '正在检查登录状态'
                  : `执行导入 (${parsedWords.length} 词)`}
            </span>
          </button>
        </form>

        <section className="flex max-h-[720px] min-h-[420px] flex-col rounded-[28px] border border-[#cac4d0] bg-[#fef7ff] p-5 shadow-sm dark:border-[#49454f] dark:bg-[#211f26] sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8def8] text-[#4f378b] dark:bg-[#4f378b] dark:text-[#eaddff]">
                <Eye aria-hidden="true" className="size-5" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-base font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                  实时解析预览区
                </h2>
                <p className="text-xs leading-5 text-[#79747e] dark:text-[#938f99]">
                  拼写、音标、释义
                </p>
              </div>
            </div>
            <span className="rounded-full bg-[#e8def8] px-3 py-1 text-xs font-medium text-[#4f378b] dark:bg-[#4f378b] dark:text-[#eaddff]">
              {parsedWords.length}
            </span>
          </div>

          {parsedWords.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-[20px] border border-dashed border-[#cac4d0] p-8 text-center text-sm leading-6 text-[#79747e] dark:border-[#49454f] dark:text-[#938f99]">
              暂无待解析文本
            </div>
          ) : (
            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {parsedWords.map((word, index) => (
                <article
                  className="rounded-[20px] border border-[#e7e0ec] bg-[#fffbff] p-4 dark:border-[#49454f] dark:bg-[#141218]"
                  key={`${word.words}-${index}`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                        {word.words}
                      </h3>
                      {word.phonetic && (
                        <p className="mt-1 text-xs leading-5 text-[#6750a4] dark:text-[#d0bcff]">
                          [{word.phonetic}]
                        </p>
                      )}
                    </div>
                    <p className="text-sm leading-6 text-[#49454f] dark:text-[#cac4d0] sm:max-w-[58%] sm:text-right">
                      {word.translate}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
