'use client';

import { useEffect, useState } from 'react';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingSync, setPendingSync] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (pendingSync) {
        setPendingSync(false);
        // y-websocket handles reconnection automatically
        console.log('Back online — syncing pending changes...');
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setPendingSync(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingSync]);

  return { isOnline, pendingSync };
}
