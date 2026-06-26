import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Flag,
  LoaderCircle,
  Pause,
  Play,
  Save,
  Target,
  TimerReset,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useStudyTarget, type StudyTarget, type StudyTargetStatus } from '../hooks/useStudyTarget';

type GoalFormState = {
  dailyWordTarget: string;
  endAt: string;
  startAt: string;
  title: string;
};

const millisecondsPerMinute = 60 * 1000;
const millisecondsPerDay = 24 * 60 * 60 * 1000;
const defaultGoalDays = 90;

function toDatetimeLocalValue(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * millisecondsPerMinute);
  return localDate.toISOString().slice(0, 16);
}

function createDefaultFormState(): GoalFormState {
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + defaultGoalDays * millisecondsPerDay);

  return {
    dailyWordTarget: '50',
    endAt: toDatetimeLocalValue(endDate),
    startAt: toDatetimeLocalValue(startDate),
    title: 'CET4 冲刺',
  };
}

function parseFormDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDuration(totalSecondsInput: number): string {
  const totalSeconds = Math.max(0, Math.floor(totalSecondsInput));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${days}天 ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatRemainingTime(target: StudyTarget | null, now: Date): string {
  if (!target) {
    return '未设置';
  }

  const endDate = new Date(target.end_at);
  if (Number.isNaN(endDate.getTime())) {
    return '未设置';
  }

  const remainingSeconds = Math.floor((endDate.getTime() - now.getTime()) / 1000);
  return remainingSeconds <= 0 ? '已截稿' : formatDuration(remainingSeconds);
}

function formatDateText(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '未设置';
  }

  return date.toLocaleString('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function calculateProgress(target: StudyTarget | null, now: Date): number {
  if (!target) {
    return 0;
  }

  const startDate = new Date(target.start_at);
  const endDate = new Date(target.end_at);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 0;
  }

  const totalMs = endDate.getTime() - startDate.getTime();
  if (totalMs <= 0) {
    return 0;
  }

  const progress = ((now.getTime() - startDate.getTime()) / totalMs) * 100;
  return Math.min(100, Math.max(0, progress));
}

function getStatusLabel(status: StudyTargetStatus | null): string {
  if (status === 'paused') {
    return '已打断';
  }

  if (status === 'active') {
    return '进行中';
  }

  return '未设置';
}

function getFormError(formState: GoalFormState): string {
  if (!formState.title.trim()) {
    return '请填写目标名称。';
  }

  const dailyWordTarget = Number(formState.dailyWordTarget);
  if (!Number.isFinite(dailyWordTarget) || dailyWordTarget < 1) {
    return '请填写有效的每日记忆单词数。';
  }

  const startDate = parseFormDate(formState.startAt);
  const endDate = parseFormDate(formState.endAt);

  if (!startDate || !endDate) {
    return '请设置有效的开始时间和结束时间。';
  }

  if (endDate.getTime() <= startDate.getTime()) {
    return '结束时间必须晚于开始时间。';
  }

  return '';
}

