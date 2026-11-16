/**
 * Google Sign-In for the web build: OAuth popup using the Web client ID.
 * The page's origin must be listed under "Authorized JavaScript origins" and
 * "Authorized redirect URIs" on that Web client.
 */
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import type { GoogleCredential } from './googleSignIn.types';

export type { GoogleCredential } from './googleSignIn.types';

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();

export const isGoogleSignInConfigured = Boolean(WEB_CLIENT_ID);

export async function signInWithGoogle(): Promise<GoogleCredential | null> {
  if (!WEB_CLIENT_ID) throw new Error('Google sign-in is not configured for this build.');

  const redirectUrl = Linking.createURL('/');
  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: WEB_CLIENT_ID,
      redirect_uri: redirectUrl,
      response_type: 'token',
      scope: 'openid profile email',
      prompt: 'select_account',
    }).toString();

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
  if (result.type !== 'success' || !result.url) return null;

  const fragment = result.url.split('#')[1] || result.url.split('?')[1] || '';
  const accessToken = new URLSearchParams(fragment).get('access_token');
  if (!accessToken) throw new Error('Google did not return a sign-in token. Please try again.');
  return { accessToken };
}

export async function signOutOfGoogle(): Promise<void> {}
