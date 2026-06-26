import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Flame,
  LoaderCircle,
  Target,
  WalletCards,
} from 'lucide-react';
import { useDashboardStats, type HeatmapDay } from '../hooks/useDashboardStats';
import { useNextReviewSchedule } from '../hooks/useNextReviewSchedule';

type DistributionItem = {
  color: string;
  label: string;
  value: number;
};

type HeatmapView = 'year' | 'month' | 'week';
type ReviewQuotaInput = number | '';

type HeatmapViewOption = {
  label: string;
  value: HeatmapView;
};

const millisecondsPerDay = 24 * 60 * 60 * 1000;
const heatmapViewOptions: HeatmapViewOption[] = [
  { label: '年', value: 'year' },
  { label: '月', value: 'month' },
  { label: '周', value: 'week' },
];
const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日'];
const maxAutoReviewQuota = 100;
const reviewQuotaStorageKey = 'WORD_JIFFY_DAILY_REVIEW_QUOTA';
const m3PrimaryColor = 'rgb(var(--m3-primary))';
const m3PrimaryContainerColor = 'rgb(var(--m3-primary-container))';
const m3SecondaryColor = 'rgb(var(--m3-secondary))';
const m3TertiaryColor = 'rgb(var(--m3-tertiary))';
const surfaceStyle = {
  backgroundColor: 'rgb(var(--m3-surface) / 0.5)',
} satisfies CSSProperties;
const innerSurfaceStyle = {
  backgroundColor: 'rgb(var(--m3-surface) / 0.64)',
} satisfies CSSProperties;

function normalizeReviewQuotaInput(rawValue: string): ReviewQuotaInput {
  const trimmedValue = rawValue.trim();

  if (!trimmedValue) {
    return '';
  }

  const parsedValue = Number.parseInt(trimmedValue, 10);

  if (!Number.isFinite(parsedValue)) {
    return '';
  }

  return Math.max(1, parsedValue);
}

function readStoredReviewQuota(): ReviewQuotaInput {
  if (typeof window === 'undefined') {
    return '';
  }

  return normalizeReviewQuotaInput(window.localStorage.getItem(reviewQuotaStorageKey) ?? '');
}

type HeatmapGridCell = HeatmapDay | null;

type MonthLabel = {
  column: number;
  label: string;
};

function getHeatmapCellLevel(count: number): string {
  if (count >= 10) {
    return '4';
  }

  if (count >= 6) {
    return '3';
  }

  if (count >= 3) {
    return '2';
  }

  if (count > 0) {
    return '1';
  }

  return '0';
}

function getMondayFirstDayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function buildCalendarCells(values: HeatmapDay[]): HeatmapGridCell[] {
  if (values.length === 0) {
    return [];
  }

  const firstDate = new Date(`${values[0].date}T00:00:00`);
  const leadingBlankCount = getMondayFirstDayIndex(firstDate);
  const cells: HeatmapGridCell[] = [
    ...Array.from({ length: leadingBlankCount }, () => null),
    ...values,
  ];
  const trailingBlankCount = (7 - (cells.length % 7)) % 7;

  return [
    ...cells,
    ...Array.from({ length: trailingBlankCount }, () => null),
  ];
}

function buildYearMonthLabels(values: HeatmapDay[], leadingBlankCount: number): MonthLabel[] {
  return values.reduce<MonthLabel[]>((labels, value, index) => {
    const date = new Date(`${value.date}T00:00:00`);

    if (date.getDate() !== 1) {
      return labels;
    }

    return [
      ...labels,
      {
        column: Math.floor((leadingBlankCount + index) / 7) + 1,
        label: `${date.getMonth() + 1}月`,
      },
    ];
  }, []);
}

