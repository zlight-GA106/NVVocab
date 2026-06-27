import { startTransition, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  CalendarClock,
  CheckCircle2,
  Keyboard,
  LoaderCircle,
  PenLine,
  Play,
  Tags,
  Volume2,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import M3Select, { type M3SelectOption } from '../components/M3Select';
import { useNextReviewSchedule } from '../hooks/useNextReviewSchedule';
import { usePracticeWords } from '../hooks/usePracticeWords';
import {
  allDueReviewBookTagValue,
  isSpellingCorrect,
  useWords,
  type WordQueueSort,
} from '../hooks/useWords';

type AnswerPhase = 'typing' | 'revealed';
type DictateMode = 'review' | 'practice';

type ReviewRunConfig = {
  bookTag: string;
  limit: number;
  reloadKey: number;
  sortMode: WordQueueSort;
  systemManaged: boolean;
};

const systemManagedReviewLimit = 100;
const sortOptions: Array<{ label: string; value: WordQueueSort }> = [
  { label: '根据熟练度从低到高排序', value: 'proficiencyAsc' },
  { label: '根据熟练度从高到低排序', value: 'proficiencyDesc' },
  { label: '最早导入优先', value: 'introtimeAsc' },
  { label: '最近导入优先', value: 'introtimeDesc' },
  { label: '随机乱序', value: 'random' },
];

type RouteBasketConfig = {
  autostart: boolean;
  bookTag: string;
  sortMode: WordQueueSort;
};

function normalizeWordQueueSort(value: string | null): WordQueueSort | null {
  if (value === 'adaptive' || value === 'proficiencyAsc') {
    return 'proficiencyAsc';
  }

  if (value === 'proficiencyDesc' || value === 'introtimeAsc' || value === 'introtimeDesc' || value === 'random') {
    return value;
  }

  return null;
}

function readRouteBasketConfig(search: string): RouteBasketConfig | null {
  const params = new URLSearchParams(search);
  const sortMode = normalizeWordQueueSort(params.get('sort'));

  if (!sortMode) {
    return null;
  }

  return {
    autostart: params.get('autostart') === '1',
    bookTag: params.get('bookTag') || allDueReviewBookTagValue,
    sortMode,
  };
}

export default function Dictate() {
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [initialRouteConfig] = useState<RouteBasketConfig | null>(() => readRouteBasketConfig(location.search));
  const [dictateMode, setDictateMode] = useState<DictateMode>('review');
  const [selectedBookTag, setSelectedBookTag] = useState(initialRouteConfig?.bookTag ?? allDueReviewBookTagValue);
  const [sortMode, setSortMode] = useState<WordQueueSort>(initialRouteConfig?.sortMode ?? 'proficiencyAsc');
  const [customLimit, setCustomLimit] = useState<number | ''>('');
  const [reviewRunConfig, setReviewRunConfig] = useState<ReviewRunConfig | null>(() => {
    if (!initialRouteConfig?.autostart) {
      return null;
    }

    return {
      bookTag: initialRouteConfig.bookTag,
      limit: systemManagedReviewLimit,
      reloadKey: Date.now(),
      sortMode: initialRouteConfig.sortMode,
      systemManaged: true,
    };
  });
  const [practiceRunStarted, setPracticeRunStarted] = useState(false);
  const reviewState = useWords({
    bookTag: reviewRunConfig?.bookTag ?? selectedBookTag,
    enabled: reviewRunConfig !== null,
    limit: reviewRunConfig?.limit ?? systemManagedReviewLimit,
    reloadKey: reviewRunConfig?.reloadKey ?? 0,
    sortMode: reviewRunConfig?.sortMode ?? sortMode,
  });
  const practiceLimit = typeof customLimit === 'number' ? customLimit : 80;
  const practiceState = usePracticeWords({
    bookTag: selectedBookTag,
    enabled: false,
    limit: practiceLimit,
    sortMode,
  });
  const [answer, setAnswer] = useState('');
  const [phase, setPhase] = useState<AnswerPhase>('typing');
  const [isCorrect, setIsCorrect] = useState(false);
  const [usedHint, setUsedHint] = useState(false);

  const currentWord =
    dictateMode === 'review' ? reviewState.currentWord : practiceState.currentWord;
  const reviewRunHydrating =
    dictateMode === 'review' &&
    reviewRunConfig !== null &&
    reviewState.loadedReloadKey !== reviewRunConfig.reloadKey;
  const loading = dictateMode === 'review' ? reviewState.loading || reviewRunHydrating : practiceState.loading;
  const queueLength =
    dictateMode === 'review' ? reviewState.queueLength : practiceState.queueLength;
  const submitting = dictateMode === 'review' ? reviewState.submitting : false;
  const errorMessage =
    dictateMode === 'review' ? reviewState.errorMessage : practiceState.errorMessage;
  const offlineMessage = dictateMode === 'review' ? reviewState.offlineMessage : '';
  const practiceCompleted = dictateMode === 'practice' && practiceState.completed;
  const bookTags = reviewState.bookTags;
  const bookTagOptions = useMemo<M3SelectOption[]>(
    () => [
      { label: '全部到期词库', value: allDueReviewBookTagValue },
      ...bookTags.map((tag) => ({ label: tag, value: tag })),
    ],
    [bookTags],
  );
  const sortModeOptions = useMemo<M3SelectOption[]>(
    () => sortOptions.map((option) => ({ label: option.label, value: option.value })),
    [],
  );
  const nextReviewSchedule = useNextReviewSchedule({
    bookTag: selectedBookTag,
    enabled: dictateMode === 'review',
    reloadKey: reviewRunConfig?.reloadKey ?? 0,
  });

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) {
        return;
      }

      setAnswer('');
      setPhase('typing');
      setIsCorrect(false);
      setUsedHint(false);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    });

    return () => {
      cancelled = true;
    };
  }, [currentWord?.id, dictateMode, selectedBookTag, sortMode]);

  const handleCustomLimitChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value.trim();

    if (!nextValue) {
      setCustomLimit('');
      return;
    }

    const parsedValue = Number.parseInt(nextValue, 10);
    if (!Number.isFinite(parsedValue)) {
      return;
    }

    setCustomLimit(Math.max(1, parsedValue));
  };

  const handleModeChange = (nextMode: DictateMode) => {
    if (nextMode === dictateMode) {
      return;
    }

    startTransition(() => {
      setDictateMode(nextMode);
      setAnswer('');
      setPhase('typing');
      setIsCorrect(false);
      setUsedHint(false);

      if (nextMode === 'practice') {
        setPracticeRunStarted(false);
      }
    });
  };

  const handleBookTagChange = (nextValue: string) => {
    setSelectedBookTag(nextValue);
    setPracticeRunStarted(false);
  };

  const handleSortModeChange = (nextValue: string) => {
    const nextSortMode = normalizeWordQueueSort(nextValue);

    if (!nextSortMode) {
      return;
    }

    setSortMode(nextSortMode);
    setPracticeRunStarted(false);
  };

  const startReviewRun = () => {
    const hasCustomLimit = typeof customLimit === 'number';
    setReviewRunConfig({
      bookTag: selectedBookTag,
      limit: hasCustomLimit ? customLimit : systemManagedReviewLimit,
      reloadKey: Date.now(),
      sortMode: hasCustomLimit ? sortMode : 'proficiencyAsc',
      systemManaged: !hasCustomLimit,
    });
  };

  const startDictationRun = () => {
    if (dictateMode === 'practice') {
      setPracticeRunStarted(true);
      void practiceState.fetchPracticeWords();
      return;
    }

    startReviewRun();
  };

  const speakCurrentWord = () => {
    if (!currentWord || !('speechSynthesis' in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentWord.words);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  const revealAnswer = () => {
    if (!currentWord) {
      return;
    }

    setIsCorrect(isSpellingCorrect(answer, currentWord));
    setPhase('revealed');
  };

  const submitAndAdvance = async () => {
    if (!currentWord) {
      return;
    }

    if (dictateMode === 'practice') {
      practiceState.advance();
      setAnswer('');
      setPhase('typing');
      setIsCorrect(false);
      setUsedHint(false);
      window.requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }

    const submitted = await reviewState.submitReview(currentWord, {
      answer,
      isCorrect,
      usedHint,
    });

    if (submitted) {
      void nextReviewSchedule.refresh();
      setAnswer('');
      setPhase('typing');
      setIsCorrect(false);
      setUsedHint(false);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.ctrlKey && event.key.toLocaleLowerCase() === 'h') {
      event.preventDefault();
      setUsedHint(true);
      return;
    }

    if (event.key !== 'Enter' || submitting) {
      return;
    }

    event.preventDefault();

    if (phase === 'typing') {
      revealAnswer();
      return;
    }

    void submitAndAdvance();
  };

  const inputStateClass =
    phase === 'typing'
      ? 'border-[#79747e] focus-within:border-[#6750a4] focus-within:ring-[#6750a4] dark:border-[#938f99]'
      : isCorrect
        ? 'border-[#146c2e] focus-within:ring-[#146c2e] dark:border-[#7ddc82]'
        : 'border-[#ba1a1a] focus-within:ring-[#ba1a1a] dark:border-[#ffb4ab]';

  const emptyTitle =
    dictateMode === 'review'
      ? '暂无到期单词'
      : practiceCompleted
        ? '本轮练习完成'
        : '暂无练习词条';
  const emptyDescription =
    dictateMode === 'review'
      ? '当前没有需要复习的词条。导入新词或等待下一次复习时间到期后再回来。'
      : practiceCompleted
        ? '当前练习列表已经结束。可以重新开始，或调整范围和排序后再练习。'
        : '当前词库没有可练习的词条。请先导入词库后再进入练习模式。';
  const waitingToStart = dictateMode === 'review' ? !reviewRunConfig : !practiceRunStarted;
  const readyTitle = dictateMode === 'review' ? '准备开始默写' : '准备开始练习';
  const readyDescription =
    dictateMode === 'review'
      ? '设置复习范围和本次数量后点击开始。数量留空时由系统自动限流并洗牌。'
      : '设置练习范围和本次数量后点击开始。练习模式不会写入复习统计。';

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-5xl flex-col justify-center space-y-8">
      <header className="space-y-4">
        <div className="space-y-3">
          <p className="text-sm font-medium text-[#6750a4] dark:text-[#d0bcff]">
            沉浸式默写
          </p>
          <h1 className="text-3xl font-normal text-[#1d1b20] dark:text-[#e6e0e9]">
            {dictateMode === 'review' ? '只看释义，敲出单词' : '看见单词，完成拼写练习'}
          </h1>
        </div>

        <div className="relative grid w-fit grid-cols-2 rounded-full border border-[#79747e] p-1 dark:border-[#938f99]">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-1 left-1 rounded-full transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
            style={{
              backgroundColor: 'rgb(var(--m3-primary-container))',
              transform: dictateMode === 'practice' ? 'translateX(100%)' : 'translateX(0)',
              width: 'calc((100% - 0.5rem) / 2)',
            }}
          />
          {[
            { icon: PenLine, label: '复习模式', value: 'review' as const },
            { icon: Keyboard, label: '练习模式', value: 'practice' as const },
          ].map((option) => {
            const Icon = option.icon;
            const active = dictateMode === option.value;

            return (
              <button
                className="relative z-10 inline-flex h-10 min-w-28 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                key={option.value}
                onClick={() => handleModeChange(option.value)}
                style={{
                  color: active ? 'rgb(var(--m3-primary))' : undefined,
                }}
                type="button"
              >
                <Icon aria-hidden="true" className="size-4" strokeWidth={2} />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>

        <section className="rounded-[28px] border border-white/30 bg-white/60 p-5 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-neutral-900/40">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px_auto] lg:items-end">
            <label className="block">
              <span className="mb-1 block text-xs text-[#49454f] dark:text-[#cac4d0]">
                复习范围
              </span>
              <M3Select
                disabled={loading || submitting}
                icon={Tags}
                onChange={handleBookTagChange}
                options={bookTagOptions}
                value={selectedBookTag}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-[#49454f] dark:text-[#cac4d0]">
                排序方式
              </span>
              <M3Select
                disabled={loading || submitting}
                icon={ArrowUpDown}
                onChange={handleSortModeChange}
                options={sortModeOptions}
                value={sortMode}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-[#49454f] dark:text-[#cac4d0]">
                本次复习数量
              </span>
              <div className="flex h-12 items-center rounded-[16px] border border-[#79747e] bg-transparent px-4 transition-colors focus-within:border-[#6750a4] focus-within:ring-2 focus-within:ring-[#6750a4] dark:border-[#938f99]">
                <input
                  className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#1d1b20] outline-none placeholder:text-[#79747e] dark:text-[#e6e0e9] dark:placeholder:text-[#938f99]"
                  disabled={loading || submitting}
                  inputMode="numeric"
                  min={1}
                  onChange={handleCustomLimitChange}
                  placeholder="系统自动计算"
                  type="number"
                  value={customLimit}
                />
              </div>
            </label>

            <button
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading || submitting}
              onClick={startDictationRun}
              style={{
                backgroundColor: 'rgb(var(--m3-primary-container))',
                color: 'rgb(var(--m3-primary))',
              }}
              type="button"
            >
              {loading ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" strokeWidth={2} />
              ) : (
                <Play aria-hidden="true" className="size-4" strokeWidth={2} />
              )}
              <span>{dictateMode === 'practice' ? '开始练习' : reviewRunConfig ? '重新开始' : '开始默写'}</span>
            </button>
          </div>
          {dictateMode === 'review' && (
            <>
              <p className="mt-3 text-xs leading-5 text-[#79747e] dark:text-[#938f99]">
                {reviewRunConfig?.systemManaged
                  ? `系统托管本轮最多 ${systemManagedReviewLimit} 词，并按熟练度从低到高排序。`
                  : reviewRunConfig
                    ? `本轮按手动数量读取 ${reviewRunConfig.limit} 词。`
                    : `留空时系统最多读取 ${systemManagedReviewLimit} 个到期词并按熟练度从低到高排序。`}
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div
                  className="flex items-center gap-3 rounded-[20px] border border-white/30 px-4 py-3 text-sm dark:border-white/10"
                  style={{ backgroundColor: 'rgb(var(--m3-surface) / 0.58)' }}
                >
                  <CalendarClock aria-hidden="true" className="size-4 shrink-0 text-[#6750a4] dark:text-[#d0bcff]" strokeWidth={2} />
                  <div className="min-w-0">
                    <p className="text-xs text-[#79747e] dark:text-[#938f99]">下一轮复习时间：</p>
                    <p className="truncate font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                      {nextReviewSchedule.loading ? '正在计算' : nextReviewSchedule.countdownText}
                    </p>
                    <p className="truncate text-xs text-[#79747e] dark:text-[#938f99]">
                      {nextReviewSchedule.reviewDateText}
                    </p>
                  </div>
                </div>
                <div
                  className="flex items-center justify-between gap-4 rounded-[20px] border border-white/30 px-4 py-3 text-sm dark:border-white/10"
                  style={{ backgroundColor: 'rgb(var(--m3-surface) / 0.58)' }}
                >
                  <span className="text-[#49454f] dark:text-[#cac4d0]">下一轮自动复习单词数</span>
                  <span className="rounded-full px-3 py-1 text-sm font-medium" style={{ backgroundColor: 'rgb(var(--m3-primary-container))', color: 'rgb(var(--m3-primary))' }}>
                    {nextReviewSchedule.nextReviewWordCount} 词
                  </span>
                </div>
              </div>
            </>
          )}
        </section>
      </header>

      <section className="rounded-[28px] border border-[#cac4d0] bg-[#fef7ff] p-6 shadow-sm dark:border-[#49454f] dark:bg-[#211f26] sm:p-8">
        {waitingToStart ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center space-y-3 text-center">
            <h2 className="text-xl font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
              {readyTitle}
            </h2>
            <p className="max-w-md text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
              {readyDescription}
            </p>
          </div>
        ) : loading ? (
          <div className="flex min-h-[320px] items-center justify-center text-[#49454f] dark:text-[#cac4d0]">
            <LoaderCircle aria-hidden="true" className="mr-3 size-5 animate-spin" strokeWidth={2} />
            <span>{dictateMode === 'review' ? '正在载入到期词库' : '正在载入练习词库'}</span>
          </div>
        ) : currentWord ? (
          <div className={dictateMode === 'practice' ? 'grid gap-8 lg:grid-cols-[0.9fr_1.1fr]' : 'space-y-8'}>
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <span className="rounded-full bg-[#e8def8] px-3 py-1 text-xs font-medium text-[#4f378b] dark:bg-[#4f378b] dark:text-[#eaddff]">
                  {dictateMode === 'review' ? `剩余 ${queueLength}` : `练习 ${queueLength}`}
                </span>
                <span className="rounded-full border border-[#cac4d0] px-3 py-1 text-xs text-[#49454f] dark:border-[#49454f] dark:text-[#cac4d0]">
                  {currentWord.book_tag ?? '未分类'}
                </span>
              </div>

              {dictateMode === 'practice' ? (
                <div className="rounded-[24px] bg-[#fffbff] p-5 dark:bg-[#141218]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm leading-6 text-[#79747e] dark:text-[#938f99]">练习单词</p>
                      <p className="mt-3 break-words text-4xl font-medium leading-tight text-[#1d1b20] dark:text-[#e6e0e9]">
                        {currentWord.words}
                      </p>
                    </div>
                    <button
                      aria-label={`播放 ${currentWord.words}`}
                      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full shadow-sm transition-colors"
                      onClick={speakCurrentWord}
                      style={{
                        backgroundColor: 'rgb(var(--m3-primary-container))',
                        color: 'rgb(var(--m3-primary))',
                      }}
                      title="播放发音"
                      type="button"
                    >
                      <Volume2 aria-hidden="true" className="size-5" strokeWidth={2} />
                    </button>
                  </div>
                  {currentWord.phonetic && (
                    <p className="mt-3 text-base leading-7 text-[#6750a4] dark:text-[#d0bcff]">
                      [{currentWord.phonetic}]
                    </p>
                  )}
                  <p className="mt-4 text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
                    {currentWord.translate}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm leading-6 text-[#79747e] dark:text-[#938f99]">
                    中文释义
                  </p>
                  <p className="text-3xl font-medium leading-tight text-[#1d1b20] dark:text-[#e6e0e9]">
                    {currentWord.translate}
                  </p>
                  {currentWord.phonetic && (
                    <p className="text-base leading-7 text-[#6750a4] dark:text-[#d0bcff]">
                      [{currentWord.phonetic}]
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="min-h-6">
                {usedHint && (
                  <p className="text-sm text-[#79747e] dark:text-[#938f99]">
                    首字母：{currentWord.words[0]}
                  </p>
                )}
              </div>

              <div
                className={`rounded-[20px] border bg-[#fffbff] px-5 py-3 transition-colors focus-within:ring-2 dark:bg-[#141218] ${inputStateClass}`}
              >
                <input
                  autoCapitalize="none"
                  autoComplete="off"
                  autoCorrect="off"
                  autoFocus
                  className="h-14 w-full bg-transparent text-2xl text-[#1d1b20] outline-none placeholder:text-[#79747e] dark:text-[#e6e0e9] dark:placeholder:text-[#938f99]"
                  disabled={submitting}
                  onChange={(event) => setAnswer(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={dictateMode === 'review' ? '在这里默写' : '在这里练习拼写'}
                  ref={inputRef}
                  spellCheck={false}
                  value={answer}
                />
              </div>

              <div className="min-h-7">
                {phase === 'revealed' && (
                  <div
                    className={`flex items-center gap-2 text-sm ${
                      isCorrect
                        ? 'text-[#146c2e] dark:text-[#7ddc82]'
                        : 'text-[#79747e] dark:text-[#938f99]'
                    }`}
                  >
                    {isCorrect ? (
                      <CheckCircle2 aria-hidden="true" className="size-4" strokeWidth={2} />
                    ) : (
                      <AlertCircle aria-hidden="true" className="size-4" strokeWidth={2} />
                    )}
                    <span>{isCorrect ? '拼写正确，再按 Enter 继续' : `正确答案：${currentWord.words}`}</span>
                  </div>
                )}
              </div>

            </div>
          </div>
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center space-y-3 text-center">
            <h2 className="text-xl font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
              {emptyTitle}
            </h2>
            <p className="max-w-md text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
              {emptyDescription}
            </p>
          </div>
        )}
      </section>

      {offlineMessage && (
        <div
          className="flex items-start gap-3 rounded-[16px] border p-4 text-sm leading-6"
          style={{
            backgroundColor: 'rgb(var(--m3-primary-container))',
            borderColor: 'rgb(var(--m3-primary))',
            color: 'rgb(var(--m3-primary))',
          }}
        >
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
          <span>{offlineMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-[16px] border border-[#ba1a1a] bg-[#ffdad6] p-4 text-sm leading-6 text-[#410002] dark:border-[#ffb4ab] dark:bg-[#93000a] dark:text-[#ffdad6]">
          <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
