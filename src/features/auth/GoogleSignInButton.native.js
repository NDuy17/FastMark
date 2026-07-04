import { TurboModuleRegistry } from 'react-native';

import GoogleSignInBrowserButton from './googleSignInBrowser';

function isNativeGoogleSignInAvailable() {
  return TurboModuleRegistry.get('RNGoogleSignin') != null;
}

const GoogleSignInButton = isNativeGoogleSignInAvailable()
  ? require('./googleSignInNativeImpl').default
  : GoogleSignInBrowserButton;

export default GoogleSignInButton;
