const appJson = require('./app.json');
const googleServices = require('./google-services.json');

function getAndroidOAuthClientId() {
  return (
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
    googleServices?.client?.[0]?.oauth_client?.find((client) => client.client_type === 1)
      ?.client_id ||
    ''
  );
}

function reverseGoogleClientIdScheme(clientId) {
  if (!clientId) {
    return '';
  }

  return clientId.split('.').reverse().join('.');
}

module.exports = () => {
  const expo = { ...appJson.expo };
  const googleScheme = reverseGoogleClientIdScheme(getAndroidOAuthClientId());

  expo.android = {
    ...expo.android,
    permissions: ['INTERNET', 'ACCESS_NETWORK_STATE'],
    ...(googleScheme
      ? {
          intentFilters: [
            {
              action: 'VIEW',
              data: [
                {
                  scheme: googleScheme,
                  path: '/oauthredirect',
                },
              ],
              category: ['BROWSABLE', 'DEFAULT'],
            },
          ],
        }
      : {}),
  };

  expo.ios = {
    ...expo.ios,
    infoPlist: {
      CFBundleURLTypes: [
        { CFBundleURLSchemes: ['fastmark'] },
        ...(googleScheme ? [{ CFBundleURLSchemes: [googleScheme] }] : []),
      ],
    },
  };

  return { expo };
};
