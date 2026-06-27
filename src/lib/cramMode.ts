export const CRAM_MODE_STORAGE_KEY = 'WORD_JIFFY_CRAM_MODE';
export const CRAM_MODE_CUTOFF_STORAGE_KEY = 'WORD_JIFFY_CRAM_MODE_CUTOFF';

const cramModeWindowHours = 12;
const millisecondsPerHour = 60 * 60 * 1000;
const cutoffPaddingMilliseconds = 60 * 1000;

function normalizeCutoffDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function enableCramMode(cutoffIso?: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(CRAM_MODE_STORAGE_KEY, 'true');

  const cutoffDate = normalizeCutoffDate(cutoffIso);
  if (cutoffDate) {
    window.localStorage.setItem(
      CRAM_MODE_CUTOFF_STORAGE_KEY,
      new Date(cutoffDate.getTime() + cutoffPaddingMilliseconds).toISOString(),
    );
    return;
  }

  window.localStorage.removeItem(CRAM_MODE_CUTOFF_STORAGE_KEY);
}

export function clearCramMode(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(CRAM_MODE_STORAGE_KEY);
  window.localStorage.removeItem(CRAM_MODE_CUTOFF_STORAGE_KEY);
}

export function isCramModeEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(CRAM_MODE_STORAGE_KEY) === 'true';
}

export function getCramModeCutoffDate(baseDate: Date = new Date()): Date {
  const defaultCutoffDate = new Date(baseDate.getTime() + cramModeWindowHours * millisecondsPerHour);

  if (typeof window === 'undefined') {
    return defaultCutoffDate;
  }

  const storedCutoffDate = normalizeCutoffDate(window.localStorage.getItem(CRAM_MODE_CUTOFF_STORAGE_KEY));
  if (!storedCutoffDate || storedCutoffDate.getTime() <= baseDate.getTime()) {
    return defaultCutoffDate;
  }

  return storedCutoffDate;
}
