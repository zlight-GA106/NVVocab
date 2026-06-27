import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CalendarClock,
  CheckCircle2,
  X,
  Flame,
  LoaderCircle,
  Target,
  TrendingUp,
  WalletCards,
  Zap,
} from 'lucide-react';
import {
  useDashboardStats,
  type DashboardImportEvent,
  type DashboardReviewEvent,
  type HeatmapDay,
} from '../hooks/useDashboardStats';
import { useNextReviewSchedule } from '../hooks/useNextReviewSchedule';
import { enableCramMode } from '../lib/cramMode';

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

type HeatmapGridCell = HeatmapDay | null;

type MonthLabel = {
  column: number;
  label: string;
};

type PeriodBattlePoint = {
  date: string;
  failed: number;
  imported: number;
  label: string;
  passed: number;
};

type RetentionTrendPoint = {
  date: string;
  label: string;
  masteredTotal: number;
  reviewLoad: number;
};

const millisecondsPerDay = 24 * 60 * 60 * 1000;
const trendWindowDays = 14;
const heatmapViewOptions: HeatmapViewOption[] = [
  { label: '年', value: 'year' },
  { label: '月', value: 'month' },
  { label: '周', value: 'week' },
];
const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日'];
const maxAutoReviewQuota = 100;
const cramNotificationDurationMs = 60_000;
const cramNotificationExitDurationMs = 180;
const reviewQuotaStorageKey = 'WORD_JIFFY_DAILY_REVIEW_QUOTA';
const m3PrimaryColor = 'rgb(var(--m3-primary))';
const m3PrimaryContainerColor = 'rgb(var(--m3-primary-container))';
const m3SecondaryColor = 'rgb(var(--m3-secondary))';
const m3TertiaryColor = 'rgb(var(--m3-tertiary))';
const m3ErrorColor = 'rgb(var(--m3-error))';
const chartGridColor = 'rgb(var(--m3-primary) / 0.13)';
const chartAxisColor = 'rgb(var(--m3-secondary) / 0.72)';
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

function triggerSubtleHapticFeedback(): void {
  window.navigator.vibrate?.(10);
}

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

function getEventIdentity(wordId: string | null, fallback: string): string {
  return wordId ?? fallback;
}

function buildPeriodBattleData(
  importEvents: DashboardImportEvent[],
  reviewEvents: DashboardReviewEvent[],
  startDate: Date,
  endDate: Date,
): PeriodBattlePoint[] {
  const range = buildRangeValues([], startDate, endDate);
  const importedByDate = new Map<string, number>();
  const passedByDate = new Map<string, Set<string>>();
  const failedByDate = new Map<string, Set<string>>();

  importEvents.forEach((event) => {
    importedByDate.set(event.date, (importedByDate.get(event.date) ?? 0) + 1);
  });

  reviewEvents.forEach((event) => {
    const targetMap = event.quality >= 3 ? passedByDate : failedByDate;
    const eventSet = targetMap.get(event.date) ?? new Set<string>();
    eventSet.add(getEventIdentity(event.wordId, event.reviewedAt));
    targetMap.set(event.date, eventSet);
  });

  return range.map((day) => ({
    date: day.date,
    failed: failedByDate.get(day.date)?.size ?? 0,
    imported: importedByDate.get(day.date) ?? 0,
    label: formatCompactDateLabel(day.date),
    passed: passedByDate.get(day.date)?.size ?? 0,
  }));
}

