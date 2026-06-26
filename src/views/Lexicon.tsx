import { useState, type ChangeEvent } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  BookOpen,
  CalendarClock,
  Filter,
  LoaderCircle,
  Tags,
  Trash2,
} from 'lucide-react';
import {
  allBookTagValue,
  alphabetFilters,
  useLexicon,
  type AlphabetFilter,
  type SortDirection,
  type WordItem,
} from '../hooks/useLexicon';

const surfaceStyle = {
  backgroundColor: 'rgb(var(--m3-surface) / 0.4)',
} satisfies React.CSSProperties;

const strongSurfaceStyle = {
  backgroundColor: 'rgb(var(--m3-surface) / 0.58)',
} satisfies React.CSSProperties;

function getAlphabetLabel(value: AlphabetFilter): string {
  return value === 'all' ? '全部' : value;
}

function formatIntroDate(value: string | null): string {
  if (!value) {
    return '未记录';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '未记录';
  }

  return date.toLocaleDateString('zh-CN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function WordCard({
  isDeleting,
  onDelete,
  word,
}: {
  isDeleting: boolean;
  onDelete: (word: WordItem) => void;
  word: WordItem;
}) {
  return (
    <article
      className="rounded-2xl border border-white/30 p-4 shadow-sm backdrop-blur-md transition-colors dark:border-white/10"
      style={strongSurfaceStyle}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-xl font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
            {word.words}
          </h2>
          {word.phonetic && (
            <p className="mt-1 text-sm text-[#49454f] dark:text-[#cac4d0]">[{word.phonetic}]</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={{
              backgroundColor: 'rgb(var(--m3-primary-container))',
              color: 'rgb(var(--m3-primary))',
            }}
          >
            {word.book_tag?.trim() || '未分类'}
          </span>
          <button
            aria-label={`删除 ${word.words}`}
            className="inline-flex size-8 items-center justify-center rounded-full text-[#ba1a1a] transition-colors hover:bg-[#ffdad6] disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#ffb4ab] dark:hover:bg-[#410002]"
            disabled={isDeleting}
            onClick={() => onDelete(word)}
            title="删除"
            type="button"
          >
            {isDeleting ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" strokeWidth={2} />
            ) : (
              <Trash2 aria-hidden="true" className="size-4" strokeWidth={2} />
            )}
          </button>
        </div>
      </div>

      <p className="min-h-12 text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
        {word.translate}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[#79747e] dark:text-[#938f99]">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 px-3 py-1 dark:border-white/10">
          <CalendarClock aria-hidden="true" className="size-3.5" strokeWidth={2} />
          <span>{formatIntroDate(word.introtime)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 px-3 py-1 dark:border-white/10">
          <Tags aria-hidden="true" className="size-3.5" strokeWidth={2} />
          <span>{word.repetitions ?? 0} 次复习</span>
        </span>
      </div>
    </article>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          className="h-44 animate-pulse rounded-2xl border border-white/30 p-4 backdrop-blur-md dark:border-white/10"
          key={index}
          style={strongSurfaceStyle}
        >
          <div className="h-6 w-32 rounded-full bg-[#e7e0ec] dark:bg-[#49454f]" />
          <div className="mt-4 h-4 w-24 rounded-full bg-[#e7e0ec] dark:bg-[#49454f]" />
          <div className="mt-6 h-4 w-full rounded-full bg-[#e7e0ec] dark:bg-[#49454f]" />
          <div className="mt-3 h-4 w-2/3 rounded-full bg-[#e7e0ec] dark:bg-[#49454f]" />
        </div>
      ))}
    </div>
  );
}

