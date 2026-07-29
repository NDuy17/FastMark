import { useEffect, useState } from 'react';

export function useDebouncedSearch(initial = '', delay = 300) {
  const [input, setInput] = useState(initial);
  const [debounced, setDebounced] = useState(initial.trim());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(input.trim());
    }, delay);
    return () => window.clearTimeout(timer);
  }, [input, delay]);

  return { input, debounced, setInput };
}
