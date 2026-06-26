export const PRINT_QUEUE_STORAGE_KEY = 'WORD_JIFFY_PRINT_QUEUE';
export const PRINT_QUEUE_CHANGED_EVENT = 'word-jiffy-print-queue-changed';
export const printQueueSelectionValue = '__print_queue_selection__';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function normalizeIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const normalizedIds: string[] = [];

  ids.forEach((id) => {
    const trimmedId = id.trim();

    if (!trimmedId || seen.has(trimmedId)) {
      return;
    }

    seen.add(trimmedId);
    normalizedIds.push(trimmedId);
  });

  return normalizedIds;
}

function notifyPrintQueueChanged(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(PRINT_QUEUE_CHANGED_EVENT));
}

export function readPrintQueueIds(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const rawValue = window.localStorage.getItem(PRINT_QUEUE_STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue);
    return isStringArray(parsedValue) ? normalizeIds(parsedValue) : [];
  } catch {
    return [];
  }
}

export function writePrintQueueIds(ids: string[]): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const normalizedIds = normalizeIds(ids);
  window.localStorage.setItem(PRINT_QUEUE_STORAGE_KEY, JSON.stringify(normalizedIds));
  notifyPrintQueueChanged();
  return normalizedIds;
}

export function addPrintQueueIds(ids: string[]): string[] {
  return writePrintQueueIds([...readPrintQueueIds(), ...ids]);
}

export function removePrintQueueId(id: string): string[] {
  return writePrintQueueIds(readPrintQueueIds().filter((queuedId) => queuedId !== id));
}

export function togglePrintQueueId(id: string): string[] {
  const currentIds = readPrintQueueIds();

  if (currentIds.includes(id)) {
    return writePrintQueueIds(currentIds.filter((queuedId) => queuedId !== id));
  }

  return writePrintQueueIds([...currentIds, id]);
}

export function clearPrintQueueIds(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  window.localStorage.removeItem(PRINT_QUEUE_STORAGE_KEY);
  notifyPrintQueueChanged();
  return [];
}