function buildRetentionTrendData(
  masteredWordIds: string[],
  reviewEvents: DashboardReviewEvent[],
): RetentionTrendPoint[] {
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (trendWindowDays - 1));
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const range = buildRangeValues([], startDate, endDate);
  const masteredWordSet = new Set(masteredWordIds);
  const successfulEventsByWord = new Map<string, DashboardReviewEvent[]>();
  const reviewLoadByDate = new Map<string, Set<string>>();

  reviewEvents.forEach((event) => {
    const eventDate = new Date(`${event.date}T00:00:00`);

    if (eventDate >= startDate && eventDate <= endDate) {
      const loadSet = reviewLoadByDate.get(event.date) ?? new Set<string>();
      loadSet.add(getEventIdentity(event.wordId, event.reviewedAt));
      reviewLoadByDate.set(event.date, loadSet);
    }

    if (!event.wordId || event.quality < 3 || !masteredWordSet.has(event.wordId)) {
      return;
    }

    const existingEvents = successfulEventsByWord.get(event.wordId) ?? [];
    successfulEventsByWord.set(event.wordId, [...existingEvents, event]);
  });

  const masteryDateByWord = new Map<string, string>();

  successfulEventsByWord.forEach((events, wordId) => {
    const orderedEvents = [...events].sort((first, second) => first.reviewedAt.localeCompare(second.reviewedAt));

    if (orderedEvents.length >= 3) {
      masteryDateByWord.set(wordId, orderedEvents[2].date);
    }
  });

  return range.map((day) => {
    const masteredTotal = masteredWordIds.reduce((total, wordId) => {
      const masteryDate = masteryDateByWord.get(wordId);

      if (!masteryDate || masteryDate <= day.date) {
        return total + 1;
      }

      return total;
    }, 0);

    return {
      date: day.date,
      label: formatCompactDateLabel(day.date),
      masteredTotal,
      reviewLoad: reviewLoadByDate.get(day.date)?.size ?? 0,
    };
  });
}

