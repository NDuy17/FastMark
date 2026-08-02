const OSRM_BASE_URL = String(process.env.OSRM_BASE_URL || "https://router.project-osrm.org").replace(
  /\/+$/,
  ""
);

function isValidCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= 180;
}

function formatCoordinate(lng, lat) {
  return `${Number(lng)},${Number(lat)}`;
}

function parseRoutePayload(payload, { overviewFull = true } = {}) {
  if (!payload || payload.code !== "Ok" || !payload.routes?.[0]) {
    return null;
  }

  const route = payload.routes[0];

  if (!overviewFull) {
    const distanceMeters = Number(route.distance);
    if (!Number.isFinite(distanceMeters)) {
      return null;
    }
    return { distanceMeters };
  }

  const coordinates = Array.isArray(route.geometry?.coordinates)
    ? route.geometry.coordinates
        .map((point) => [Number(point[1]), Number(point[0])])
        .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]))
    : [];

  if (coordinates.length < 2) {
    return null;
  }

  return {
    coordinates,
    distanceMeters: Number(route.distance) || 0,
    durationSeconds: Number(route.duration) || 0,
  };
}

async function requestOsrm(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(payload?.message || "Không tính được lộ trình.");
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

async function fetchRouteGeometry({ fromLat, fromLng, toLat, toLng }) {
  if (![fromLat, fromLng, toLat, toLng].every(isValidCoordinate)) {
    const error = new Error("Tọa độ không hợp lệ.");
    error.statusCode = 400;
    throw error;
  }

  const url =
    `${OSRM_BASE_URL}/route/v1/driving/` +
    `${formatCoordinate(fromLng, fromLat)};${formatCoordinate(toLng, toLat)}` +
    "?overview=full&geometries=geojson";

  const payload = await requestOsrm(url);
  return parseRoutePayload(payload, { overviewFull: true });
}

async function fetchRouteDistanceMeters({ fromLat, fromLng, toLat, toLng }) {
  if (![fromLat, fromLng, toLat, toLng].every(isValidCoordinate)) {
    const error = new Error("Tọa độ không hợp lệ.");
    error.statusCode = 400;
    throw error;
  }

  const url =
    `${OSRM_BASE_URL}/route/v1/driving/` +
    `${formatCoordinate(fromLng, fromLat)};${formatCoordinate(toLng, toLat)}` +
    "?overview=false";

  const payload = await requestOsrm(url);
  const parsed = parseRoutePayload(payload, { overviewFull: false });
  return parsed?.distanceMeters ?? null;
}

async function fetchRouteDistancesFromOrigin({ fromLat, fromLng, destinations = [] }) {
  if (!isValidCoordinate(fromLat) || !isValidCoordinate(fromLng)) {
    const error = new Error("Tọa độ xuất phát không hợp lệ.");
    error.statusCode = 400;
    throw error;
  }

  const validDestinations = destinations.filter(
    (item) => item?.id && isValidCoordinate(item.lat) && isValidCoordinate(item.lng)
  );

  if (validDestinations.length === 0) {
    return {};
  }

  if (validDestinations.length === 1) {
    const destination = validDestinations[0];
    const distanceMeters = await fetchRouteDistanceMeters({
      fromLat,
      fromLng,
      toLat: destination.lat,
      toLng: destination.lng,
    });
    return distanceMeters == null ? {} : { [String(destination.id)]: distanceMeters };
  }

  const coordinates = [
    formatCoordinate(fromLng, fromLat),
    ...validDestinations.map((item) => formatCoordinate(item.lng, item.lat)),
  ].join(";");
  const destinationIndices = validDestinations.map((_, index) => index + 1).join(";");
  const url =
    `${OSRM_BASE_URL}/table/v1/driving/${coordinates}` +
    `?sources=0&destinations=${destinationIndices}&annotations=distance`;

  const payload = await requestOsrm(url);
  if (!Array.isArray(payload?.distances?.[0])) {
    const result = {};
    await Promise.all(
      validDestinations.map(async (destination) => {
        const distanceMeters = await fetchRouteDistanceMeters({
          fromLat,
          fromLng,
          toLat: destination.lat,
          toLng: destination.lng,
        });
        if (distanceMeters != null) {
          result[String(destination.id)] = distanceMeters;
        }
      })
    );
    return result;
  }

  const result = {};
  validDestinations.forEach((destination, index) => {
    const distanceMeters = Number(payload.distances[0][index]);
    if (Number.isFinite(distanceMeters)) {
      result[String(destination.id)] = distanceMeters;
    }
  });
  return result;
}

module.exports = {
  fetchRouteGeometry,
  fetchRouteDistanceMeters,
  fetchRouteDistancesFromOrigin,
};
