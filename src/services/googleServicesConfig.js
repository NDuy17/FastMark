import googleServices from '../../google-services.json';

function readOAuthClientId(clientType) {
  const oauthClients = googleServices?.client?.[0]?.oauth_client || [];
  const match = oauthClients.find((client) => client.client_type === clientType);
  return match?.client_id || '';
}

// client_type: 1 = Android, 3 = Web
export function getAndroidOAuthClientIdFromGoogleServices() {
  return readOAuthClientId(1);
}

export function getWebOAuthClientIdFromGoogleServices() {
  return readOAuthClientId(3);
}
