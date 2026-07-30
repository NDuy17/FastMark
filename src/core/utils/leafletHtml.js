const DEFAULT_LOCATION = {
  latitude: 10.7769,
  longitude: 106.7009,
};

const MAP_EVENT_SOURCE = 'fastmark-map';
export const LEAFLET_HTML_REVISION = 26;

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function createLeafletHtml({ currentLocation = null } = {}) {
  const initialLocation = currentLocation || DEFAULT_LOCATION;
  const initialData = safeJson({ currentLocation: initialLocation });

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html,
      body,
      #map {
        height: 100%;
        width: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: #eef2f0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .leaflet-container {
        background: #eef2f0;
      }

      .leaflet-control-attribution {
        display: none !important;
      }

      .user-marker {
        position: relative;
        width: 28px;
        height: 28px;
        border-radius: 999px;
        background: #076F32;
        border: 4px solid #ffffff;
        box-shadow: 0 8px 24px rgba(15, 118, 110, 0.3);
      }

      .user-marker::after {
        content: "";
        position: absolute;
        inset: 7px;
        border-radius: 999px;
        background: #f7c948;
      }

      .location-pin {
        position: relative;
        width: 28px;
        height: 36px;
        filter: drop-shadow(0 4px 8px rgba(220, 38, 38, 0.35));
      }

      .location-pin svg,
      .scan-marker svg {
        width: 28px;
        height: 36px;
        display: block;
      }

      .scan-marker {
        position: relative;
        width: 28px;
        height: 36px;
        filter: drop-shadow(0 4px 8px rgba(37, 99, 235, 0.35));
      }

      .shop-marker {
        position: relative;
        width: 28px;
        height: 36px;
        box-sizing: border-box;
      }

      .shop-marker svg {
        width: 28px;
        height: 36px;
        display: block;
        overflow: visible;
        filter: drop-shadow(0 3px 8px rgba(13, 115, 119, 0.35));
      }

      .shop-marker-card {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        width: max-content;
        max-width: 118px;
        pointer-events: auto;
        touch-action: manipulation;
        filter: drop-shadow(0 4px 9px rgba(15, 23, 42, 0.16));
      }

      .shop-marker-card-inner {
        display: flex;
        align-items: center;
        width: 112px;
        min-height: 42px;
        box-sizing: border-box;
        padding: 5px 8px;
        border-radius: 13px;
        background: #ffffff;
        border: 1px solid rgba(15, 23, 42, 0.06);
      }

      .shop-marker-meta {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .shop-marker-name {
        font-size: 11px;
        font-weight: 800;
        line-height: 1.18;
        color: #0f172a;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow: hidden;
        max-width: 96px;
      }

      .shop-marker-rating {
        display: flex;
        align-items: center;
        gap: 2px;
        font-size: 9px;
        font-weight: 700;
        line-height: 1.2;
        color: #64748b;
      }

      .shop-marker-star {
        color: #f59e0b;
        font-size: 10px;
        line-height: 1;
      }

      .shop-marker-distance {
        color: #16a34a;
        font-weight: 800;
      }

      .shop-marker-pointer {
        position: relative;
        width: 9px;
        height: 9px;
        margin-top: 7px;
        border-radius: 999px;
        background: #16a34a;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 6px rgba(7, 111, 50, 0.35);
      }

      .shop-marker-pointer::before {
        content: "";
        position: absolute;
        left: 50%;
        top: -11px;
        width: 0;
        height: 0;
        transform: translateX(-50%);
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 10px solid #ffffff;
        filter: drop-shadow(0 2px 1px rgba(15, 23, 42, 0.08));
      }

      .shop-marker-pointer-closed {
        background: #94a3b8;
        box-shadow: 0 2px 6px rgba(100, 116, 139, 0.3);
      }

      .fastmark-restaurant-icon {
        background: transparent !important;
        border: none !important;
      }

      .fastmark-restaurant-icon .shop-marker,
      .fastmark-restaurant-icon .shop-marker-card {
        pointer-events: auto;
        touch-action: manipulation;
      }

      .leaflet-bottom.leaflet-right {
        margin-bottom: 154px;
      }

      .leaflet-bottom.leaflet-left {
        margin-bottom: 72px;
      }

      .leaflet-control-zoom {
        border: none;
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.18);
      }

      .destination-marker {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border-radius: 999px;
        border: 3px solid #ffffff;
        background: #dc2626;
        color: #ffffff;
        font-size: 18px;
        box-shadow: 0 6px 16px rgba(220, 38, 38, 0.35);
      }

      .restaurant-marker {
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        border-radius: 999px;
        border: 2px solid #ffffff;
        color: #ffffff;
        font-size: 16px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
      }
      .marker-cafe { background: #d97706; }
      .marker-food { background: #e11d48; }
      .marker-milktea { background: #8b5cf6; }
      .marker-snack { background: #076F32; }

      .fastmark-restaurant-icon .restaurant-marker {
        pointer-events: auto;
        touch-action: manipulation;
      }

      .view-store-btn {
        display: block;
        width: 100%;
        margin-top: 10px;
        padding: 10px 12px;
        border: none;
        border-radius: 8px;
        background: #076F32;
        color: #ffffff;
        font-size: 13px;
        font-weight: 800;
        font-family: sans-serif;
        cursor: pointer;
        touch-action: manipulation;
      }

      .view-store-btn:active {
        opacity: 0.85;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const EVENT_SOURCE = '${MAP_EVENT_SOURCE}';
      const initialData = ${initialData};
      const fallbackLocation = ${safeJson(DEFAULT_LOCATION)};

      let currentMarker = null;
      let accuracyCircle = null;
      let radiusCircleLayer = null;
      let activeRadiusMeters = null;
      let userMovedMap = false;
      const restaurantMarkerById = {};
      let routeLayer = null;
      let destinationMarker = null;
      let activeRouteDestination = null;
      let scanMarker = null;
      let lastMapTap = null;

      function hasLocation(value) {
        return (
          value &&
          Number.isFinite(Number(value.latitude)) &&
          Number.isFinite(Number(value.longitude))
        );
      }

      function getLatLng(location) {
        return [Number(location.latitude), Number(location.longitude)];
      }

      function toLocation(latLng) {
        return {
          latitude: Number(latLng.lat),
          longitude: Number(latLng.lng),
        };
      }

      function postToApp(payload) {
        const message = { source: EVENT_SOURCE, payload };

        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
          return;
        }

        window.parent.postMessage(message, '*');
      }

      function openRestaurant(restaurant) {
        if (!restaurant || restaurant.id == null) {
          return;
        }

        postToApp({
          type: 'restaurantTap',
          restaurant: {
            id: String(restaurant.id),
            name: restaurant.name || '',
          },
        });
      }

      const startLocation = hasLocation(initialData.currentLocation)
        ? initialData.currentLocation
        : fallbackLocation;

      function escapeHtmlAttr(value) {
        return String(value)
          .split('&').join('&amp;')
          .split('"').join('&quot;')
          .split('<').join('&lt;');
      }

      const map = L.map('map', {
        zoomControl: false,
        attributionControl: false,
      }).setView(getLatLng(startLocation), 18);

      L.control.zoom({ position: 'bottomleft' }).addTo(map);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '',
      }).addTo(map);

      const RED_PIN_SVG =
        '<svg viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">' +
        '<path fill="#dc2626" stroke="#ffffff" stroke-width="1.5" d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z"/>' +
        '<circle cx="12" cy="12" r="4.5" fill="#ffffff" opacity="0.95"/>' +
        '</svg>';

      const BLUE_PIN_SVG =
        '<svg viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">' +
        '<path fill="#2563eb" stroke="#ffffff" stroke-width="1.5" d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z"/>' +
        '<circle cx="12" cy="12" r="4.5" fill="#ffffff" opacity="0.95"/>' +
        '</svg>';

      const userIcon = L.divIcon({
        className: '',
        html: '<div class="location-pin">' + RED_PIN_SVG + '</div>',
        iconSize: [28, 36],
        iconAnchor: [14, 36],
      });

      const scanIcon = L.divIcon({
        className: '',
        html: '<div class="scan-marker">' + BLUE_PIN_SVG + '</div>',
        iconSize: [28, 36],
        iconAnchor: [14, 36],
      });

      function isNearLocation(left, right) {
        return (
          Math.abs(Number(left.latitude) - Number(right.latitude)) < 0.0003 &&
          Math.abs(Number(left.longitude) - Number(right.longitude)) < 0.0003
        );
      }

      function drawScanLocation(location) {
        if (!hasLocation(location)) {
          if (scanMarker) {
            map.removeLayer(scanMarker);
            scanMarker = null;
          }
          return;
        }

        const latLng = getLatLng(location);

        if (!scanMarker) {
          scanMarker = L.marker(latLng, { icon: scanIcon, interactive: false }).addTo(map);
        } else {
          scanMarker.setLatLng(latLng);
        }
      }

      function hideAccuracyCircle() {
        if (accuracyCircle) {
          map.removeLayer(accuracyCircle);
          accuracyCircle = null;
        }
      }

      function fitMapToRadius(center, radiusMeters) {
        if (!hasLocation(center) || !radiusMeters) {
          return;
        }
        const bounds = L.circle(getLatLng(center), { radius: radiusMeters }).getBounds();
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 18, animate: true });
      }

      function recenterMap(latLng) {
        map.flyTo(latLng, 18, { duration: 1.2, easeLinearity: 0.22 });
      }

      function drawCurrentLocation(location, options) {
        if (!hasLocation(location)) {
          return;
        }

        const latLng = getLatLng(location);

        if (!currentMarker) {
          currentMarker = L.marker(latLng, { icon: userIcon, interactive: false }).addTo(map);
        } else {
          currentMarker.setLatLng(latLng);
        }

        hideAccuracyCircle();

        if (options && options.recenter) {
          userMovedMap = false;
          if (activeRadiusMeters) {
            fitMapToRadius(location, activeRadiusMeters);
          } else {
            map.setView(latLng, 18, { animate: false });
          }
        }
      }

      function drawRadiusCircle(center, radiusMeters) {
        activeRadiusMeters = radiusMeters || null;

        if (radiusCircleLayer) {
          map.removeLayer(radiusCircleLayer);
          radiusCircleLayer = null;
        }

        if (!center || !hasLocation(center) || !radiusMeters) {
          if (currentMarker) {
            const latLng = currentMarker.getLatLng();
            drawCurrentLocation(
              { latitude: latLng.lat, longitude: latLng.lng },
              { recenter: !userMovedMap }
            );
          }
          return;
        }

        hideAccuracyCircle();

        const latLng = getLatLng(center);
        radiusCircleLayer = L.circle(latLng, {
          radius: radiusMeters,
          color: '#076F32',
          weight: 2,
          opacity: 0.85,
          fillColor: '#076F32',
          fillOpacity: 0.14,
          dashArray: '8, 6',
          interactive: false,
        }).addTo(map);

        if (!userMovedMap) {
          fitMapToRadius(center, radiusMeters);
        }
      }

      function clearLayerList(layers) {
        layers.forEach(function(layer) {
          map.removeLayer(layer);
        });
        layers.length = 0;
      }

      function getRestaurantEmoji(type) {
        switch (type) {
          case 'cafe': return '☕';
          case 'food': return '🍜';
          case 'milktea': return '🧋';
          case 'snack': return '🍿';
          default: return '📍';
        }
      }

      function clearRoute() {
        if (routeLayer) {
          map.removeLayer(routeLayer);
          routeLayer = null;
        }
        if (destinationMarker) {
          map.removeLayer(destinationMarker);
          destinationMarker = null;
        }
        activeRouteDestination = null;
      }

      async function showRoute(from, to) {
        clearRoute();

        if (!hasLocation(from) || !hasLocation(to)) {
          postToApp({ type: 'routeError', message: 'Thiếu vị trí để chỉ đường.' });
          return;
        }

        activeRouteDestination = to;

        const destIcon = L.divIcon({
          className: 'fastmark-restaurant-icon',
          html: getShopPinIcon({
            image_url: to.image_url || to.storeAvatar || '',
            type: to.type || 'shop',
          }),
          iconSize: [28, 36],
          iconAnchor: [14, 36],
        });

        destinationMarker = L.marker(getLatLng(to), {
          icon: destIcon,
          interactive: false,
          zIndexOffset: 1000,
        }).addTo(map);

        try {
          const url =
            'https://router.project-osrm.org/route/v1/driving/' +
            Number(from.longitude) + ',' + Number(from.latitude) + ';' +
            Number(to.longitude) + ',' + Number(to.latitude) +
            '?overview=full&geometries=geojson';

          const response = await fetch(url);
          const data = await response.json();

          if (!data || !data.routes || !data.routes[0]) {
            throw new Error('Không tìm được lộ trình.');
          }

          const route = data.routes[0];
          const coords = route.geometry.coordinates.map(function(point) {
            return [point[1], point[0]];
          });

          routeLayer = L.polyline(coords, {
            color: '#076F32',
            weight: 6,
            opacity: 0.9,
            lineJoin: 'round',
          }).addTo(map);

          map.fitBounds(routeLayer.getBounds(), { padding: [100, 48], maxZoom: 17, animate: true });

          postToApp({
            type: 'routeReady',
            distance: route.distance || 0,
            duration: route.duration || 0,
            destination: to,
          });
        } catch (error) {
          clearRoute();
          map.setView(getLatLng(to), 16, { animate: true });
          postToApp({
            type: 'routeError',
            message: error && error.message ? error.message : 'Không vẽ được lộ trình.',
          });
        }
      }

      const SHOP_PIN_PATH =
        'M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z';

      function getShopDisplayName(restaurant) {
        return String(
          restaurant.shop_name ||
          restaurant.shopName ||
          restaurant.name ||
          'Gian hàng'
        ).trim().replace(/^@+/, '') || 'Gian hàng';
      }

      function getShopCategoryLabel(restaurant) {
        return String(
          restaurant.category_name ||
          restaurant.categoryName ||
          ''
        ).trim();
      }

      function getShopRatingLabel(restaurant) {
        const rating = Number(
          restaurant.rating_avg ??
          restaurant.averageRating ??
          restaurant.rating ??
          0
        );
        if (!Number.isFinite(rating) || rating <= 0) {
          return 'Mới';
        }
        return rating.toFixed(1);
      }

      function getShopDistanceLabel(restaurant) {
        const distance = Number(
          restaurant.distance_meters ??
          restaurant.distanceMeters ??
          0
        );
        if (!Number.isFinite(distance) || distance <= 0) {
          return '';
        }
        if (distance >= 1000) {
          return (distance / 1000).toFixed(1) + 'km';
        }
        return Math.round(distance) + 'm';
      }

      function isShopOpen(restaurant) {
        return restaurant.is_open !== false &&
          restaurant.is_open !== 0 &&
          restaurant.isOpen !== 0;
      }

      function getShopPinIcon() {
        return (
          '<div class="shop-marker">' +
          '<svg viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">' +
          '<path fill="#076F32" stroke="#ffffff" stroke-width="2.25" d="' + SHOP_PIN_PATH + '"/>' +
          '<circle cx="12" cy="11" r="9.2" fill="#0a8f42"/>' +
          '<g transform="translate(12 11) scale(0.55) translate(-12 -12)">' +
          '<path fill="#ffffff" d="M3.9 9.3 5.7 4.55A1.55 1.55 0 0 1 7.15 3.6h9.7c.6 0 1.15.35 1.4.9L20.1 9.3c.2.5-.18 1.05-.7 1.05H4.6c-.52 0-.9-.55-.7-1.05z"/>' +
          '<path fill="#ffffff" d="M5.35 11.7h13.3V19.7c0 .66-.54 1.2-1.2 1.2h-2.95v-4.2c0-.66-.54-1.2-1.2-1.2h-2.6c-.66 0-1.2.54-1.2 1.2v4.2H6.55c-.66 0-1.2-.54-1.2-1.2v-8z"/>' +
          '</g>' +
          '</svg>' +
          '</div>'
        );
      }

      function getShopMarkerIcon(restaurant) {
        const name = escapeHtmlAttr(getShopDisplayName(restaurant));
        const rating = escapeHtmlAttr(getShopRatingLabel(restaurant));
        const distance = escapeHtmlAttr(getShopDistanceLabel(restaurant));
        const open = isShopOpen(restaurant);
        const distanceHtml = distance
          ? '<span> · </span><span class="shop-marker-distance">' + distance + '</span>'
          : '';

        return (
          '<div class="shop-marker-card">' +
          '<div class="shop-marker-card-inner">' +
          '<div class="shop-marker-meta">' +
          '<div class="shop-marker-name">' + name + '</div>' +
          '<div class="shop-marker-rating"><span class="shop-marker-star">★</span>' +
          rating + distanceHtml + '</div>' +
          '</div>' +
          '</div>' +
          '<div class="shop-marker-pointer' + (open ? '' : ' shop-marker-pointer-closed') +
          '" title="' + (open ? 'Đang mở cửa' : 'Đóng cửa') + '"></div>' +
          '</div>'
        );
      }

      function buildShopMarkerIconObject(restaurant) {
        return L.divIcon({
          className: 'fastmark-restaurant-icon',
          html: getShopMarkerIcon(restaurant),
          iconSize: [118, 62],
          iconAnchor: [59, 62],
        });
      }

      function buildShopPopupContent(restaurant) {
        return (
          '<div class="restaurant-popup" style="font-family: sans-serif; padding: 2px; min-width: 180px;">' +
          '<b style="font-size: 14px; color: #0f172a;">' + escapeHtmlAttr(restaurant.name || '') + '</b><br>' +
          '<span style="font-size: 12px; color: #475569;">' + escapeHtmlAttr(restaurant.address || '') + '</span>' +
          '<button type="button" class="view-store-btn">Xem gian hàng</button>' +
          '</div>'
        );
      }

      /** Chữ ký nội dung marker — chỉ vẽ lại khi thật sự đổi để bản đồ không nháy. */
      function getShopMarkerSignature(restaurant) {
        return [
          Number(restaurant.latitude).toFixed(6),
          Number(restaurant.longitude).toFixed(6),
          getShopDisplayName(restaurant),
          getShopRatingLabel(restaurant),
          getShopDistanceLabel(restaurant),
          isShopOpen(restaurant) ? 'open' : 'closed',
          String(restaurant.name || ''),
          String(restaurant.address || ''),
        ].join('|');
      }

      function drawRestaurants(restaurantsList) {
        const items = Array.isArray(restaurantsList) ? restaurantsList : [];
        const nextIds = {};

        items.forEach(function(r) {
          if (!hasLocation(r) || r.id == null) {
            return;
          }

          const id = String(r.id);
          nextIds[id] = true;

          const latLng = [Number(r.latitude), Number(r.longitude)];
          const signature = getShopMarkerSignature(r);
          const existing = restaurantMarkerById[id];

          if (existing) {
            if (existing.signature === signature) {
              return;
            }

            existing.data.name = r.name || '';
            existing.data.address = r.address || '';
            existing.marker.setLatLng(latLng);
            existing.marker.setIcon(buildShopMarkerIconObject(r));
            existing.marker.setPopupContent(buildShopPopupContent(r));
            existing.signature = signature;
            return;
          }

          const marker = L.marker(latLng, {
            icon: buildShopMarkerIconObject(r),
            bubblingMouseEvents: true,
            riseOnHover: true,
          }).addTo(map);

          const restaurantData = {
            id: id,
            name: r.name || '',
            address: r.address || '',
          };

          marker.bindPopup(buildShopPopupContent(r), { closeOnClick: true, autoPan: true });

          marker.on('click', function() {
            openRestaurant(restaurantData);
          });

          marker.on('popupopen', function(event) {
            const popupEl = event.popup.getElement();
            if (!popupEl) {
              return;
            }

            const button = popupEl.querySelector('.view-store-btn');
            if (!button) {
              return;
            }

            button.onclick = function(clickEvent) {
              if (clickEvent) {
                clickEvent.preventDefault();
                clickEvent.stopPropagation();
              }
              openRestaurant(restaurantData);
            };
          });

          restaurantMarkerById[id] = {
            marker: marker,
            data: restaurantData,
            signature: signature,
          };
        });

        Object.keys(restaurantMarkerById).forEach(function(id) {
          if (nextIds[id]) {
            return;
          }
          map.removeLayer(restaurantMarkerById[id].marker);
          delete restaurantMarkerById[id];
        });
      }

      function receive(command) {
        if (!command || !command.type) {
          return;
        }

        if (command.type === 'location') {
          drawCurrentLocation(command.location, { recenter: command.recenter });
        }

        if (command.type === 'recenter' && hasLocation(command.location)) {
          userMovedMap = false;
          const latLng = getLatLng(command.location);

          if (currentMarker) {
            currentMarker.setLatLng(latLng);
          } else {
            currentMarker = L.marker(latLng, { icon: userIcon, interactive: false }).addTo(map);
          }

          hideAccuracyCircle();
          recenterMap(latLng);
        }

        if (command.type === 'showRestaurants') {
          drawRestaurants(command.restaurants);
        }

        if (command.type === 'radiusCircle') {
          drawRadiusCircle(command.center, command.radius);
        }

        if (command.type === 'scanLocation') {
          drawScanLocation(command.location);
        }

        if (command.type === 'showRoute') {
          showRoute(command.from, command.to);
        }

        if (command.type === 'clearRoute') {
          clearRoute();
        }
      }

      window.FastmarkMap = { receive, openRestaurant };

      window.addEventListener('message', function(event) {
        const data = event.data || {};
        const command = data.source === 'fastmark-map-command' ? data.payload : data;
        receive(command);
      });

      map.on('click', function(event) {
        const location = toLocation(event.latlng);
        const now = Date.now();

        postToApp({
          type: 'mapTap',
          location: location,
        });

        if (lastMapTap && now - lastMapTap.time < 450 && isNearLocation(lastMapTap.location, location)) {
          postToApp({
            type: 'mapDoubleTap',
            location: location,
          });
          lastMapTap = null;
          return;
        }

        lastMapTap = { time: now, location: location };
      });

      map.on('dblclick', function(event) {
        L.DomEvent.preventDefault(event);
      });

      map.on('dragstart zoomstart', function() {
        userMovedMap = true;
      });

      drawCurrentLocation(startLocation, { recenter: true });
      postToApp({ type: 'ready' });
    </script>
  </body>
</html>`;
}

export { MAP_EVENT_SOURCE };