export default function Lexicon() {
  const [alphabetFilter, setAlphabetFilter] = useState<AlphabetFilter>('all');
  const [bookTag, setBookTag] = useState(allBookTagValue);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { bookTags, deletingWordId, deleteWord, errorMessage, filteredCount, loading, totalCount, words } = useLexicon({
    alphabetFilter,
    bookTag,
    sortDirection,
  });

  const handleBookTagChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setBookTag(event.target.value);
  };

  const toggleSortDirection = () => {
    setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
  };

  const handleDeleteWord = (word: WordItem) => {
    const confirmed = window.confirm(`确定删除 ${word.words} 吗？相关复习日志也会被删除。`);

    if (!confirmed) {
      return;
    }

    void deleteWord(word.id);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-[#6750a4] dark:text-[#d0bcff]">词库 Lexicon</p>
        <h1 className="text-3xl font-normal text-[#1d1b20] dark:text-[#e6e0e9]">词库一览</h1>
        <p className="max-w-3xl text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
          通过首字母、单元分类和导入时间快速定位已导入的单词。
        </p>
      </header>

      <section
        className="rounded-[28px] border border-white/30 p-5 shadow-sm backdrop-blur-md dark:border-white/10 sm:p-6"
        style={surfaceStyle}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: 'rgb(var(--m3-primary-container))',
                color: 'rgb(var(--m3-primary))',
              }}
            >
              <BookOpen aria-hidden="true" className="size-5" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-xl font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                当前词库
              </h2>
              <p className="mt-1 text-sm text-[#49454f] dark:text-[#cac4d0]">
                共导入 {totalCount} 个单词，当前筛选命中 {filteredCount} 个。
              </p>
            </div>
          </div>
          {loading && (
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-[#79747e] dark:text-[#938f99]">
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" strokeWidth={2} />
              <span>正在同步</span>
            </div>
          )}
        </div>
      </section>

      <section
        className="space-y-5 rounded-[28px] border border-white/30 p-5 shadow-sm backdrop-blur-md dark:border-white/10 sm:p-6"
        style={surfaceStyle}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{
              backgroundColor: 'rgb(var(--m3-primary-container))',
              color: 'rgb(var(--m3-primary))',
            }}
          >
            <Filter aria-hidden="true" className="size-5" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-lg font-medium text-[#1d1b20] dark:text-[#e6e0e9]">索引控制</h2>
            <p className="text-sm text-[#49454f] dark:text-[#cac4d0]">三种条件会实时联动。</p>
          </div>
        </div>

        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="flex min-w-max gap-2">
            {alphabetFilters.map((letter) => {
              const isActive = alphabetFilter === letter;

              return (
                <button
                  className="h-9 rounded-full border border-white/30 px-4 text-sm font-medium transition-colors hover:bg-[#f3edf7] dark:border-white/10 dark:hover:bg-[#2b2930]"
                  key={letter}
                  onClick={() => setAlphabetFilter(letter)}
                  style={
                    isActive
                      ? {
                          backgroundColor: 'rgb(var(--m3-primary-container))',
                          color: 'rgb(var(--m3-primary))',
                        }
                      : undefined
                  }
                  type="button"
                >
                  {getAlphabetLabel(letter)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="block">
            <span className="mb-1 block text-xs text-[#49454f] dark:text-[#cac4d0]">单元分类</span>
            <div className="relative flex h-12 items-center rounded-[16px] border border-[#79747e] bg-transparent px-4 transition-colors focus-within:border-[#6750a4] focus-within:ring-2 focus-within:ring-[#6750a4] dark:border-[#938f99]">
              <Tags aria-hidden="true" className="mr-3 size-4 shrink-0 text-[#6750a4] dark:text-[#d0bcff]" strokeWidth={2} />
              <select
                className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#1d1b20] outline-none dark:text-[#e6e0e9]"
                onChange={handleBookTagChange}
                value={bookTag}
              >
                <option value={allBookTagValue}>所有单元</option>
                {bookTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <button
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium shadow-sm transition-colors"
            onClick={toggleSortDirection}
            style={{
              backgroundColor: 'rgb(var(--m3-primary-container))',
              color: 'rgb(var(--m3-primary))',
            }}
            type="button"
          >
            <ArrowUpDown aria-hidden="true" className="size-4" strokeWidth={2} />
            <span>{sortDirection === 'asc' ? '最早导入优先' : '最近导入优先'}</span>
          </button>
        </div>
      </section>

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-[16px] border border-[#ba1a1a] bg-[#ffdad6] p-4 text-sm leading-6 text-[#410002] dark:border-[#ffb4ab] dark:bg-[#93000a] dark:text-[#ffdad6]">
          <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
          <span>{errorMessage}</span>
        </div>
      )}

      <section
        className="rounded-[28px] border border-white/30 p-5 shadow-sm backdrop-blur-md dark:border-white/10 sm:p-6"
        style={surfaceStyle}
      >
        {loading ? (
          <SkeletonGrid />
        ) : words.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {words.map((word) => (
              <WordCard
                isDeleting={deletingWordId === word.id}
                key={word.id}
                onDelete={handleDeleteWord}
                word={word}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
            <div
              className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
              style={{
                backgroundColor: 'rgb(var(--m3-primary-container))',
                color: 'rgb(var(--m3-primary))',
              }}
            >
              <AlertCircle aria-hidden="true" className="size-6" strokeWidth={2} />
            </div>
            <h2 className="text-xl font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
              暂无匹配词汇
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
              请调整首字母、单元分类或排序条件后再查看。
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
