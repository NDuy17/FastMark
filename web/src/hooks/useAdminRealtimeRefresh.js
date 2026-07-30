import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useAuth } from '../context/AuthContext';
import { useAdminRealtimeSocket } from './useAdminRealtimeSocket';

function normalizeResources(resources) {
  const list = Array.isArray(resources) ? resources : [resources];
  return list.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean);
}

/**
 * @param coalesceMs Gộp các event dồn dập trong khoảng này thành 1 lần refresh
 *                   (admin nhận event của toàn hệ thống nên rất dễ bị dồn).
 */
export function useAdminRealtimeRefresh(
  resources,
  onRefresh,
  { enabled = true, coalesceMs = 0 } = {}
) {
  const { getIdToken } = useAuth();
  const resourceList = useMemo(() => normalizeResources(resources), [resources]);
  const onRefreshRef = useRef(onRefresh);
  const coalesceTimerRef = useRef(null);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(
    () => () => {
      if (coalesceTimerRef.current) {
        clearTimeout(coalesceTimerRef.current);
        coalesceTimerRef.current = null;
      }
    },
    []
  );

  const handleEvent = useCallback(
    (payload) => {
      const type = String(payload?.type || '').trim().toLowerCase();
      if (!type) {
        return;
      }

      if (!resourceList.includes('*') && !resourceList.includes(type)) {
        return;
      }

      if (coalesceMs <= 0) {
        onRefreshRef.current?.(payload);
        return;
      }

      if (coalesceTimerRef.current) {
        return;
      }
      coalesceTimerRef.current = setTimeout(() => {
        coalesceTimerRef.current = null;
        onRefreshRef.current?.(payload);
      }, coalesceMs);
    },
    [coalesceMs, resourceList]
  );

  useAdminRealtimeSocket({
    enabled,
    getIdToken,
    onEvent: handleEvent,
  });
}
