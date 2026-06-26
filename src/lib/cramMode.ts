export const CRAM_MODE_STORAGE_KEY = 'WORD_JIFFY_CRAM_MODE';

const cramModeWindowHours = 12;
const millisecondsPerHour = 60 * 60 * 1000;

export function enableCramMode(): void {
  window.localStorage.setItem(CRAM_MODE_STORAGE_KEY, 'true');
}

export function clearCramMode(): void {
  window.localStorage.removeItem(CRAM_MODE_STORAGE_KEY);
}

export function isCramModeEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(CRAM_MODE_STORAGE_KEY) === 'true';
}

export function getCramModeCutoffDate(baseDate: Date = new Date()): Date {
  return new Date(baseDate.getTime() + cramModeWindowHours * millisecondsPerHour);
}
