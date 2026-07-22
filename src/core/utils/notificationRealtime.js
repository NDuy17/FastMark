export function normalizeSocketNotification(payload) {
  if (!payload) {
    return null;
  }

  const id = String(payload.id || payload._id || '').trim();
  if (!id) {
    return null;
  }

  return {
    id,
    title: String(payload.title || '').trim(),
    content: String(payload.content || payload.body || '').trim(),
    body: String(payload.content || payload.body || '').trim(),
    audience: String(payload.audience || 'system').trim().toLowerCase() || 'system',
    isRead: Number(payload.isRead) === 1 || payload.isRead === true,
    createdAt: payload.createdAt || new Date().toISOString(),
  };
}

export function notificationMatchesAudience(notification, screenAudience = 'buyer') {
  const audience = String(notification?.audience || '').trim().toLowerCase();
  const screen = String(screenAudience || 'buyer').trim().toLowerCase();

  if (screen === 'seller') {
    return audience === 'seller' || audience === 'system' || !audience;
  }

  if (screen === 'buyer') {
    return audience === 'buyer' || audience === 'system';
  }

  return audience === screen || audience === 'system';
}

export function prependUniqueNotification(currentItems, incomingItem) {
  if (!incomingItem?.id) {
    return currentItems;
  }

  const nextId = String(incomingItem.id);
  const filtered = (currentItems || []).filter((item) => String(item.id) !== nextId);
  return [incomingItem, ...filtered];
}
