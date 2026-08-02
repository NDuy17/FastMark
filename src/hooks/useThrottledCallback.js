import { useCallback, useEffect, useRef } from 'react';

/** Runs callback at most once per waitMs; always uses latest args. */
export function useThrottledCallback(callback, waitMs = 250) {
  const callbackRef = useRef(callback);
  const lastRunAtRef = useRef(0);
  const timerRef = useRef(null);
  const pendingArgsRef = useRef(null);

  callbackRef.current = callback;

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    []
  );

  return useCallback((...args) => {
    pendingArgsRef.current = args;
    const now = Date.now();
    const elapsed = now - lastRunAtRef.current;

    const flush = () => {
      timerRef.current = null;
      lastRunAtRef.current = Date.now();
      const pendingArgs = pendingArgsRef.current;
      pendingArgsRef.current = null;
      if (pendingArgs) {
        callbackRef.current(...pendingArgs);
      }
    };

    if (elapsed >= waitMs) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      flush();
      return;
    }

    if (timerRef.current) {
      return;
    }

    timerRef.current = setTimeout(flush, waitMs - elapsed);
  }, [waitMs]);
}
