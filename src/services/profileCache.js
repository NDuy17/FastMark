import AsyncStorage from '@react-native-async-storage/async-storage';

function cacheKey(uid) {
  return `fastmark:profile:${uid}`;
}

export async function readCachedProfile(uid) {
  if (!uid) {
    return null;
  }

  try {
    const raw = await AsyncStorage.getItem(cacheKey(uid));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function writeCachedProfile(profile) {
  if (!profile?.id) {
    return;
  }

  try {
    await AsyncStorage.setItem(cacheKey(profile.id), JSON.stringify(profile));
  } catch {
    // Local cache is best-effort only.
  }
}
