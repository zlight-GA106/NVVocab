import { useCallback, useEffect, useMemo, useState } from 'react';

export type LearningGoalStatus = 'active' | 'interrupted';

export type LearningGoal = {
  endAt: string;
  interruptedAt: string | null;
  name: string;
  startAt: string;
  status: LearningGoalStatus;
};

export type LearningGoalCountdown = {
  elapsedMs: number;
  isFinished: boolean;
  progressPercent: number;
  remainingMs: number;
  totalMs: number;
};

type LearningGoalPatch = Partial<Pick<LearningGoal, 'endAt' | 'name' | 'startAt'>>;

const learningGoalStorageKey = 'WORD_JIFFY_LEARNING_GOAL';
const millisecondsPerMinute = 60 * 1000;
const millisecondsPerDay = 24 * 60 * 60 * 1000;
const defaultGoalDays = 90;

function toDatetimeLocalValue(date: Date): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * millisecondsPerMinute);
  return localDate.toISOString().slice(0, 16);
}

function parseGoalDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeDatetimeLocalValue(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const date = parseGoalDate(value);
  return date ? toDatetimeLocalValue(date) : fallback;
}

function createDefaultLearningGoal(): LearningGoal {
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + defaultGoalDays * millisecondsPerDay);

  return {
    endAt: toDatetimeLocalValue(endDate),
    interruptedAt: null,
    name: 'CET4 冲刺',
    startAt: toDatetimeLocalValue(startDate),
    status: 'active',
  };
}

function sanitizeStoredGoal(value: unknown): LearningGoal | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const fallback = createDefaultLearningGoal();
  const record = value as Record<string, unknown>;
  const status: LearningGoalStatus = record.status === 'interrupted' ? 'interrupted' : 'active';
  const interruptedDate =
    status === 'interrupted' && typeof record.interruptedAt === 'string'
      ? parseGoalDate(record.interruptedAt)
      : null;

  return {
    endAt: normalizeDatetimeLocalValue(record.endAt, fallback.endAt),
    interruptedAt: interruptedDate ? interruptedDate.toISOString() : null,
    name: typeof record.name === 'string' ? record.name : fallback.name,
    startAt: normalizeDatetimeLocalValue(record.startAt, fallback.startAt),
    status,
  };
}

function readLearningGoal(): LearningGoal | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedValue = window.localStorage.getItem(learningGoalStorageKey);

  if (!storedValue) {
    return null;
  }

  try {
    return sanitizeStoredGoal(JSON.parse(storedValue));
  } catch {
    return null;
  }
}

function writeLearningGoal(goal: LearningGoal | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!goal) {
    window.localStorage.removeItem(learningGoalStorageKey);
    return;
  }

  window.localStorage.setItem(learningGoalStorageKey, JSON.stringify(goal));
}

function sanitizeGoalUpdate(goal: LearningGoal): LearningGoal {
  return {
    endAt: goal.endAt,
    interruptedAt: null,
    name: goal.name,
    startAt: goal.startAt,
    status: 'active',
  };
}

function getEffectiveNow(goal: LearningGoal, now: Date): Date {
  if (goal.status !== 'interrupted') {
    return now;
  }

  return parseGoalDate(goal.interruptedAt) ?? now;
}

function buildCountdown(goal: LearningGoal | null, now: Date): LearningGoalCountdown {
  if (!goal) {
    return {
      elapsedMs: 0,
      isFinished: false,
      progressPercent: 0,
      remainingMs: 0,
      totalMs: 0,
    };
  }

  const startDate = parseGoalDate(goal.startAt);
  const endDate = parseGoalDate(goal.endAt);

  if (!startDate || !endDate) {
    return {
      elapsedMs: 0,
      isFinished: false,
      progressPercent: 0,
      remainingMs: 0,
      totalMs: 0,
    };
  }

  const effectiveNow = getEffectiveNow(goal, now);
  const totalMs = Math.max(endDate.getTime() - startDate.getTime(), 0);
  const elapsedMs =
    totalMs > 0 ? Math.min(Math.max(effectiveNow.getTime() - startDate.getTime(), 0), totalMs) : 0;
  const remainingMs = Math.max(endDate.getTime() - effectiveNow.getTime(), 0);
  const progressPercent = totalMs > 0 ? (elapsedMs / totalMs) * 100 : 0;

  return {
    elapsedMs,
    isFinished: effectiveNow.getTime() >= endDate.getTime(),
    progressPercent,
    remainingMs,
    totalMs,
  };
}

export function formatRemainingTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${days}天 ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function useLearningGoal() {
  const [goal, setGoal] = useState<LearningGoal | null>(() => readLearningGoal());
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const createGoal = useCallback(() => {
    const nextGoal = createDefaultLearningGoal();
    setGoal(nextGoal);
    writeLearningGoal(nextGoal);
  }, []);

  const deleteGoal = useCallback(() => {
    setGoal(null);
    writeLearningGoal(null);
  }, []);

  const interruptGoal = useCallback(() => {
    setGoal((currentGoal) => {
      if (!currentGoal) {
        return null;
      }

      const nextGoal: LearningGoal = {
        ...currentGoal,
        interruptedAt: new Date().toISOString(),
        status: 'interrupted',
      };

      writeLearningGoal(nextGoal);
      return nextGoal;
    });
  }, []);

  const updateGoal = useCallback((patch: LearningGoalPatch) => {
    setGoal((currentGoal) => {
      const nextGoal = sanitizeGoalUpdate({
        ...(currentGoal ?? createDefaultLearningGoal()),
        ...patch,
      });

      writeLearningGoal(nextGoal);
      return nextGoal;
    });
  }, []);

  const countdown = useMemo(() => buildCountdown(goal, now), [goal, now]);

  return {
    countdown,
    createGoal,
    deleteGoal,
    goal,
    interruptGoal,
    updateGoal,
  };
}
