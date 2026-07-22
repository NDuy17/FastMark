import { createLogger } from '../core/utils/logger';
import { hasApiBaseUrl } from '../api/client';
import { getCurrentUserIdToken } from '../api/authApi';
import { getMeOnBackend, updateProfileOnBackend } from '../api/authBackendApi';
import { readCachedProfile, writeCachedProfile } from '../api/profileCacheApi';
import {
  makeProfileFromAuthUser,
  mapBackendUserToProfile,
  mergeProfile,
} from '../model/profileModel';

const log = createLogger('ProfileRepository');

export { makeProfileFromAuthUser } from '../model/profileModel';

/**
 * Đọc hồ sơ từ User (GET /api/auth/me). Cache local chỉ để mở app nhanh.
 */
export async function readUserProfile(authUser) {
  log.info('readUserProfile:start', { uid: authUser.uid });

  const cachedProfile = await readCachedProfile(authUser.uid);
  if (cachedProfile && !hasApiBaseUrl()) {
    log.ok('readUserProfile:cache', { uid: authUser.uid });
    return mergeProfile(authUser, cachedProfile, null);
  }

  if (hasApiBaseUrl()) {
    try {
      const idToken = await getCurrentUserIdToken(false);
      if (idToken) {
        const data = await getMeOnBackend(idToken);
        const profile = mapBackendUserToProfile(data.user, authUser);
        await writeCachedProfile(profile);
        log.ok('readUserProfile:user-api', { uid: authUser.uid });
        return profile;
      }
    } catch (error) {
      log.fail('readUserProfile:user-api-failed', error);
      if (cachedProfile) {
        log.ok('readUserProfile:cache-fallback', { uid: authUser.uid });
        return mergeProfile(authUser, cachedProfile, null);
      }
    }
  }

  if (cachedProfile) {
    log.ok('readUserProfile:cache', { uid: authUser.uid });
    return mergeProfile(authUser, cachedProfile, null);
  }

  log.info('readUserProfile:default-profile', { uid: authUser.uid });
  return makeProfileFromAuthUser(authUser);
}

/**
 * Cập nhật hồ sơ qua User (PUT /api/auth/me). Không còn bảng Profile.
 */
export async function upsertUserProfile(authUser, updates = {}, options = {}) {
  log.info('upsertUserProfile:start', {
    uid: authUser.uid,
    updates: Object.keys(updates || {}),
  });
  const { existingProfile = null } = options;

  let currentProfile = existingProfile;
  if (!currentProfile) {
    currentProfile = await readUserProfile(authUser).catch(() => null);
  }

  const profile = mergeProfile(authUser, currentProfile, updates);

  if (hasApiBaseUrl()) {
    try {
      const idToken = await getCurrentUserIdToken();
      if (idToken) {
        const data = await updateProfileOnBackend({
          idToken,
          fullName: profile.fullName,
          userName: profile.userName,
        });
        const saved = mapBackendUserToProfile(data.user, authUser);
        await writeCachedProfile(saved);
        log.ok('upsertUserProfile:user-api-saved', { uid: authUser.uid });
        return saved;
      }
    } catch (error) {
      log.fail('upsertUserProfile:user-api-failed', error);
    }
  }

  await writeCachedProfile(profile);
  log.ok('upsertUserProfile:local-cache', { uid: authUser.uid });
  return profile;
}

export { writeCachedProfile, readCachedProfile } from '../api/profileCacheApi';
