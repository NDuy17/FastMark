import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth';

import { ensureFirebaseAuth } from './firebaseAuth';

export function serializeAuthUser(user) {
  if (!user) {
    return null;
  }

  return {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
    emailVerified: Boolean(user.emailVerified),
  };
}

export function getCurrentFirebaseUser() {
  return ensureFirebaseAuth().currentUser;
}

export function subscribeToAuthChanges(onChange, onError) {
  return onAuthStateChanged(ensureFirebaseAuth(), onChange, onError);
}

export async function registerWithEmail({ email, password, fullName, photoUrl }) {
  const auth = ensureFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );

  await updateProfile(credential.user, {
    displayName: fullName?.trim() || null,
    photoURL: photoUrl?.trim() || null,
  });

  return serializeAuthUser(credential.user);
}

export async function loginWithEmail({ email, password }) {
  const credential = await signInWithEmailAndPassword(
    ensureFirebaseAuth(),
    email.trim(),
    password
  );

  return serializeAuthUser(credential.user);
}

export async function logoutCurrentUser() {
  await signOut(ensureFirebaseAuth());
}

export async function updateCurrentUserProfile({ fullName, photoUrl }) {
  const user = getCurrentFirebaseUser();

  if (!user) {
    throw new Error('Bạn cần đăng nhập lại.');
  }

  await updateProfile(user, {
    displayName: fullName?.trim() || null,
    photoURL: photoUrl?.trim() || null,
  });

  return serializeAuthUser(user);
}

export async function changeCurrentUserPassword({ currentPassword, newPassword }) {
  const user = getCurrentFirebaseUser();

  if (!user?.email) {
    throw new Error('Bạn cần đăng nhập lại.');
  }

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

export async function getCurrentUserIdToken(forceRefresh = false) {
  const user = getCurrentFirebaseUser();

  if (!user) {
    return null;
  }

  return user.getIdToken(forceRefresh);
}

export async function signInWithGoogleCredential(idToken) {
  const auth = ensureFirebaseAuth();
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(auth, credential);
  return serializeAuthUser(result.user);
}