export default function Goal() {
  const {
    deleteTarget,
    errorMessage,
    isLoading,
    isSubmitting,
    loadTodayImportedWordCount,
    persistInvestedSeconds,
    saveTarget,
    target,
    updateTargetStatus,
  } = useStudyTarget();
  const [formState, setFormState] = useState<GoalFormState>(() => createDefaultFormState());
  const [formError, setFormError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [investedSeconds, setInvestedSeconds] = useState(0);
  const [todayImportedWordCount, setTodayImportedWordCount] = useState(0);
  const targetRef = useRef<StudyTarget | null>(null);
  const investedSecondsRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    targetRef.current = target;

    if (!target) {
      investedSecondsRef.current = 0;
      Promise.resolve().then(() => {
        if (cancelled) {
          return;
        }

        setFormState(createDefaultFormState());
        setInvestedSeconds(0);
      });

      return () => {
        cancelled = true;
      };
    }

    const nextFormState: GoalFormState = {
      dailyWordTarget: String(target.daily_word_target),
      endAt: toDatetimeLocalValue(target.end_at),
      startAt: toDatetimeLocalValue(target.start_at),
      title: target.title,
    };
    const nextInvestedSeconds = target.time_invested_seconds;
    investedSecondsRef.current = nextInvestedSeconds;

    Promise.resolve().then(() => {
      if (cancelled) {
        return;
      }

      setFormState(nextFormState);
      setInvestedSeconds(nextInvestedSeconds);
    });

    return () => {
      cancelled = true;
    };
  }, [target]);

  useEffect(() => {
    let cancelled = false;

    loadTodayImportedWordCount().then((count) => {
      if (!cancelled) {
        setTodayImportedWordCount(count);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadTodayImportedWordCount]);

  useEffect(() => {
    const intervalId: number = window.setInterval(() => {
      setNow(new Date());
      setInvestedSeconds((currentSeconds) => {
        if (targetRef.current?.status !== 'active') {
          return currentSeconds;
        }

        const nextSeconds = currentSeconds + 1;
        investedSecondsRef.current = nextSeconds;
        return nextSeconds;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    return () => {
      const currentTarget = targetRef.current;

      if (!currentTarget) {
        return;
      }

      void persistInvestedSeconds(currentTarget.id, investedSecondsRef.current);
    };
  }, [persistInvestedSeconds]);

  useEffect(() => {
    if (!actionMessage) {
      return undefined;
    }

    const timeoutId: number = window.setTimeout(() => {
      setActionMessage('');
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [actionMessage]);

  const progressPercent = calculateProgress(target, now);
  const dailyWordTarget = target?.daily_word_target ?? Math.max(1, Math.floor(Number(formState.dailyWordTarget) || 50));
  const dailyProgressPercent = Math.min(100, (todayImportedWordCount / dailyWordTarget) * 100);
  const statusLabel = getStatusLabel(target?.status ?? null);
  const canToggleStatus = Boolean(target && !isSubmitting);
  const isActive = target?.status === 'active';

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionMessage('');

    const validationMessage = getFormError(formState);
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    const startDate = parseFormDate(formState.startAt);
    const endDate = parseFormDate(formState.endAt);

    if (!startDate || !endDate) {
      setFormError('请设置有效的开始时间和结束时间。');
      return;
    }

    setFormError('');

    const nextTarget = await saveTarget(
      {
        daily_word_target: Math.max(1, Math.floor(Number(formState.dailyWordTarget))),
        end_at: endDate.toISOString(),
        start_at: startDate.toISOString(),
        title: formState.title.trim(),
      },
      investedSecondsRef.current,
    );

    if (nextTarget) {
      setActionMessage('目标已保存。');
    }
  };

  const handleToggleStatus = async () => {
    if (!target) {
      return;
    }

    const nextStatus: StudyTargetStatus = target.status === 'active' ? 'paused' : 'active';
    const nextTarget = await updateTargetStatus(target.id, nextStatus, investedSecondsRef.current);

    if (nextTarget) {
      setActionMessage(nextStatus === 'paused' ? '目标已打断。' : '目标已恢复。');
    }
  };

  const handleDelete = async () => {
    if (!target) {
      return;
    }

    const deleted = await deleteTarget(target.id, investedSecondsRef.current);

    if (deleted) {
      targetRef.current = null;
      investedSecondsRef.current = 0;
      setInvestedSeconds(0);
      setFormState(createDefaultFormState());
      setActionMessage('目标已删除。');
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-[#6750a4] dark:text-[#d0bcff]">备考 Goal</p>
        <h1 className="text-3xl font-normal text-[#1d1b20] dark:text-[#e6e0e9]">学习目标</h1>
        <p className="max-w-3xl text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
          目标状态与投入时间将会自动同步到仪表板
        </p>
      </header>

      {(errorMessage || formError || actionMessage) && (
        <div
          className={`flex items-start gap-3 rounded-[16px] border p-4 text-sm leading-6 ${
            actionMessage && !errorMessage && !formError
              ? 'border-[#386a20] bg-[#dff7df] text-[#002106] dark:border-[#b8f5b9] dark:bg-[#14361d] dark:text-[#b8f5b9]'
              : 'border-[#ba1a1a] bg-[#ffdad6] text-[#410002] dark:border-[#ffb4ab] dark:bg-[#93000a] dark:text-[#ffdad6]'
          }`}
        >
          {actionMessage && !errorMessage && !formError ? (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
          ) : (
            <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
          )}
          <span>{errorMessage || formError || actionMessage}</span>
        </div>
      )}

      <section className="rounded-[28px] border border-[#cac4d0] bg-[#fef7ff] p-5 shadow-sm dark:border-[#49454f] dark:bg-[#211f26] sm:p-6">
        {isLoading ? (
          <div className="flex min-h-[420px] items-center justify-center text-[#49454f] dark:text-[#cac4d0]">
            <LoaderCircle aria-hidden="true" className="mr-3 size-5 animate-spin" strokeWidth={2} />
            <span>正在加载学习目标</span>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
            <div className="space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8def8] text-[#4f378b] dark:bg-[#4f378b] dark:text-[#eaddff]">
                    <Target aria-hidden="true" className="size-5" strokeWidth={2} />
                  </div>
                  <div>
                    <h2 className="text-xl font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                      {target?.title ?? '暂无学习目标'}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
                      {target
                        ? `${formatDateText(target.start_at)} 至 ${formatDateText(target.end_at)}`
                        : '保存右侧表单后开始计时。'}
                    </p>
                  </div>
                </div>

                <span className="w-fit rounded-full bg-[#e8def8] px-4 py-2 text-sm font-medium text-[#4f378b] dark:bg-[#4a4458] dark:text-[#eaddff]">
                  {statusLabel}
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[24px] bg-[#fffbff] p-5 dark:bg-[#141218]">
                  <div className="mb-3 flex items-center gap-2 text-sm text-[#6750a4] dark:text-[#d0bcff]">
                    <CalendarClock aria-hidden="true" className="size-4" strokeWidth={2} />
                    <span>剩余时间</span>
                  </div>
                  <p className="break-words text-3xl font-medium text-[#1d1b20] dark:text-[#e6e0e9] sm:text-4xl">
                    {formatRemainingTime(target, now)}
                  </p>
                </div>

                <div className="rounded-[24px] bg-[#fffbff] p-5 dark:bg-[#141218]">
                  <div className="mb-3 flex items-center gap-2 text-sm text-[#6750a4] dark:text-[#d0bcff]">
                    <TimerReset aria-hidden="true" className="size-4" strokeWidth={2} />
                    <span>已投入时间</span>
                  </div>
                  <p className="break-words text-3xl font-medium text-[#1d1b20] dark:text-[#e6e0e9] sm:text-4xl">
                    {formatDuration(investedSeconds)}
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-4 text-sm text-[#49454f] dark:text-[#cac4d0]">
                  <span>目标进度</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <div
                  className="h-3 overflow-hidden rounded-full"
                  style={{ backgroundColor: 'rgb(var(--m3-primary-container) / 0.58)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      backgroundColor: 'rgb(var(--m3-primary))',
                      width: `${progressPercent}%`,
                    }}
                  />
                </div>
              </div>

              <div className="rounded-[24px] bg-[#fffbff] p-5 dark:bg-[#141218]">
                <div className="mb-2 flex items-center justify-between gap-4 text-sm text-[#49454f] dark:text-[#cac4d0]">
                  <span>今日记忆目标</span>
                  <span>
                    {todayImportedWordCount} / {dailyWordTarget} 词
                  </span>
                </div>
                <div
                  className="h-3 overflow-hidden rounded-full"
                  style={{ backgroundColor: 'rgb(var(--m3-primary-container) / 0.58)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      backgroundColor: 'rgb(var(--m3-primary))',
                      width: `${dailyProgressPercent}%`,
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-[20px] bg-[#fffbff] p-4 dark:bg-[#141218]">
                  <p className="text-xs text-[#79747e] dark:text-[#938f99]">开始时间</p>
                  <p className="mt-1 text-sm font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                    {target ? formatDateText(target.start_at) : '未设置'}
                  </p>
                </div>
                <div className="rounded-[20px] bg-[#fffbff] p-4 dark:bg-[#141218]">
                  <p className="text-xs text-[#79747e] dark:text-[#938f99]">结束时间</p>
                  <p className="mt-1 text-sm font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                    {target ? formatDateText(target.end_at) : '未设置'}
                  </p>
                </div>
                <div className="rounded-[20px] bg-[#fffbff] p-4 dark:bg-[#141218]">
                  <p className="text-xs text-[#79747e] dark:text-[#938f99]">当前状态</p>
                  <p className="mt-1 text-sm font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                    {statusLabel}
                  </p>
                </div>
              </div>
            </div>

            <form className="rounded-[24px] bg-[#fffbff] p-5 dark:bg-[#141218]" onSubmit={handleFormSubmit}>
              <div className="mb-5 flex items-center gap-2">
                <Flag aria-hidden="true" className="size-5 text-[#6750a4] dark:text-[#d0bcff]" strokeWidth={2} />
                <h3 className="text-lg font-medium text-[#1d1b20] dark:text-[#e6e0e9]">目标设置</h3>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1 block text-xs text-[#49454f] dark:text-[#cac4d0]">目标名称</span>
                  <input
                    className="h-12 w-full rounded-[16px] border border-[#79747e] bg-transparent px-4 text-sm text-[#1d1b20] outline-none transition-colors focus:border-[#6750a4] focus:ring-2 focus:ring-[#6750a4] dark:border-[#938f99] dark:text-[#e6e0e9]"
                    onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
                    placeholder="CET4 冲刺"
                    value={formState.title}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs text-[#49454f] dark:text-[#cac4d0]">
                    每日记忆单词数
                  </span>
                  <input
                    className="h-12 w-full rounded-[16px] border border-[#79747e] bg-transparent px-4 text-sm text-[#1d1b20] outline-none transition-colors focus:border-[#6750a4] focus:ring-2 focus:ring-[#6750a4] dark:border-[#938f99] dark:text-[#e6e0e9]"
                    min={1}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, dailyWordTarget: event.target.value }))
                    }
                    placeholder="50"
                    type="number"
                    value={formState.dailyWordTarget}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs text-[#49454f] dark:text-[#cac4d0]">开始时间</span>
                  <input
                    className="h-12 w-full rounded-[16px] border border-[#79747e] bg-transparent px-4 text-sm text-[#1d1b20] outline-none transition-colors focus:border-[#6750a4] focus:ring-2 focus:ring-[#6750a4] dark:border-[#938f99] dark:text-[#e6e0e9]"
                    onChange={(event) => setFormState((current) => ({ ...current, startAt: event.target.value }))}
                    type="datetime-local"
                    value={formState.startAt}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs text-[#49454f] dark:text-[#cac4d0]">结束时间</span>
                  <input
                    className="h-12 w-full rounded-[16px] border border-[#79747e] bg-transparent px-4 text-sm text-[#1d1b20] outline-none transition-colors focus:border-[#6750a4] focus:ring-2 focus:ring-[#6750a4] dark:border-[#938f99] dark:text-[#e6e0e9]"
                    onChange={(event) => setFormState((current) => ({ ...current, endAt: event.target.value }))}
                    type="datetime-local"
                    value={formState.endAt}
                  />
                </label>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <button
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#6750a4] px-6 text-sm font-medium text-white transition-colors hover:bg-[#5b4398] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#d0bcff] dark:text-[#381e72] dark:hover:bg-[#eaddff]"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? (
                    <LoaderCircle aria-hidden="true" className="size-4 animate-spin" strokeWidth={2} />
                  ) : (
                    <Save aria-hidden="true" className="size-4" strokeWidth={2} />
                  )}
                  <span>{target ? '保存目标' : '创建目标'}</span>
                </button>

                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium text-[#6750a4] transition-colors hover:bg-[#f3edf7] disabled:cursor-not-allowed disabled:opacity-45 dark:text-[#d0bcff] dark:hover:bg-[#2b2930]"
                  disabled={!canToggleStatus}
                  onClick={() => void handleToggleStatus()}
                  type="button"
                >
                  {isActive ? (
                    <Pause aria-hidden="true" className="size-4" strokeWidth={2} />
                  ) : (
                    <Play aria-hidden="true" className="size-4" strokeWidth={2} />
                  )}
                  <span>{isActive ? '打断' : '恢复'}</span>
                </button>

                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium text-[#ba1a1a] transition-colors hover:bg-[#ffdad6] disabled:cursor-not-allowed disabled:opacity-45 dark:text-[#ffb4ab] dark:hover:bg-[#410002]"
                  disabled={!target || isSubmitting}
                  onClick={() => void handleDelete()}
                  type="button"
                >
                  <Trash2 aria-hidden="true" className="size-4" strokeWidth={2} />
                  <span>删除</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
