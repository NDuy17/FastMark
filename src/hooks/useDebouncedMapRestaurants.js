import { useEffect, useMemo, useRef } from 'react';

import { buildMapRestaurantsSignature } from '../core/utils/mapMarkerPayload';

const MAP_RESTAURANTS_DEBOUNCE_MS = 150;

/** Debounce + dedupe restaurant payloads sent into the Leaflet WebView. */
export function useDebouncedMapRestaurants(restaurants, ready, sendCommand) {
  const restaurantsRef = useRef(restaurants);
  restaurantsRef.current = restaurants;

  const sendCommandRef = useRef(sendCommand);
  sendCommandRef.current = sendCommand;

  const signature = useMemo(() => buildMapRestaurantsSignature(restaurants), [restaurants]);
  const lastSentSignatureRef = useRef('');

  useEffect(() => {
    if (!ready) {
      lastSentSignatureRef.current = '';
      return undefined;
    }

    if (signature === lastSentSignatureRef.current) {
      return undefined;
    }

    const timer = setTimeout(() => {
      lastSentSignatureRef.current = signature;
      sendCommandRef.current({
        type: 'showRestaurants',
        restaurants: restaurantsRef.current,
      });
    }, MAP_RESTAURANTS_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [ready, signature]);
}
