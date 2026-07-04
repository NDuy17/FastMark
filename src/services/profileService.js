import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';

import { ensureFirebaseApp } from './firebaseApp';
import { getCurrentUserIdToken } from './authService';
import { getNodeApiUrl } from './env';

const PROFILE_COLLECTION = 'profiles';
const NODE_FETCH_TIMEOUT_MS = 3000;

const nodeApiUrl = getNodeApiUrl();

function hasNodeApi() {
  return Boolean(nodeApiUrl);
}

function nowIso() {
  return new Date().toISOString();
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function makeProfileFromAuthUser(authUser, updates = {}) {
  const patch = updates || {};
  const timestamp = nowIso();

  return {
    id: authUser.uid,
    email: authUser.email || '',
    fullName: cleanText(patch.fullName) || authUser.displayName || '',
    phone: cleanText(patch.phone),
    photoUrl: cleanText(patch.photoUrl) || authUser.photoURL || '',
    createdAt: patch.createdAt || timestamp,
    updatedAt: timestamp,
  };
}

function mergeProfile(authUser, baseProfile, updates = {}) {
  const patch = updates || {};
  const fallback = makeProfileFromAuthUser(authUser, baseProfile || {});

  return {
    ...fallback,
    ...baseProfile,
    email: authUser.email || baseProfile?.email || '',
    fullName:
      patch.fullName !== undefined
        ? cleanText(patch.fullName)
        : baseProfile?.fullName || fallback.fullName,
    phone:
      patch.phone !== undefined
        ? cleanText(patch.phone)
        : baseProfile?.phone || fallback.phone,
    photoUrl:
      patch.photoUrl !== undefined
        ? cleanText(patch.photoUrl)
        : baseProfile?.photoUrl || fallback.photoUrl,
    updatedAt: nowIso(),
  };
}

function getProfilesCollection() {
  return getFirestore(ensureFirebaseApp());
}

async function fetchWithTimeout(url, options = {}, timeoutMs = NODE_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Node API timeout');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readFirebaseProfile(uid) {
  const db = getProfilesCollection();
  const snapshot = await getDoc(doc(db, PROFILE_COLLECTION, uid));

  return snapshot.exists() ? snapshot.data() : null;
}

async function saveFirebaseProfile(profile) {
  const db = getProfilesCollection();
  await setDoc(doc(db, PROFILE_COLLECTION, profile.id), profile, { merge: true });
}

async function getNodeAuthToken() {
  try {
    return await getCurrentUserIdToken();
  } catch {
    return null;
  }
}

async function fetchNodeProfile() {
  const token = await getNodeAuthToken();
  if (!token) {
    return null;
  }

  const response = await fetchWithTimeout(`${nodeApiUrl.replace(/\/$/, '')}/profile`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Node API read profile failed: ${response.status}`);
  }

  const data = await response.json();
  return data.profile || null;
}

async function saveNodeProfile(profile) {
  const token = await getNodeAuthToken();
  if (!token) {
    return null;
  }

  const response = await fetchWithTimeout(`${nodeApiUrl.replace(/\/$/, '')}/profile`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ profile }),
  });

  if (!response.ok) {
    throw new Error(`Node API save profile failed: ${response.status}`);
  }

  const data = await response.json();
  return data.profile || null;
}

function syncNodeProfileInBackground(profile) {
  if (!hasNodeApi()) {
    return;
  }

  saveNodeProfile(profile).catch((error) => {
    console.warn('Node API background sync failed:', error.message || error);
  });
}

export async function readUserProfile(authUser) {
  try {
    const firebaseProfile = await readFirebaseProfile(authUser.uid);
    if (firebaseProfile) {
      return mergeProfile(authUser, firebaseProfile, null);
    }
  } catch (error) {
    console.warn('Firestore read profile failed:', error.message || error);
  }

  if (hasNodeApi()) {
    try {
      const nodeProfile = await fetchNodeProfile();
      if (nodeProfile) {
        return mergeProfile(authUser, nodeProfile, null);
      }
    } catch (error) {
      console.warn('Node API read profile failed:', error.message || error);
    }
  }

  return mergeProfile(authUser, null, null);
}

export async function upsertUserProfile(authUser, updates = {}, options = {}) {
  const { existingProfile = null } = options;

  let currentProfile = existingProfile;
  if (!currentProfile) {
    currentProfile = await readUserProfile(authUser).catch(() => null);
  }

  const profile = mergeProfile(authUser, currentProfile, updates);

  try {
    await saveFirebaseProfile(profile);
  } catch (error) {
    console.warn('Firestore save profile failed:', error.message || error);
  }

  syncNodeProfileInBackground(profile);

  return profile;
}
