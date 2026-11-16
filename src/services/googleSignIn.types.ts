/** What the API's POST /auth/google needs: one of the two tokens. */
export type GoogleCredential = { idToken?: string; accessToken?: string };
