export type AnkiQuality = 0 | 1 | 2 | 3 | 4 | 5;

export interface AnkiCurrentState {
  easiness: number | null;
  interval: number | null;
  next_review_at?: string | null;
  repetitions: number | null;
}

export interface AnkiNextState {
  easiness: number;
  interval: number;
  next_review_at: string;
  repetitions: number;
}

const minimumEasiness = 1.3;
const defaultEasiness = 2.5;
const defaultInterval = 1;
const defaultRepetitions = 0;
const millisecondsPerDay = 24 * 60 * 60 * 1000;

function clampQuality(quality: number): AnkiQuality {
  if (!Number.isFinite(quality)) {
    return 0;
  }

  if (quality <= 0) {
    return 0;
  }

  if (quality >= 5) {
    return 5;
  }

  return Math.trunc(quality) as AnkiQuality;
}

function normalizePositiveNumber(value: number | null | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return value;
}

function normalizeNonNegativeInteger(value: number | null | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return Math.trunc(value);
}

function addDays(date: Date, days: number): string {
  return new Date(date.getTime() + days * millisecondsPerDay).toISOString();
}

// 该函数实现 Anki 经典 SM-2 分支，只做状态衍生，不读写外部环境。
export function calculateAnkiNextState(
  currentState: AnkiCurrentState,
  qualityInput: number,
  reviewedAt: Date = new Date(),
): AnkiNextState {
  const quality = clampQuality(qualityInput);
  const currentEasiness = normalizePositiveNumber(currentState.easiness, defaultEasiness);
  const currentInterval = normalizePositiveNumber(currentState.interval, defaultInterval);
  const currentRepetitions = normalizeNonNegativeInteger(currentState.repetitions, defaultRepetitions);

  if (quality < 3) {
    // 低于 3 分视为记忆失败，连续正确次数清零，间隔回到 1 天，并扣减简易度。
    const punishedEasiness = Math.max(minimumEasiness, currentEasiness - 0.2);

    return {
      easiness: Number(punishedEasiness.toFixed(2)),
      interval: 1,
      next_review_at: addDays(reviewedAt, 1),
      repetitions: 0,
    };
  }

  // SM-2 简易度公式：EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))。
  const qualityGap = 5 - quality;
  const nextEasiness = Math.max(
    minimumEasiness,
    currentEasiness + (0.1 - qualityGap * (0.08 + qualityGap * 0.02)),
  );
  const nextRepetitions = currentRepetitions + 1;
  let nextInterval: number;

  // Anki 经典学习阈值：首次成功为 1 天，第二次成功为 6 天，之后按 EF 指数递增。
  if (currentRepetitions === 0) {
    nextInterval = 1;
  } else if (currentRepetitions === 1) {
    nextInterval = 6;
  } else {
    nextInterval = Math.max(1, Math.round(currentInterval * nextEasiness));
  }

  return {
    easiness: Number(nextEasiness.toFixed(2)),
    interval: nextInterval,
    next_review_at: addDays(reviewedAt, nextInterval),
    repetitions: nextRepetitions,
  };
}
