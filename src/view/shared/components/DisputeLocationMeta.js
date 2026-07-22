import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { reverseGeocodeLocation } from '../../../viewmodel/map/mapViewModel';

/**
 * Hiện GPS + địa chỉ (ưu tiên address đã lưu, fallback reverse-geocode).
 */
export default function DisputeLocationMeta({
  latitude,
  longitude,
  address: storedAddress = '',
  style,
  createdAtLabel = '',
}) {
  const [resolvedAddress, setResolvedAddress] = useState(storedAddress || '');
  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasGps = Number.isFinite(lat) && Number.isFinite(lng);

  useEffect(() => {
    setResolvedAddress(storedAddress || '');
    if (storedAddress || !hasGps) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const label = await reverseGeocodeLocation(lat, lng);
        if (!cancelled && label) {
          setResolvedAddress(label);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasGps, lat, lng, storedAddress]);

  if (!hasGps && !resolvedAddress && !createdAtLabel) {
    return null;
  }

  return (
    <>
      {hasGps ? (
        <Text style={style}>
          GPS: {lat.toFixed(5)}, {lng.toFixed(5)}
        </Text>
      ) : null}
      {resolvedAddress ? <Text style={style}>Địa chỉ: {resolvedAddress}</Text> : null}
      {!resolvedAddress && hasGps ? <Text style={style}>Đang lấy địa chỉ…</Text> : null}
      {createdAtLabel ? <Text style={style}>{createdAtLabel}</Text> : null}
    </>
  );
}
