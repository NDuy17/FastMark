import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createLeafletHtml, MAP_EVENT_SOURCE } from '../utils/leafletHtml';
import { hasValidLocation } from '../utils/geo';

const MAP_COMMAND_SOURCE = 'fastmark-map-command';

export default function LeafletMap({
  currentLocation,
  radiusCircle,
  recenterSignal,
  restaurants,
  onEvent,
}) {
  const iframeRef = useRef(null);
  const initialLocationRef = useRef(currentLocation);
  const hasCenteredRef = useRef(false);
  const [ready, setReady] = useState(false);

  const html = useMemo(
    () => createLeafletHtml({ currentLocation: initialLocationRef.current }),
    []
  );

  function sendCommand(command) {
    if (!ready || !iframeRef.current?.contentWindow) {
      return;
    }

    iframeRef.current.contentWindow.postMessage(
      { source: MAP_COMMAND_SOURCE, payload: command },
      '*'
    );
  }

  useEffect(() => {
    function handleMessage(event) {
      const message = event.data;

      if (message?.source === MAP_EVENT_SOURCE) {
        onEvent?.(message.payload);
      }
    }

    window.addEventListener('message', handleMessage);

    return () => window.removeEventListener('message', handleMessage);
  }, [onEvent]);

  useEffect(() => {
    if (!ready || !hasValidLocation(currentLocation)) {
      return;
    }

    sendCommand({
      type: 'location',
      location: currentLocation,
      recenter: !hasCenteredRef.current,
    });

    if (!hasCenteredRef.current) {
      hasCenteredRef.current = true;
    }
  }, [currentLocation, ready]);

  useEffect(() => {
    sendCommand({ type: 'showRestaurants', restaurants });
  }, [restaurants, ready]);

  useEffect(() => {
    sendCommand({
      type: 'radiusCircle',
      center: radiusCircle?.center ?? null,
      radius: radiusCircle?.radius ?? null,
    });
  }, [radiusCircle, ready]);

  useEffect(() => {
    if (recenterSignal > 0 && hasValidLocation(currentLocation)) {
      sendCommand({ type: 'recenter', location: currentLocation });
    }
  }, [recenterSignal, currentLocation, ready]);

  return (
    <View style={styles.container}>
      {/*
        react-native-webview is native-only here, so the web build renders the
        same Leaflet document through an iframe.
      */}
      {React.createElement('iframe', {
        title: 'Fastmark map',
        ref: iframeRef,
        srcDoc: html,
        style: styles.iframe,
        onLoad: () => setReady(true),
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  iframe: {
    borderWidth: 0,
    width: '100%',
    height: '100%',
  },
});
