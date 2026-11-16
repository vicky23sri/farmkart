/**
 * Google Sign-In for Android / iOS (native account picker).
 *
 * Returns a Google ID token whose audience is the *Web* OAuth client ID; the API verifies it
 * against GOOGLE_CLIENT_IDS. The Android OAuth client (package name + SHA-1) is not referenced in
 * code; Google matches it to the signed app automatically. See DEPLOY.md > Google Sign-In.
 *
 * The web build uses googleSignIn.web.ts instead.
 */
import type { GoogleCredential } from './googleSignIn.types';

export type { GoogleCredential } from './googleSignIn.types';

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();

/** The Google button is only shown when this build has a client ID. */
export const isGoogleSignInConfigured = Boolean(WEB_CLIENT_ID);

let configured = false;

// Loaded lazily so a binary built before the native module was added fails only on tap, not on launch.
async function getModule() {
  const mod = await import('@react-native-google-signin/google-signin');
  if (!configured) {
    mod.GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, iosClientId: IOS_CLIENT_ID || undefined });
    configured = true;
  }
  return mod;
}

/** Resolves to null when the user cancels; throws an Error with a user-facing message otherwise. */
export async function signInWithGoogle(): Promise<GoogleCredential | null> {
  if (!WEB_CLIENT_ID) throw new Error('Google sign-in is not configured for this build.');

  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = await getModule();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return null;
    if (!res.data.idToken) throw new Error('Google did not return a sign-in token. Please try again.');
    return { idToken: res.data.idToken };
  } catch (err) {
    if (isErrorWithCode(err)) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED || err.code === statusCodes.IN_PROGRESS) return null;
      if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play services is missing or out of date on this device.');
      }
      // Android DEVELOPER_ERROR: the build's SHA-1 / package is not registered on an Android OAuth client
      if (err.code === '10' || /DEVELOPER_ERROR/.test(err.message)) {
        console.warn('[googleSignIn] DEVELOPER_ERROR: register this build\'s SHA-1 in Google Cloud.', err);
        throw new Error('Google sign-in is not set up for this app build yet.');
      }
    }
    throw err instanceof Error ? err : new Error('Google sign-in failed. Please try again.');
  }
}

/** Forget the Google account so the next sign-in shows the account picker. Never throws. */
export async function signOutOfGoogle(): Promise<void> {
  if (!configured) return;
  try {
    const { GoogleSignin } = await getModule();
    await GoogleSignin.signOut();
  } catch {
    // not signed in with Google, or module unavailable
  }
}