function M3ChartTooltip({ active, label, payload }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div
      className="rounded-[18px] border border-white/30 px-4 py-3 text-xs shadow-lg backdrop-blur-md dark:border-white/10"
      style={{
        backgroundColor: 'rgb(var(--m3-surface) / 0.88)',
      }}
    >
      <p className="mb-2 font-medium text-[#1d1b20] dark:text-[#e6e0e9]">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry) => {
          const value = typeof entry.value === 'number' ? entry.value : Number(entry.value ?? 0);
          const name = String(entry.name ?? entry.dataKey ?? '指标');

          return (
            <div className="flex items-center justify-between gap-4" key={`${name}-${entry.dataKey}`}>
              <span className="flex items-center gap-2 text-[#49454f] dark:text-[#cac4d0]">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ backgroundColor: entry.color ?? m3PrimaryColor }}
                />
                <span>{name}</span>
              </span>
              <span className="font-medium text-[#1d1b20] dark:text-[#e6e0e9]">{value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderM3ChartTooltip(props: TooltipContentProps) {
  return <M3ChartTooltip {...props} />;
}

function ChartLegend({ items }: { items: Array<{ color: string; label: string }> }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {items.map((item) => (
        <span className="inline-flex items-center gap-2 text-xs text-[#49454f] dark:text-[#cac4d0]" key={item.label}>
          <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  );
}

function PeriodBattleChart({ data }: { data: PeriodBattlePoint[] }) {
  return (
    <div
      className="flex min-h-[212px] flex-col rounded-[24px] border border-white/30 p-4 backdrop-blur-md dark:border-white/10"
      style={innerSurfaceStyle}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-[#1d1b20] dark:text-[#e6e0e9]">热力图详细看板</h3>
          <p className="mt-1 text-xs text-[#79747e] dark:text-[#938f99]">导入、通过与拼错的堆叠分布。</p>
        </div>
      </div>
      <ChartLegend
        items={[
          { color: m3PrimaryColor, label: '新词导入' },
          { color: m3SecondaryColor, label: '复习通过' },
          { color: m3ErrorColor, label: '拼写错误' },
        ]}
      />
      <div className="mt-3 min-h-0 flex-1">
        <ResponsiveContainer height={142} width="100%">
          <BarChart data={data} margin={{ bottom: 0, left: -18, right: 2, top: 6 }}>
            <CartesianGrid stroke={chartGridColor} strokeDasharray="4 6" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="label"
              interval={data.length > 12 ? 3 : 0}
              tick={{ fill: chartAxisColor, fontSize: 11 }}
              tickLine={false}
            />
            <YAxis allowDecimals={false} axisLine={false} tick={{ fill: chartAxisColor, fontSize: 11 }} tickLine={false} />
            <Tooltip content={renderM3ChartTooltip} cursor={{ fill: 'rgb(var(--m3-primary-container) / 0.28)' }} />
            <Bar dataKey="imported" fill={m3PrimaryColor} name="新词导入" radius={[0, 0, 6, 6]} stackId="battle" />
            <Bar dataKey="passed" fill={m3SecondaryColor} name="复习通过" stackId="battle" />
            <Bar dataKey="failed" fill={m3ErrorColor} name="拼写错误" radius={[6, 6, 0, 0]} stackId="battle" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function RetentionTrendChart({ data }: { data: RetentionTrendPoint[] }) {
  return (
    <div
      className="rounded-[24px] border border-white/30 p-5 backdrop-blur-md dark:border-white/10"
      style={innerSurfaceStyle}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{
              backgroundColor: m3PrimaryContainerColor,
              color: m3PrimaryColor,
            }}
          >
            <TrendingUp aria-hidden="true" className="size-5" strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-base font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
              记忆留存走势
            </h3>
            <p className="mt-1 text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
              过去 14 天掌握总量与每日复习负载。
            </p>
          </div>
        </div>
        <ChartLegend
          items={[
            { color: m3PrimaryColor, label: '掌握总量' },
            { color: m3SecondaryColor, label: '复习负载' },
          ]}
        />
      </div>
      <div className="h-[260px]">
        <ResponsiveContainer height="100%" width="100%">
          <LineChart data={data} margin={{ bottom: 0, left: -12, right: -4, top: 8 }}>
            <CartesianGrid stroke={chartGridColor} strokeDasharray="4 6" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="label"
              interval={1}
              tick={{ fill: chartAxisColor, fontSize: 11 }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tick={{ fill: chartAxisColor, fontSize: 11 }}
              tickLine={false}
              yAxisId="mastered"
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              orientation="right"
              tick={{ fill: chartAxisColor, fontSize: 11 }}
              tickLine={false}
              yAxisId="load"
            />
            <Tooltip content={renderM3ChartTooltip} />
            <Line
              dataKey="masteredTotal"
              dot={false}
              name="掌握总量"
              stroke={m3PrimaryColor}
              strokeWidth={3}
              type="monotone"
              yAxisId="mastered"
            />
            <Line
              dataKey="reviewLoad"
              dot={false}
              name="复习负载"
              stroke={m3SecondaryColor}
              strokeWidth={3}
              type="monotone"
              yAxisId="load"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    dailyWordTarget,
    dueWordsCount,
    endDate,
    errorMessage,
    heatmapValues,
    importEvents,
    loading,
    masteredCount,
    masteredWordIds,
    refresh: refreshDashboardStats,
    reviewEvents,
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
  const [showCramNotification, setShowCramNotification] = useState(false);
  const [isCramNotificationLeaving, setIsCramNotificationLeaving] = useState(false);

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

  const handleEnableCramMode = async () => {
    triggerSubtleHapticFeedback();
    enableCramMode();
    setShowCramNotification(true);
    setIsCramNotificationLeaving(false);
    void Promise.all([refreshDashboardStats(), nextReviewSchedule.refresh()]);
  };

  const dismissCramNotification = () => {
    if (!showCramNotification || isCramNotificationLeaving) {
      return;
    }

    triggerSubtleHapticFeedback();
    setIsCramNotificationLeaving(true);
  };

  useEffect(() => {
    if (!showCramNotification || isCramNotificationLeaving) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setIsCramNotificationLeaving(true);
    }, cramNotificationDurationMs);

    return () => window.clearTimeout(timeoutId);
  }, [isCramNotificationLeaving, showCramNotification]);

  useEffect(() => {
    if (!isCramNotificationLeaving) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setShowCramNotification(false);
      setIsCramNotificationLeaving(false);
    }, cramNotificationExitDurationMs);

    return () => window.clearTimeout(timeoutId);
  }, [isCramNotificationLeaving]);

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
  const periodBattleData = useMemo(
    () => buildPeriodBattleData(importEvents, reviewEvents, heatmapRange.startDate, heatmapRange.endDate),
    [heatmapRange.endDate, heatmapRange.startDate, importEvents, reviewEvents],
  );
  const retentionTrendData = useMemo(
    () => buildRetentionTrendData(masteredWordIds, reviewEvents),
    [masteredWordIds, reviewEvents],
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
    <div className="relative space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-[#6750a4] dark:text-[#d0bcff]">仪表板 Dashboard</p>
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

        {heatmapView === 'year' ? (
          <div className="dashboard-heatmap min-h-[172px] overflow-x-auto pb-2">
            <div className="min-w-[760px]">
              <YearHeatmap values={displayedHeatmapValues} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
            <div className="dashboard-heatmap flex min-h-[212px] items-center justify-center overflow-x-auto rounded-[24px] border border-white/30 p-4 backdrop-blur-md dark:border-white/10" style={innerSurfaceStyle}>
              <CompactHeatmap values={displayedHeatmapValues} />
            </div>
            <PeriodBattleChart data={periodBattleData} />
          </div>
        )}
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
                总概览
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
                      <Tooltip content={renderM3ChartTooltip} />
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

          <RetentionTrendChart data={retentionTrendData} />
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
                指挥部
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#49454f] dark:text-[#cac4d0]">
                用最少动作定位今天该做的事情
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
                    {reviewQuotaReached ? '今日目标已达成。' : '点击进入沉浸式默写。'}
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
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
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
                <button
                  aria-label="开启提前突击"
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[#f3edf7] dark:hover:bg-[#2b2930]"
                  onClick={() => void handleEnableCramMode()}
                  style={{ color: m3PrimaryColor }}
                  title="提前突击"
                  type="button"
                >
                  <Zap aria-hidden="true" className="size-5" strokeWidth={2} />
                </button>
              </div>
              <div className="mt-4 flex items-center justify-between gap-4 rounded-[18px] px-4 py-3" style={{ backgroundColor: 'rgb(var(--m3-surface) / 0.6)' }}>
                <span className="text-sm text-[#49454f] dark:text-[#cac4d0]">下一轮自动复习单词数</span>
                <span className="rounded-full px-3 py-1 text-sm font-medium" style={{ backgroundColor: m3PrimaryContainerColor, color: m3PrimaryColor }}>
                  {nextReviewSchedule.nextReviewWordCount} 词
                </span>
              </div>
            </div>

            {showCramNotification && (
              <button
                className="dashboard-cram-notice flex w-full items-start gap-3 overflow-hidden rounded-[24px] border border-white/40 p-4 text-left text-sm leading-6 shadow-sm backdrop-blur-md transition-[background-color,box-shadow,transform] duration-200 hover:bg-white/70 hover:shadow-md active:scale-[0.985] focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-white/10 dark:hover:bg-neutral-900/70"
                data-state={isCramNotificationLeaving ? 'leaving' : 'entered'}
                onClick={dismissCramNotification}
                style={{
                  backgroundColor: 'rgb(var(--m3-surface) / 0.78)',
                  color: '#1d1b20',
                  outlineColor: m3PrimaryColor,
                }}
                type="button"
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: m3PrimaryContainerColor,
                    color: m3PrimaryColor,
                  }}
                >
                  <Zap aria-hidden="true" className="size-5" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-[#1d1b20] dark:text-[#e6e0e9]">提前突击已开启</span>
                  <span className="mt-1 block text-[#49454f] dark:text-[#cac4d0]">
                    进入默写页会纳入未来 12 小时词条。点击此通知可关闭。
                  </span>
                </span>
                <X
                  aria-hidden="true"
                  className="mt-1 size-4 shrink-0 text-[#79747e] dark:text-[#938f99]"
                  strokeWidth={2}
                />
              </button>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div
                className="rounded-[24px] border border-white/30 p-5 backdrop-blur-md dark:border-white/10"
                style={innerSurfaceStyle}
              >
                <div className="space-y-3">
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
                    <p className="mt-1 text-2xl font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                      {streakDays} 天
                    </p>
                  </div>
                </div>
              </div>

              <div
                className="rounded-[24px] border border-white/30 p-5 backdrop-blur-md dark:border-white/10"
                style={innerSurfaceStyle}
              >
                <div className="mb-3">
                  <p className="text-sm text-[#49454f] dark:text-[#cac4d0]">今日新增</p>
                  <p className="mt-1 text-xl font-medium text-[#1d1b20] dark:text-[#e6e0e9]">
                    {dailyTargetText}
                  </p>
                </div>
                <p className="text-sm font-medium" style={{ color: m3PrimaryColor }}>
                  {dailyWordTarget > 0 ? formatPercent(dailyProgressPercent) : '未设置'}
                </p>
                <div
                  className="mt-3 h-3 overflow-hidden rounded-full"
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
          </div>
        </aside>
      </div>
    </div>
  );
}
