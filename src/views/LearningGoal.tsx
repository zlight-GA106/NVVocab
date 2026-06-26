import { CalendarClock, Flag, Pause, Plus, Target, Trash2 } from 'lucide-react';
import { formatRemainingTime, useLearningGoal, type LearningGoal } from '../hooks/useLearningGoal';

function getStatusLabel(goal: LearningGoal | null, isFinished: boolean): string {
  if (!goal) {
    return '未设置';
  }

  if (goal.status === 'interrupted') {
    return '已打断';
  }

  return isFinished ? '已结束' : '进行中';
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

export default function LearningGoal() {
  const { countdown, createGoal, deleteGoal, goal, interruptGoal, updateGoal } = useLearningGoal();
  const progressPercent = Math.min(100, Math.max(0, countdown.progressPercent));
  const statusLabel = getStatusLabel(goal, countdown.isFinished);
  const canInterrupt = Boolean(goal && goal.status === 'active' && !countdown.isFinished);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-[#6750a4] dark:text-[#d0bcff]">备考 Goal</p>
        <h1 className="text-3xl font-normal text-[#1d1b20] dark:text-[#e6e0e9]">
          学习目标
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
          用一个清晰的时间窗口承载当前阶段的备考节奏。
        </p>
      </header>

      <section className="rounded-[28px] border border-[#cac4d0] bg-[#fef7ff] p-5 shadow-sm dark:border-[#49454f] dark:bg-[#211f26] sm:p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8def8] text-[#4f378b] dark:bg-[#4f378b] dark:text-[#eaddff]">
              <Target aria-hidden="true" className="size-5" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-xl font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                {goal?.name.trim() || '学习目标'}
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
                {goal ? `${formatDateText(goal.startAt)} 至 ${formatDateText(goal.endAt)}` : '暂无目标'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#e8def8] px-4 py-2 text-sm font-medium text-[#4f378b] dark:bg-[#4a4458] dark:text-[#eaddff]">
              {statusLabel}
            </span>
            {goal && (
              <button
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-[#6750a4] transition-colors hover:bg-[#f3edf7] disabled:cursor-not-allowed disabled:opacity-45 dark:text-[#d0bcff] dark:hover:bg-[#2b2930]"
                disabled={!canInterrupt}
                onClick={interruptGoal}
                type="button"
              >
                <Pause aria-hidden="true" className="size-4" strokeWidth={2} />
                <span>打断</span>
              </button>
            )}
            <button
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                goal
                  ? 'text-[#ba1a1a] hover:bg-[#ffdad6] dark:text-[#ffb4ab] dark:hover:bg-[#410002]'
                  : 'bg-[#6750a4] text-white hover:bg-[#5b4397] dark:bg-[#d0bcff] dark:text-[#381e72] dark:hover:bg-[#eaddff]'
              }`}
              onClick={goal ? deleteGoal : createGoal}
              type="button"
            >
              {goal ? (
                <Trash2 aria-hidden="true" className="size-4" strokeWidth={2} />
              ) : (
                <Plus aria-hidden="true" className="size-4" strokeWidth={2} />
              )}
              <span>{goal ? '删除' : '新建'}</span>
            </button>
          </div>
        </div>

        {goal ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
            <div className="space-y-5">
              <div className="rounded-[24px] bg-[#fffbff] p-5 dark:bg-[#141218] sm:p-6">
                <div className="mb-3 flex items-center gap-2 text-sm text-[#6750a4] dark:text-[#d0bcff]">
                  <CalendarClock aria-hidden="true" className="size-4" strokeWidth={2} />
                  <span>剩余时间</span>
                </div>
                <p className="break-words text-4xl font-medium text-[#1d1b20] dark:text-[#e6e0e9] sm:text-5xl">
                  {formatRemainingTime(countdown.remainingMs)}
                </p>
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
                    className="dashboard-progress-bar h-full rounded-full"
                    style={{
                      backgroundColor: 'rgb(var(--m3-primary))',
                      width: `${progressPercent}%`,
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-[20px] bg-[#fffbff] p-4 dark:bg-[#141218]">
                  <p className="text-xs text-[#79747e] dark:text-[#938f99]">开始时间</p>
                  <p className="mt-1 text-sm font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                    {formatDateText(goal.startAt)}
                  </p>
                </div>
                <div className="rounded-[20px] bg-[#fffbff] p-4 dark:bg-[#141218]">
                  <p className="text-xs text-[#79747e] dark:text-[#938f99]">结束时间</p>
                  <p className="mt-1 text-sm font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                    {formatDateText(goal.endAt)}
                  </p>
                </div>
                <div className="rounded-[20px] bg-[#fffbff] p-4 dark:bg-[#141218]">
                  <p className="text-xs text-[#79747e] dark:text-[#938f99]">已投入</p>
                  <p className="mt-1 text-sm font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                    {formatRemainingTime(countdown.elapsedMs)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] bg-[#fffbff] p-5 dark:bg-[#141218]">
              <div className="mb-5 flex items-center gap-2">
                <Flag aria-hidden="true" className="size-5 text-[#6750a4] dark:text-[#d0bcff]" strokeWidth={2} />
                <h3 className="text-lg font-medium text-[#1d1b20] dark:text-[#e6e0e9]">目标设置</h3>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1 block text-xs text-[#49454f] dark:text-[#cac4d0]">目标名称</span>
                  <input
                    className="h-12 w-full rounded-[16px] border border-[#79747e] bg-transparent px-4 text-sm text-[#1d1b20] outline-none transition-colors focus:border-[#6750a4] focus:ring-2 focus:ring-[#6750a4] dark:border-[#938f99] dark:text-[#e6e0e9]"
                    onChange={(event) => updateGoal({ name: event.target.value })}
                    value={goal.name}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs text-[#49454f] dark:text-[#cac4d0]">开始时间</span>
                  <input
                    className="h-12 w-full rounded-[16px] border border-[#79747e] bg-transparent px-4 text-sm text-[#1d1b20] outline-none transition-colors focus:border-[#6750a4] focus:ring-2 focus:ring-[#6750a4] dark:border-[#938f99] dark:text-[#e6e0e9]"
                    onChange={(event) => updateGoal({ startAt: event.target.value })}
                    type="datetime-local"
                    value={goal.startAt}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs text-[#49454f] dark:text-[#cac4d0]">结束时间</span>
                  <input
                    className="h-12 w-full rounded-[16px] border border-[#79747e] bg-transparent px-4 text-sm text-[#1d1b20] outline-none transition-colors focus:border-[#6750a4] focus:ring-2 focus:ring-[#6750a4] dark:border-[#938f99] dark:text-[#e6e0e9]"
                    onChange={(event) => updateGoal({ endAt: event.target.value })}
                    type="datetime-local"
                    value={goal.endAt}
                  />
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[24px] bg-[#fffbff] p-6 text-center dark:bg-[#141218]">
            <Target aria-hidden="true" className="mb-4 size-10 text-[#6750a4] dark:text-[#d0bcff]" strokeWidth={1.8} />
            <h2 className="text-xl font-medium text-[#1d1b20] dark:text-[#e6e0e9]">暂无学习目标</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
              建立一个阶段目标后，倒计时和进度会在这里持续更新。
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
