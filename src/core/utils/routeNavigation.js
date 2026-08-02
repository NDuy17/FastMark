import { calculateDistanceMeters, hasValidLocation } from './geo';

const EARTH_RADIUS_METERS = 6371000;

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function projectPointOnSegment(point, start, end) {
  const lat1 = toRadians(start.latitude);
  const lng1 = toRadians(start.longitude);
  const lat2 = toRadians(end.latitude);
  const lng2 = toRadians(end.longitude);
  const latP = toRadians(point.latitude);
  const lngP = toRadians(point.longitude);

  const dx = lat2 - lat1;
  const dy = lng2 - lng1;

  if (Math.abs(dx) < 1e-12 && Math.abs(dy) < 1e-12) {
    return {
      point: { latitude: start.latitude, longitude: start.longitude },
      t: 0,
    };
  }

  const t = Math.max(
    0,
    Math.min(1, ((latP - lat1) * dx + (lngP - lng1) * dy) / (dx * dx + dy * dy))
  );

  return {
    point: {
      latitude: start.latitude + t * (end.latitude - start.latitude),
      longitude: start.longitude + t * (end.longitude - start.longitude),
    },
    t,
  };
}

function polylineLengthMeters(coords) {
  if (!Array.isArray(coords) || coords.length < 2) {
    return 0;
  }

  let total = 0;
  for (let index = 1; index < coords.length; index += 1) {
    const segment = calculateDistanceMeters(
      { latitude: coords[index - 1][0], longitude: coords[index - 1][1] },
      { latitude: coords[index][0], longitude: coords[index][1] }
    );
    if (Number.isFinite(segment)) {
      total += segment;
    }
  }
  return total;
}

export function findNearestSegmentIndex(point, coords, hintIndex = 0) {
  if (!hasValidLocation(point) || !Array.isArray(coords) || coords.length < 2) {
    return { segmentIndex: 0, projectedPoint: null, distanceMeters: null };
  }

  const safeHint = Math.max(0, Math.min(Number(hintIndex) || 0, coords.length - 2));
  const windowStart = Math.max(0, safeHint - 10);
  const windowEnd = Math.min(coords.length - 2, safeHint + 45);

  let bestSegmentIndex = safeHint;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestProjectedPoint = null;

  function scanRange(start, end) {
    for (let index = start; index <= end; index += 1) {
      const startPoint = { latitude: coords[index][0], longitude: coords[index][1] };
      const endPoint = { latitude: coords[index + 1][0], longitude: coords[index + 1][1] };
      const projection = projectPointOnSegment(point, startPoint, endPoint);
      const distanceMeters = calculateDistanceMeters(point, projection.point);

      if (distanceMeters != null && distanceMeters < bestDistance) {
        bestDistance = distanceMeters;
        bestSegmentIndex = index;
        bestProjectedPoint = projection.point;
      }
    }
  }

  scanRange(windowStart, windowEnd);

  // GPS nhảy xa khỏi cửa sổ hint → quét lại toàn tuyến.
  if (!Number.isFinite(bestDistance) || bestDistance > 120) {
    bestSegmentIndex = 0;
    bestDistance = Number.POSITIVE_INFINITY;
    bestProjectedPoint = null;
    scanRange(0, coords.length - 2);
  }

  return {
    segmentIndex: bestSegmentIndex,
    projectedPoint: bestProjectedPoint,
    distanceMeters: Number.isFinite(bestDistance) ? bestDistance : null,
  };
}

export function distancePointToPolylineMeters(point, coords) {
  const nearest = findNearestSegmentIndex(point, coords);
  return nearest.distanceMeters;
}

export function trimPolylineAhead(point, coords) {
  if (!hasValidLocation(point) || !Array.isArray(coords) || coords.length === 0) {
    return [];
  }

  if (coords.length === 1) {
    return [[point.latitude, point.longitude]];
  }

  const nearest = findNearestSegmentIndex(point, coords);
  const projected = nearest.projectedPoint || {
    latitude: point.latitude,
    longitude: point.longitude,
  };

  const ahead = coords.slice(nearest.segmentIndex + 1);
  return [[projected.latitude, projected.longitude], ...ahead];
}

export function computeRemainingRouteStats(point, coords, totalDistanceMeters, totalDurationSeconds) {
  const trimmed = trimPolylineAhead(point, coords);
  const remainingDistanceMeters = polylineLengthMeters(trimmed);
  const totalDistance = Number(totalDistanceMeters);
  const totalDuration = Number(totalDurationSeconds);

  let remainingDurationSeconds = totalDuration;
  if (Number.isFinite(totalDistance) && totalDistance > 0 && Number.isFinite(totalDuration)) {
    remainingDurationSeconds = Math.max(
      0,
      Math.round((remainingDistanceMeters / totalDistance) * totalDuration)
    );
  }

  return {
    coordinates: trimmed,
    distanceMeters: remainingDistanceMeters,
    durationSeconds: remainingDurationSeconds,
  };
}

export function shouldRerouteRoute(offRouteMeters, threshold = 30) {
  return Number.isFinite(offRouteMeters) && offRouteMeters > threshold;
}

export function hasArrivedAtDestination(point, destination, threshold = 20) {
  if (!hasValidLocation(point) || !hasValidLocation(destination)) {
    return false;
  }

  const distanceMeters = calculateDistanceMeters(point, destination);
  return distanceMeters != null && distanceMeters <= threshold;
}
