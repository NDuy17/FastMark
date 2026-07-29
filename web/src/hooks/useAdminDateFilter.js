import { useCallback, useMemo, useState } from 'react';

const EMPTY_QUERY_PARAMS = Object.freeze({});

export function useAdminDateFilter(initial = {}) {
  const [from, setFrom] = useState(initial.from ?? '');
  const [to, setTo] = useState(initial.to ?? '');
  const [preset, setPreset] = useState(initial.preset ?? 'all');

  const applyRange = useCallback((range, onAfterApply) => {
    setFrom(range.from || '');
    setTo(range.to || '');
    setPreset(range.preset || (!range.from && !range.to ? 'all' : 'custom'));
    onAfterApply?.();
  }, []);

  const resetRange = useCallback(() => {
    setFrom('');
    setTo('');
    setPreset('all');
  }, []);

  const queryParams = useMemo(() => {
    if (!from && !to) return EMPTY_QUERY_PARAMS;
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    return params;
  }, [from, to]);

  const reservationParams = useMemo(() => {
    if (!from && !to) return EMPTY_QUERY_PARAMS;
    const params = {};
    if (from) params.dateFrom = from;
    if (to) params.dateTo = to;
    return params;
  }, [from, to]);

  return {
    from,
    to,
    preset,
    applyRange,
    resetRange,
    queryParams,
    reservationParams,
  };
}
