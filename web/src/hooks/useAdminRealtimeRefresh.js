import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useAuth } from '../context/AuthContext';
import { useAdminRealtimeSocket } from './useAdminRealtimeSocket';

function normalizeResources(resources) {
  const list = Array.isArray(resources) ? resources : [resources];
  return list.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean);
}

export function useAdminRealtimeRefresh(resources, onRefresh, { enabled = true } = {}) {
  const { getIdToken } = useAuth();
  const resourceList = useMemo(() => normalizeResources(resources), [resources]);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const handleEvent = useCallback(
    (payload) => {
      const type = String(payload?.type || '').trim().toLowerCase();
      if (!type) {
        return;
      }

      if (resourceList.includes('*') || resourceList.includes(type)) {
        onRefreshRef.current?.(payload);
      }
    },
    [resourceList]
  );

  useAdminRealtimeSocket({
    enabled,
    getIdToken,
    onEvent: handleEvent,
  });
}
