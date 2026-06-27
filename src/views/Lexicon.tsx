import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  BookOpen,
  CalendarClock,
  Check,
  Filter,
  Gauge,
  ListOrdered,
  LoaderCircle,
  Printer,
  Tags,
  Trash2,
  Volume2,
} from 'lucide-react';
import M3Dialog from '../components/M3Dialog';
import M3Select, { type M3SelectOption } from '../components/M3Select';
import { usePrintQueue } from '../hooks/usePrintQueue';
import {
  allBookTagValue,
  alphabetFilters,
  useLexicon,
  type AlphabetFilter,
  type LexiconSortMode,
  type WordItem,
} from '../hooks/useLexicon';
import {
  compareByAdaptiveProficiency,
  getWordProficiency,
  type ProficiencyBand,
} from '../utils/proficiencyRating';

const surfaceStyle = {
  backgroundColor: 'rgb(var(--m3-surface) / 0.4)',
} satisfies React.CSSProperties;

const strongSurfaceStyle = {
  backgroundColor: 'rgb(var(--m3-surface) / 0.58)',
} satisfies React.CSSProperties;

const deleteAnimationDurationMs = 260;
const listTransitionDurationMs = 150;

const sortModeOptions: M3SelectOption[] = [
  { label: '最近导入优先', value: 'introtimeDesc' },
  { label: '最早导入优先', value: 'introtimeAsc' },
  { label: '熟练度低优先', value: 'proficiencyAsc' },
  { label: '熟练度高优先', value: 'proficiencyDesc' },
];

function getAlphabetLabel(value: AlphabetFilter): string {
  return value === 'all' ? '全部' : value;
}

