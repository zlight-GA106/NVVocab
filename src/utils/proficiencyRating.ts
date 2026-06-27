export type ProficiencyBand = 'new' | 'fragile' | 'learning' | 'steady' | 'mature';

export interface ProficiencySource {
  easiness: number | null;
  interval: number | null;
  next_review_at: string | null;
  repetitions: number | null;
  wrong_count: number | null;
}

export interface ProficiencyRating {
  band: ProficiencyBand;
  description: string;
  label: string;
  priority: number;
  score: number;
}

const matureIntervalDays = 21;
const defaultEasiness = 2.5;
const defaultInterval = 1;
const millisecondsPerDay = 24 * 60 * 60 * 1000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeNonNegativeInteger(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.trunc(value);
}

function normalizePositiveNumber(value: number | null | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return value;
}

function parseReviewTime(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function getDaysUntilReview(value: string | null, now: Date): number {
  const reviewTime = parseReviewTime(value);

  if (reviewTime <= 0) {
    return 0;
  }

  return (reviewTime - now.getTime()) / millisecondsPerDay;
}

function resolveBand(score: number, source: ProficiencySource): ProficiencyBand {
  const repetitions = normalizeNonNegativeInteger(source.repetitions);
  const interval = normalizePositiveNumber(source.interval, defaultInterval);
  const wrongCount = normalizeNonNegativeInteger(source.wrong_count);

  if (repetitions === 0) {
    return 'new';
  }

  if (wrongCount >= Math.max(2, repetitions) || score < 35) {
    return 'fragile';
  }

  if (interval >= matureIntervalDays && repetitions >= 3 && score >= 76) {
    return 'mature';
  }

  if (interval >= 7 && repetitions >= 2 && score >= 58) {
    return 'steady';
  }

  return 'learning';
}

function getBandLabel(band: ProficiencyBand): string {
  switch (band) {
    case 'new':
      return '全新';
    case 'fragile':
      return '薄弱';
    case 'learning':
      return '学习中';
    case 'steady':
      return '稳定';
    case 'mature':
      return '熟练';
  }
}

function getBandDescription(band: ProficiencyBand): string {
  switch (band) {
    case 'new':
      return '尚未形成稳定记忆';
    case 'fragile':
      return '错误压力较高，优先巩固';
    case 'learning':
      return '处于短间隔学习期';
    case 'steady':
      return '已进入中期复习间隔';
    case 'mature':
      return '达到长期记忆阈值';
  }
}

export function getWordProficiency(source: ProficiencySource, now: Date = new Date()): ProficiencyRating {
  const repetitions = normalizeNonNegativeInteger(source.repetitions);
  const interval = normalizePositiveNumber(source.interval, defaultInterval);
  const easiness = normalizePositiveNumber(source.easiness, defaultEasiness);
  const wrongCount = normalizeNonNegativeInteger(source.wrong_count);
  const daysUntilReview = getDaysUntilReview(source.next_review_at, now);

  const intervalScore = clamp(
    (Math.log2(interval + 1) / Math.log2(matureIntervalDays + 1)) * 45,
    0,
    45,
  );
  const repetitionScore = clamp(repetitions * 12, 0, 30);
  const easinessScore = clamp(((easiness - 1.3) / 1.7) * 20, 0, 20);
  const errorPenalty = clamp(wrongCount * 7, 0, 38);
  const overduePenalty = daysUntilReview <= 0 ? clamp(Math.abs(daysUntilReview) * 2, 0, 10) : 0;
  const rawScore = intervalScore + repetitionScore + easinessScore + 5 - errorPenalty - overduePenalty;
  const score = repetitions === 0 ? Math.min(18, Math.round(clamp(rawScore, 0, 100))) : Math.round(clamp(rawScore, 0, 100));
  const band = resolveBand(score, source);
  const duePressure = daysUntilReview <= 0 ? 35 + clamp(Math.abs(daysUntilReview) * 2.5, 0, 30) : clamp(18 - daysUntilReview * 1.5, 0, 18);
  const errorPressure = clamp(wrongCount * 8, 0, 32);
  const newPressure = repetitions === 0 ? 18 : 0;
  const priority = Math.round(clamp((100 - score) * 0.62 + duePressure + errorPressure + newPressure, 0, 100));

  return {
    band,
    description: getBandDescription(band),
    label: getBandLabel(band),
    priority,
    score,
  };
}

export function compareByAdaptiveProficiency<T extends ProficiencySource>(
  first: T,
  second: T,
  now: Date = new Date(),
): number {
  const firstRating = getWordProficiency(first, now);
  const secondRating = getWordProficiency(second, now);

  if (firstRating.priority !== secondRating.priority) {
    return secondRating.priority - firstRating.priority;
  }

  if (firstRating.score !== secondRating.score) {
    return firstRating.score - secondRating.score;
  }

  const firstReviewTime = parseReviewTime(first.next_review_at);
  const secondReviewTime = parseReviewTime(second.next_review_at);

  if (firstReviewTime !== secondReviewTime) {
    return firstReviewTime - secondReviewTime;
  }

  return normalizePositiveNumber(first.interval, defaultInterval) - normalizePositiveNumber(second.interval, defaultInterval);
}
