import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'fastmark.search.history.v1';
const MAX_HISTORY = 5;

function normalizeKeyword(value) {
  return String(value || '').trim();
}

function normalizeUserId(userId) {
  return String(userId || '').trim();
}

function storageKeyForUser(userId) {
  const uid = normalizeUserId(userId);
  if (!uid) {
    return null;
  }
  return `${STORAGE_PREFIX}.${uid}`;
}

export async function getSearchHistory(userId) {
  const key = storageKeyForUser(userId);
  if (!key) {
    return [];
  }

  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => normalizeKeyword(item))
      .filter(Boolean)
      .slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

export async function addSearchHistory(userId, keyword) {
  const key = storageKeyForUser(userId);
  if (!key) {
    return [];
  }

  const nextKeyword = normalizeKeyword(keyword);
  if (!nextKeyword) {
    return getSearchHistory(userId);
  }

  const current = await getSearchHistory(userId);
  const next = [
    nextKeyword,
    ...current.filter((item) => item.toLowerCase() !== nextKeyword.toLowerCase()),
  ].slice(0, MAX_HISTORY);

  try {
    await AsyncStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Ignore storage failures.
  }
  return next;
}

export async function removeSearchHistory(userId, keyword) {
  const key = storageKeyForUser(userId);
  if (!key) {
    return [];
  }

  const target = normalizeKeyword(keyword).toLowerCase();
  const current = await getSearchHistory(userId);
  const next = current.filter((item) => item.toLowerCase() !== target);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Ignore storage failures.
  }
  return next;
}

export async function clearSearchHistory(userId) {
  const key = storageKeyForUser(userId);
  if (!key) {
    return [];
  }

  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
  return [];
}