function isLexiconSortMode(value: string): value is LexiconSortMode {
  return value === 'introtimeAsc' || value === 'introtimeDesc' || value === 'proficiencyAsc' || value === 'proficiencyDesc';
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

function getProficiencyBadgeStyle(band: ProficiencyBand): React.CSSProperties {
  if (band === 'fragile') {
    return {
      backgroundColor: 'rgb(var(--m3-error-container, 255 218 214))',
      color: 'rgb(var(--m3-error, 186 26 26))',
    };
  }

  return {
    backgroundColor: 'rgb(var(--m3-primary-container))',
    color: 'rgb(var(--m3-primary))',
  };
}

function getProficiencyBarStyle(band: ProficiencyBand): React.CSSProperties {
  return {
    backgroundColor: band === 'fragile' ? 'rgb(var(--m3-error, 186 26 26))' : 'rgb(var(--m3-primary))',
  };
}

function WordCard({
  index,
  isDeleting,
  isQueued,
  onDelete,
  onSpeak,
  onTogglePrintQueue,
  word,
}: {
  index: number;
  isDeleting: boolean;
  isQueued: boolean;
  onDelete: (word: WordItem) => void;
  onSpeak: (word: WordItem) => void;
  onTogglePrintQueue: (word: WordItem) => void;
  word: WordItem;
}) {
  const proficiency = getWordProficiency(word);

  return (
    <article
      className={`rounded-2xl border border-white/30 p-4 shadow-sm backdrop-blur-md transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] dark:border-white/10 ${
        isDeleting ? 'pointer-events-none -translate-y-2 scale-[0.98] opacity-0 blur-[1px]' : 'translate-y-0 scale-100 opacity-100'
      }`}
      style={{
        ...strongSurfaceStyle,
        transitionDelay: isDeleting ? '0ms' : `${Math.min(index * 18, 126)}ms`,
      }}
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
          <button
            aria-label={`播放 ${word.words}`}
            className="inline-flex size-8 items-center justify-center rounded-full transition-colors hover:bg-[#f3edf7] dark:hover:bg-[#2b2930]"
            onClick={() => onSpeak(word)}
            style={{ color: 'rgb(var(--m3-primary))' }}
            title="播放发音"
            type="button"
          >
            <Volume2 aria-hidden="true" className="size-4" strokeWidth={2} />
          </button>
          <button
            aria-label={isQueued ? `从打印候选移除 ${word.words}` : `加入打印候选 ${word.words}`}
            className="inline-flex size-8 items-center justify-center rounded-full transition-colors hover:bg-[#f3edf7] dark:hover:bg-[#2b2930]"
            onClick={() => onTogglePrintQueue(word)}
            style={
              isQueued
                ? {
                    backgroundColor: 'rgb(var(--m3-primary-container))',
                    color: 'rgb(var(--m3-primary))',
                  }
                : {
                    color: 'rgb(var(--m3-primary))',
                  }
            }
            title={isQueued ? '已加入打印候选' : '加入打印候选'}
            type="button"
          >
            {isQueued ? (
              <Check aria-hidden="true" className="size-4" strokeWidth={2.4} />
            ) : (
              <Printer aria-hidden="true" className="size-4" strokeWidth={2} />
            )}
          </button>
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

      <div className="mt-4 rounded-[18px] border border-white/30 p-3 dark:border-white/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Gauge aria-hidden="true" className="size-4 shrink-0 text-[#79747e] dark:text-[#938f99]" strokeWidth={2} />
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#1d1b20] dark:text-[#e6e0e9]">熟练度评级</p>
              <p className="mt-0.5 truncate text-xs text-[#79747e] dark:text-[#938f99]">
                {proficiency.description}
              </p>
            </div>
          </div>
          <span
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={getProficiencyBadgeStyle(proficiency.band)}
          >
            {proficiency.label} {proficiency.score}
          </span>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full"
          style={{ backgroundColor: 'rgb(var(--m3-primary-container) / 0.45)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              ...getProficiencyBarStyle(proficiency.band),
              width: `${proficiency.score}%`,
            }}
          />
        </div>
      </div>

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

export default function Lexicon() {
  const [alphabetFilter, setAlphabetFilter] = useState<AlphabetFilter>('all');
  const [bookTag, setBookTag] = useState(allBookTagValue);
  const [sortMode, setSortMode] = useState<LexiconSortMode>('introtimeDesc');
  const [wordPendingDelete, setWordPendingDelete] = useState<WordItem | null>(null);
  const [wordAnimatingDeleteId, setWordAnimatingDeleteId] = useState<string | null>(null);
  const printQueue = usePrintQueue();
  const { bookTags, deletingWordId, deleteWord, errorMessage, filteredCount, loading, totalCount, words } = useLexicon({
    alphabetFilter,
    bookTag,
    sortMode,
  });
  const [displayedWords, setDisplayedWords] = useState<WordItem[]>([]);
  const [contentVisible, setContentVisible] = useState(false);
  const [hasResolvedOnce, setHasResolvedOnce] = useState(false);
  const [locallyRemovedWordIds, setLocallyRemovedWordIds] = useState<Set<string>>(() => new Set());
  const hasResolvedOnceRef = useRef(false);
  const listTransitionTimeoutRef = useRef<number | null>(null);
  const visibleWords = useMemo(
    () => displayedWords.filter((word) => !locallyRemovedWordIds.has(word.id)),
    [displayedWords, locallyRemovedWordIds],
  );

  useEffect(() => {
    return () => {
      if (listTransitionTimeoutRef.current !== null) {
        window.clearTimeout(listTransitionTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (listTransitionTimeoutRef.current !== null) {
      window.clearTimeout(listTransitionTimeoutRef.current);
      listTransitionTimeoutRef.current = null;
    }

    if (loading) {
      if (hasResolvedOnceRef.current) {
        setContentVisible(false);
      }
      return;
    }

    if (!hasResolvedOnceRef.current) {
      hasResolvedOnceRef.current = true;
      setHasResolvedOnce(true);
      setDisplayedWords(words);
      window.requestAnimationFrame(() => {
        setContentVisible(true);
      });
      return;
    }

    listTransitionTimeoutRef.current = window.setTimeout(() => {
      setDisplayedWords(words);
      window.requestAnimationFrame(() => {
        setContentVisible(true);
      });
    }, listTransitionDurationMs);
  }, [loading, words]);

  useEffect(() => {
    if (locallyRemovedWordIds.size === 0) {
      return;
    }

    const latestWordIds = new Set(words.map((word) => word.id));
    setLocallyRemovedWordIds((current) => {
      const next = new Set(Array.from(current).filter((wordId) => latestWordIds.has(wordId)));
      return next.size === current.size ? current : next;
    });
  }, [locallyRemovedWordIds.size, words]);

  const bookTagOptions = useMemo<M3SelectOption[]>(
    () => [
      { label: '所有单元', value: allBookTagValue },
      ...bookTags.map((tag) => ({ label: tag, value: tag })),
    ],
    [bookTags],
  );

  const handleSortModeChange = (nextSortMode: string) => {
    if (isLexiconSortMode(nextSortMode)) {
      setSortMode(nextSortMode);
    }
  };

  const handleDeleteWord = (word: WordItem) => {
    setWordPendingDelete(word);
  };

  const handleConfirmDelete = async () => {
    const targetWord = wordPendingDelete;

    if (!targetWord) {
      return;
    }

    setWordPendingDelete(null);
    setWordAnimatingDeleteId(targetWord.id);
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, deleteAnimationDurationMs);
    });

    setLocallyRemovedWordIds((current) => new Set(current).add(targetWord.id));
    const deleted = await deleteWord(targetWord.id);

    if (deleted) {
      printQueue.remove(targetWord.id);
    } else {
      setLocallyRemovedWordIds((current) => {
        const next = new Set(current);
        next.delete(targetWord.id);
        return next;
      });
    }

    setWordAnimatingDeleteId(null);
  };

  const handleAddPageToPrintQueue = () => {
    printQueue.addMany(visibleWords.map((word) => word.id));
  };

  const handleArrangePrintQueueByProficiency = () => {
    const now = new Date();
    const arrangedWordIds = [...visibleWords]
      .sort((first, second) => compareByAdaptiveProficiency(first, second, now))
      .map((word) => word.id);

    printQueue.replace(arrangedWordIds);
  };

  const handleTogglePrintQueue = (word: WordItem) => {
    printQueue.toggle(word.id);
  };

  const handleSpeakWord = (word: WordItem) => {
    if (!('speechSynthesis' in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word.words);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
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
                共导入 {totalCount} 个单词，当前筛选命中 {filteredCount} 个，打印候选 {printQueue.count} 个。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              disabled={visibleWords.length === 0}
              onClick={handleAddPageToPrintQueue}
              style={{
                backgroundColor: 'rgb(var(--m3-primary-container))',
                color: 'rgb(var(--m3-primary))',
              }}
              type="button"
            >
              <Printer aria-hidden="true" className="size-4" strokeWidth={2} />
              <span>将本页全选加入打印候选</span>
            </button>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              disabled={visibleWords.length === 0}
              onClick={handleArrangePrintQueueByProficiency}
              style={{
                backgroundColor: 'rgb(var(--m3-primary-container))',
                color: 'rgb(var(--m3-primary))',
              }}
              type="button"
            >
              <ListOrdered aria-hidden="true" className="size-4" strokeWidth={2} />
              <span>按熟练度编排打印候选</span>
            </button>
          </div>
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
            <p className="text-sm text-[#49454f] dark:text-[#cac4d0]">首字母、单元、排序和打印候选会实时联动。</p>
          </div>
        </div>

        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="flex min-w-max gap-2">
            {alphabetFilters.map((letter) => {
              const isActive = alphabetFilter === letter;

              return (
                <button
                  className="h-9 rounded-full border border-white/30 px-4 text-sm font-medium transition-[background-color,color,border-color,box-shadow] duration-[250ms] ease-[cubic-bezier(0.2,0,0,1)] hover:bg-[#f3edf7] active:bg-[#eaddff] dark:border-white/10 dark:hover:bg-[#2b2930] dark:active:bg-[#36313d]"
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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-end">
          <label className="block">
            <span className="mb-1 block text-xs text-[#49454f] dark:text-[#cac4d0]">单元分类</span>
            <M3Select icon={Tags} onChange={setBookTag} options={bookTagOptions} value={bookTag} />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-[#49454f] dark:text-[#cac4d0]">排序方式</span>
            <M3Select
              icon={ArrowUpDown}
              onChange={handleSortModeChange}
              options={sortModeOptions}
              value={sortMode}
            />
          </label>
        </div>
      </section>

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-[16px] border border-[#ba1a1a] bg-[#ffdad6] p-4 text-sm leading-6 text-[#410002] dark:border-[#ffb4ab] dark:bg-[#93000a] dark:text-[#ffdad6]">
          <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
          <span>{errorMessage}</span>
        </div>
      )}

      <section
        aria-busy={loading}
        className="min-h-[320px] rounded-[28px] border border-white/30 p-5 shadow-sm backdrop-blur-md dark:border-white/10 sm:p-6"
        style={surfaceStyle}
      >
        {!hasResolvedOnce ? (
          <div className="min-h-[280px]" />
        ) : visibleWords.length > 0 ? (
          <div
            className={`grid grid-cols-1 gap-4 transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.2,0,0,1)] md:grid-cols-2 ${
              contentVisible ? 'opacity-100 blur-0' : 'opacity-0 blur-[1px]'
            }`}
          >
            {visibleWords.map((word, index) => (
              <WordCard
                index={index}
                isDeleting={deletingWordId === word.id || wordAnimatingDeleteId === word.id}
                isQueued={printQueue.has(word.id)}
                key={word.id}
                onDelete={handleDeleteWord}
                onSpeak={handleSpeakWord}
                onTogglePrintQueue={handleTogglePrintQueue}
                word={word}
              />
            ))}
          </div>
        ) : (
          <div
            className={`flex min-h-[280px] flex-col items-center justify-center text-center transition-[opacity,filter] duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
              contentVisible ? 'opacity-100 blur-0' : 'opacity-0 blur-[1px]'
            }`}
          >
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

      <M3Dialog
        confirmLabel="确定删除"
        description={
          wordPendingDelete
            ? `将删除 ${wordPendingDelete.words} 以及相关复习日志，此操作无法撤销。`
            : undefined
        }
        loading={Boolean(wordPendingDelete && deletingWordId === wordPendingDelete.id)}
        onCancel={() => setWordPendingDelete(null)}
        onConfirm={() => void handleConfirmDelete()}
        open={wordPendingDelete !== null}
        title="删除词条"
        tone="danger"
      />
    </div>
  );
}