function formatCompactDateLabel(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function HeatmapCell({ day, sizeClass }: { day: HeatmapGridCell; sizeClass: string }) {
  if (!day) {
    return <span aria-hidden="true" className={sizeClass} />;
  }

  return (
    <span
      aria-label={`${day.date}，${day.count} 次复习`}
      className={`dashboard-heatmap-cell block rounded-[4px] ${sizeClass}`}
      data-level={getHeatmapCellLevel(day.count)}
      title={`${day.date}：${day.count} 次复习`}
    />
  );
}

function YearHeatmap({ values }: { values: HeatmapDay[] }) {
  const cells = buildCalendarCells(values);
  const firstDate = values[0] ? new Date(`${values[0].date}T00:00:00`) : new Date();
  const leadingBlankCount = getMondayFirstDayIndex(firstDate);
  const columnCount = Math.max(1, Math.ceil(cells.length / 7));
  const monthLabels = buildYearMonthLabels(values, leadingBlankCount);

  return (
    <div className="w-max">
      <div
        className="mb-3 grid gap-[3px] text-xs text-[#79747e] dark:text-[#938f99]"
        style={{ gridTemplateColumns: `repeat(${columnCount}, 12px)` }}
      >
        {monthLabels.map((monthLabel) => (
          <span
            className="relative whitespace-nowrap pb-2 before:absolute before:bottom-0 before:left-0 before:h-1.5 before:border-l before:border-[#79747e]/55 before:content-[''] dark:before:border-[#938f99]/55"
            key={`${monthLabel.label}-${monthLabel.column}`}
            style={{ gridColumn: `${monthLabel.column} / span 4` }}
          >
            {monthLabel.label}
          </span>
        ))}
      </div>
      <div
        className="grid grid-flow-col gap-[3px]"
        style={{
          gridAutoColumns: '12px',
          gridTemplateRows: 'repeat(7, 12px)',
        }}
      >
        {cells.map((day, index) => (
          <HeatmapCell day={day} key={day?.date ?? `blank-${index}`} sizeClass="size-3" />
        ))}
      </div>
    </div>
  );
}

function CompactHeatmap({ values }: { values: HeatmapDay[] }) {
  const cells = buildCalendarCells(values);
  const isWeekRange = values.length <= 7;
  const tickLabels = isWeekRange ? values.map((value) => formatCompactDateLabel(value.date)) : weekdayLabels;

  return (
    <div className="w-max">
      <div className="grid grid-cols-7 gap-2 text-center text-xs text-[#79747e] dark:text-[#938f99] sm:gap-3">
        {tickLabels.map((label, index) => (
          <span className="w-6 whitespace-nowrap" key={`${label}-${index}`}>
            {label}
          </span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-2 sm:gap-3">
        {tickLabels.map((label, index) => (
          <span
            aria-hidden="true"
            className="mx-auto h-2 border-l border-[#79747e]/55 dark:border-[#938f99]/55"
            key={`${label}-tick-${index}`}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-7 gap-2 sm:gap-3">
        {cells.map((day, index) => (
          <HeatmapCell day={day} key={day?.date ?? `blank-${index}`} sizeClass="size-5 sm:size-6" />
        ))}
      </div>
    </div>
  );
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getWeekStart(date: Date): Date {
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + mondayOffset);
}

function getWeekEnd(date: Date): Date {
  const weekStart = getWeekStart(date);
  return new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
}

function buildRangeValues(sourceValues: HeatmapDay[], startDate: Date, endDate: Date): HeatmapDay[] {
  const countsByDate = new Map(sourceValues.map((value) => [value.date, value.count]));
  const dayCount = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / millisecondsPerDay) + 1,
  );

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(startDate.getTime() + index * millisecondsPerDay);
    const dateKey = toDateKey(date);

    return {
      count: countsByDate.get(dateKey) ?? 0,
      date: dateKey,
    };
  });
}

function getHeatmapRange(view: HeatmapView, yearlyStartDate: Date, yearlyEndDate: Date) {
  const today = new Date();

  if (view === 'month') {
    return {
      endDate: getMonthEnd(today),
      startDate: getMonthStart(today),
    };
  }

  if (view === 'week') {
    return {
      endDate: getWeekEnd(today),
      startDate: getWeekStart(today),
    };
  }

  return {
    endDate: yearlyEndDate,
    startDate: yearlyStartDate,
  };
}

function getHeatmapTitle(view: HeatmapView): string {
  if (view === 'month') {
    return '月度复习热力图';
  }

  if (view === 'week') {
    return '本周复习热力图';
  }

  return '年度复习热力图';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    dailyWordTarget,
    dueWordsCount,
    endDate,
    errorMessage,
    heatmapValues,
    loading,
    masteredCount,
    startDate,
    streakDays,
    todayImportedCount,
    todayReviewedCount,
    totalWords,
    wordStatusDistribution,
  } = useDashboardStats();
  const nextReviewSchedule = useNextReviewSchedule();
  const [heatmapView, setHeatmapView] = useState<HeatmapView>('month');
  const [manualReviewQuota, setManualReviewQuota] = useState<ReviewQuotaInput>(() => readStoredReviewQuota());

  useEffect(() => {
    if (manualReviewQuota === '') {
      window.localStorage.removeItem(reviewQuotaStorageKey);
      return;
    }

    window.localStorage.setItem(reviewQuotaStorageKey, String(manualReviewQuota));
  }, [manualReviewQuota]);

  const handleManualReviewQuotaChange = (event: ChangeEvent<HTMLInputElement>) => {
    setManualReviewQuota(normalizeReviewQuotaInput(event.target.value));
  };

  const masteryPercent = totalWords > 0 ? (masteredCount / totalWords) * 100 : 0;
  const remainingWords = Math.max(totalWords - masteredCount, 0);
  const distributionData: DistributionItem[] = [
    { color: m3PrimaryColor, label: '全新词', value: wordStatusDistribution.newWords },
    { color: m3SecondaryColor, label: '记忆中', value: wordStatusDistribution.reviewing },
    { color: m3TertiaryColor, label: '长期记忆', value: wordStatusDistribution.mastered },
  ];
  const heatmapRange = useMemo(
    () => getHeatmapRange(heatmapView, startDate, endDate),
    [endDate, heatmapView, startDate],
  );
  const displayedHeatmapValues = useMemo(
    () => buildRangeValues(heatmapValues, heatmapRange.startDate, heatmapRange.endDate),
    [heatmapRange.endDate, heatmapRange.startDate, heatmapValues],
  );
  const reviewedDays = displayedHeatmapValues.filter((day) => day.count > 0).length;
  const totalReviews = displayedHeatmapValues.reduce((sum, day) => sum + day.count, 0);
  const dailyProgressPercent =
    dailyWordTarget > 0 ? Math.min(100, (todayImportedCount / dailyWordTarget) * 100) : 0;
  const dailyTargetText =
    dailyWordTarget > 0 ? `${todayImportedCount} / ${dailyWordTarget} 词` : `${todayImportedCount} 词`;
  const autoReviewQuota = Math.max(1, Math.min(maxAutoReviewQuota, todayReviewedCount + dueWordsCount));
  const effectiveReviewQuota = typeof manualReviewQuota === 'number' ? manualReviewQuota : autoReviewQuota;
  const reviewQuotaPercent = Math.min(100, (todayReviewedCount / effectiveReviewQuota) * 100);
  const reviewQuotaReached = todayReviewedCount >= effectiveReviewQuota;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-[#6750a4] dark:text-[#d0bcff]">备考 Dashboard</p>
        <h1 className="text-3xl font-normal text-[#1d1b20] dark:text-[#e6e0e9]">
          看得见的长期积累
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
          每一次默写都会沉淀为复习日志、词库状态和通关进度。
        </p>
      </header>

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
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: m3PrimaryContainerColor,
                color: m3PrimaryColor,
              }}
            >
              <Flame aria-hidden="true" className="size-5" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-xl font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                {getHeatmapTitle(heatmapView)}
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
                当前视图累计复习 {totalReviews} 次，活跃 {reviewedDays} 天。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-full border border-[#79747e] p-1 dark:border-[#938f99]">
              {heatmapViewOptions.map((option) => (
                <button
                  className={`h-9 rounded-full px-4 text-sm font-medium transition-colors ${
                    heatmapView === option.value
                      ? ''
                      : 'text-[#49454f] hover:bg-[#f3edf7] dark:text-[#cac4d0] dark:hover:bg-[#2b2930]'
                  }`}
                  key={option.value}
                  onClick={() => setHeatmapView(option.value)}
                  style={
                    heatmapView === option.value
                      ? {
                          backgroundColor: m3PrimaryContainerColor,
                          color: m3PrimaryColor,
                        }
                      : undefined
                  }
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-[#79747e] dark:text-[#938f99]">
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" strokeWidth={2} />
                <span>同步中</span>
              </div>
            )}
          </div>
        </div>

        <div className="dashboard-heatmap min-h-[172px] overflow-x-auto pb-2">
          {heatmapView === 'year' ? (
            <div className="min-w-[760px]">
              <YearHeatmap values={displayedHeatmapValues} />
            </div>
          ) : (
            <CompactHeatmap values={displayedHeatmapValues} />
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)]">
        <section
          className="space-y-5 rounded-[28px] border border-white/30 p-5 shadow-sm backdrop-blur-md dark:border-white/10 sm:p-6"
          style={surfaceStyle}
        >
          <div className="mb-5 flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: m3PrimaryContainerColor,
                color: m3PrimaryColor,
              }}
            >
              <WalletCards aria-hidden="true" className="size-5" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-xl font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                长期宏观战略
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
                词库状态、长期记忆占比和通关距离。
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(280px,0.96fr)_minmax(0,1.04fr)]">
            <div
              className="rounded-[24px] border border-white/30 p-5 backdrop-blur-md dark:border-white/10"
              style={innerSurfaceStyle}
            >
              <div className="mb-4">
                <h3 className="text-base font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                  词库状态分布
                </h3>
                <p className="mt-1 text-sm text-[#49454f] dark:text-[#cac4d0]">
                  按记忆阶段拆分当前词库。
                </p>
              </div>

              <div className="grid grid-cols-1 items-center gap-5 sm:grid-cols-[220px_minmax(0,1fr)] 2xl:grid-cols-1">
                <div className="h-[220px]">
                  <ResponsiveContainer height="100%" width="100%">
                    <PieChart>
                      <Pie
                        cx="50%"
                        cy="50%"
                        data={distributionData}
                        dataKey="value"
                        innerRadius={62}
                        nameKey="label"
                        outerRadius={92}
                        paddingAngle={3}
                      >
                        {distributionData.map((item) => (
                          <Cell fill={item.color} key={item.label} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`${value} 个词`, '数量']}
                        labelFormatter={() => '词库状态'}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3">
                  {distributionData.map((item) => (
                    <div className="flex items-center justify-between gap-4" key={item.label}>
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm text-[#49454f] dark:text-[#cac4d0]">
                          {item.label}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div
              className="rounded-[24px] border border-white/30 p-5 backdrop-blur-md dark:border-white/10"
              style={innerSurfaceStyle}
            >
              <div className="mb-8 flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: m3PrimaryContainerColor,
                    color: m3PrimaryColor,
                  }}
                >
                  <Target aria-hidden="true" className="size-5" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-base font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                    冲刺阶段进度
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
                    以长期记忆词作为通关口径。
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="mb-3 flex items-end justify-between gap-4">
                    <div>
                      <p
                        className="text-4xl font-medium"
                        style={{ color: m3PrimaryColor }}
                      >
                        {formatPercent(masteryPercent)}
                      </p>
                      <p className="mt-1 text-sm text-[#49454f] dark:text-[#cac4d0]">
                        已掌握 {masteredCount} / {totalWords} 词
                      </p>
                    </div>
                    <p className="text-right text-sm text-[#79747e] dark:text-[#938f99]">
                      距离通关还差 {remainingWords} 词
                    </p>
                  </div>
                  <div
                    className="h-3 overflow-hidden rounded-full"
                    style={{ backgroundColor: m3PrimaryContainerColor }}
                  >
                    <div
                      className="dashboard-progress-bar h-full rounded-full"
                      style={{
                        backgroundColor: m3PrimaryColor,
                        width: `${Math.min(100, masteryPercent)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: '总词量', value: totalWords },
                    { label: '已掌握', value: masteredCount },
                    { label: '剩余', value: remainingWords },
                  ].map((item) => (
                    <div
                      className="rounded-[20px] border border-white/30 p-4 dark:border-white/10"
                      key={item.label}
                      style={surfaceStyle}
                    >
                      <p className="text-xs text-[#79747e] dark:text-[#938f99]">{item.label}</p>
                      <p className="mt-1 text-xl font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside
          className="rounded-[28px] border border-white/30 p-5 shadow-sm backdrop-blur-md dark:border-white/10 sm:p-6"
          style={surfaceStyle}
        >
          <div className="mb-5 flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: m3PrimaryContainerColor,
                color: m3PrimaryColor,
              }}
            >
              <Calendar aria-hidden="true" className="size-5" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-xl font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                今日行动指挥部
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
                用最少动作定位今天该做的事情。
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <button
              className="group rounded-[24px] border p-5 text-left shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
              onClick={() => navigate('/dictate')}
              style={
                reviewQuotaReached
                  ? {
                      backgroundColor: 'rgb(var(--m3-primary-container))',
                      borderColor: m3PrimaryColor,
                      color: m3PrimaryColor,
                    }
                  : {
                      backgroundColor: 'rgb(var(--m3-surface) / 0.64)',
                      borderColor: 'rgb(255 255 255 / 0.3)',
                      color: 'rgb(var(--m3-primary))',
                    }
              }
              type="button"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">今日复习进度</p>
                  <p className="mt-3 text-4xl font-semibold leading-none">
                    {todayReviewedCount} / {effectiveReviewQuota}
                  </p>
                  <p className="mt-3 text-sm leading-6">
                    {reviewQuotaReached ? '今日战术任务已达成。' : '点击进入沉浸式默写。'}
                  </p>
                </div>
                {reviewQuotaReached ? (
                  <CheckCircle2 aria-hidden="true" className="size-6 shrink-0" strokeWidth={2} />
                ) : (
                  <ArrowRight
                    aria-hidden="true"
                    className="size-6 shrink-0 transition-transform group-hover:translate-x-1"
                    strokeWidth={2}
                  />
                )}
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full" style={{ backgroundColor: m3PrimaryContainerColor }}>
                <div
                  className="dashboard-progress-bar h-full rounded-full"
                  style={{
                    backgroundColor: m3PrimaryColor,
                    width: `${reviewQuotaPercent}%`,
                  }}
                />
              </div>
            </button>

            <div
              className="rounded-[24px] border border-white/30 p-5 backdrop-blur-md dark:border-white/10"
              style={innerSurfaceStyle}
            >
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#49454f] dark:text-[#cac4d0]">
                  今日复习配额
                </span>
                <div className="flex h-12 items-center rounded-[16px] border border-[#79747e] bg-transparent px-4 transition-colors focus-within:border-[#6750a4] focus-within:ring-2 focus-within:ring-[#6750a4] dark:border-[#938f99]">
                  <input
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#1d1b20] outline-none placeholder:text-[#79747e] dark:text-[#e6e0e9] dark:placeholder:text-[#938f99]"
                    inputMode="numeric"
                    min={1}
                    onChange={handleManualReviewQuotaChange}
                    placeholder={`自动 ${autoReviewQuota} 词`}
                    type="number"
                    value={manualReviewQuota}
                  />
                </div>
              </label>
              <p className="mt-2 text-xs leading-5 text-[#79747e] dark:text-[#938f99]">
                留空时根据今日已完成复习与剩余到期词自动计算，自动上限为 {maxAutoReviewQuota} 词。
              </p>
            </div>

            <div
              className="rounded-[24px] border border-white/30 p-5 backdrop-blur-md dark:border-white/10"
              style={innerSurfaceStyle}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: m3PrimaryContainerColor,
                    color: m3PrimaryColor,
                  }}
                >
                  <CalendarClock aria-hidden="true" className="size-5" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-[#49454f] dark:text-[#cac4d0]">下一轮复习时间：</p>
                  <p className="mt-1 text-xl font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                    {nextReviewSchedule.loading ? '正在计算' : nextReviewSchedule.countdownText}
                  </p>
                  <p className="mt-1 truncate text-xs text-[#79747e] dark:text-[#938f99]">
                    {nextReviewSchedule.reviewDateText}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-4 rounded-[18px] px-4 py-3" style={{ backgroundColor: 'rgb(var(--m3-surface) / 0.6)' }}>
                <span className="text-sm text-[#49454f] dark:text-[#cac4d0]">下一轮自动复习单词数</span>
                <span className="rounded-full px-3 py-1 text-sm font-medium" style={{ backgroundColor: m3PrimaryContainerColor, color: m3PrimaryColor }}>
                  {nextReviewSchedule.nextReviewWordCount} 词
                </span>
              </div>
            </div>

            <div
              className="rounded-[24px] border border-white/30 p-5 backdrop-blur-md dark:border-white/10"
              style={innerSurfaceStyle}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: m3PrimaryContainerColor,
                      color: m3PrimaryColor,
                    }}
                  >
                    <Flame aria-hidden="true" className="size-5" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-sm text-[#49454f] dark:text-[#cac4d0]">连续打卡</p>
                    <p className="mt-1 text-xl font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                      连续突击 {streakDays} 天
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="rounded-[24px] border border-white/30 p-5 backdrop-blur-md dark:border-white/10"
              style={innerSurfaceStyle}
            >
              <div className="mb-3 flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-[#49454f] dark:text-[#cac4d0]">今日新增</p>
                  <p className="mt-1 text-2xl font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                    {dailyTargetText}
                  </p>
                </div>
                <p className="text-sm font-medium" style={{ color: m3PrimaryColor }}>
                  {dailyWordTarget > 0 ? formatPercent(dailyProgressPercent) : '未设置'}
                </p>
              </div>
              <div
                className="h-3 overflow-hidden rounded-full"
                style={{ backgroundColor: m3PrimaryContainerColor }}
              >
                <div
                  className="dashboard-progress-bar h-full rounded-full"
                  style={{
                    backgroundColor: m3PrimaryColor,
                    width: `${dailyProgressPercent}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
