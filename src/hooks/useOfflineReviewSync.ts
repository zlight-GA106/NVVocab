import { useCallback, useEffect, useState } from 'react';
import {
  getOfflineReviewQueueCount,
  OFFLINE_REVIEW_QUEUE_EVENT,
  syncOfflineReviewQueue,
} from '../lib/offlineReviewQueue';

type OfflineReviewSyncStatus = 'idle' | 'syncing' | 'error';

export function useOfflineReviewSync() {
  const [queueCount, setQueueCount] = useState(() => getOfflineReviewQueueCount());
  const [status, setStatus] = useState<OfflineReviewSyncStatus>('idle');
  const [message, setMessage] = useState('');

  const refreshQueueCount = useCallback(() => {
    setQueueCount(getOfflineReviewQueueCount());
  }, []);

  const syncQueue = useCallback(async () => {
    if (!window.navigator.onLine || getOfflineReviewQueueCount() === 0) {
      refreshQueueCount();
      return;
    }

    setStatus('syncing');
    setMessage('');

    const result = await syncOfflineReviewQueue();
    setQueueCount(result.remaining);

    if (result.errorMessage) {
      setStatus('error');
      setMessage(result.errorMessage);
      return;
    }

    setStatus('idle');
    setMessage(result.synced > 0 ? `已同步 ${result.synced} 条离线复习记录。` : '');
  }, [refreshQueueCount]);

  useEffect(() => {
    const handleOnline = () => {
      void syncQueue();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener(OFFLINE_REVIEW_QUEUE_EVENT, refreshQueueCount);
    const syncTimer = window.setTimeout(() => {
      void syncQueue();
    }, 0);

    return () => {
      window.clearTimeout(syncTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener(OFFLINE_REVIEW_QUEUE_EVENT, refreshQueueCount);
    };
  }, [refreshQueueCount, syncQueue]);

  return {
    message,
    queueCount,
    status,
    syncQueue,
  };
}
