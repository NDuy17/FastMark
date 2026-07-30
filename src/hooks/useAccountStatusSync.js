import { useCallback } from 'react';
import { useDispatch } from 'react-redux';

import { loadUserProfile } from '../viewmodel/auth/authSlice';
import { useResourceSocket } from './useResourceSocket';

/**
 * Realtime đồng bộ trạng thái khóa/mở nick và shop khi admin thao tác.
 */
export function useAccountStatusSync({ enabled = true } = {}) {
  const dispatch = useDispatch();

  const handleResourceUpdated = useCallback(
    (payload) => {
      const type = String(payload?.type || '').trim().toLowerCase();
      if (type === 'account' || type === 'shop') {
        dispatch(loadUserProfile());
      }
    },
    [dispatch]
  );

  useResourceSocket({
    enabled,
    onResourceUpdated: handleResourceUpdated,
  });
}
