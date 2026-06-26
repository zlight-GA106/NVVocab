import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addPrintQueueIds,
  clearPrintQueueIds,
  PRINT_QUEUE_CHANGED_EVENT,
  readPrintQueueIds,
  removePrintQueueId,
  togglePrintQueueId,
  writePrintQueueIds,
} from '../lib/printQueue';

type UsePrintQueueResult = {
  addMany: (ids: string[]) => void;
  clear: () => void;
  count: number;
  has: (id: string) => boolean;
  ids: string[];
  remove: (id: string) => void;
  replace: (ids: string[]) => void;
  toggle: (id: string) => void;
};

export function usePrintQueue(): UsePrintQueueResult {
  const [ids, setIds] = useState<string[]>(() => readPrintQueueIds());

  const refresh = useCallback(() => {
    setIds(readPrintQueueIds());
  }, []);

  useEffect(() => {
    window.addEventListener(PRINT_QUEUE_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);

    return () => {
      window.removeEventListener(PRINT_QUEUE_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);

  const idSet = useMemo(() => new Set(ids), [ids]);

  const addMany = useCallback((nextIds: string[]) => {
    setIds(addPrintQueueIds(nextIds));
  }, []);

  const clear = useCallback(() => {
    setIds(clearPrintQueueIds());
  }, []);

  const has = useCallback((id: string) => idSet.has(id), [idSet]);

  const remove = useCallback((id: string) => {
    setIds(removePrintQueueId(id));
  }, []);

  const replace = useCallback((nextIds: string[]) => {
    setIds(writePrintQueueIds(nextIds));
  }, []);

  const toggle = useCallback((id: string) => {
    setIds(togglePrintQueueId(id));
  }, []);

  return {
    addMany,
    clear,
    count: ids.length,
    has,
    ids,
    remove,
    replace,
    toggle,
  };
}
