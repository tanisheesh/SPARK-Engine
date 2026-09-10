/* Runtime configuration.
 *
 * Everything comes from EXPO_PUBLIC_* environment variables, which Expo inlines
 * at build time. Nothing here is a secret: the relay URL is a hostname, and the
 * Cognito client id is a public client identifier (the desktop treats it the
 * same way - see lib/aws-config.ts). The ID token, which IS sensitive, is never
 * configured; it is obtained at sign-in and kept in the device keystore.
 *
 * Copy .env.example to .env and fill it in. See README.
 */

const env = process.env as Record<string, string | undefined>;

function trim(value: string | undefined): string {
  return (value ?? '').trim();
}

export const RELAY_URL = trim(env.EXPO_PUBLIC_RELAY_URL);

export const COGNITO_DOMAIN = trim(env.EXPO_PUBLIC_COGNITO_DOMAIN).replace(/\/$/, '');
export const COGNITO_CLIENT_ID = trim(env.EXPO_PUBLIC_COGNITO_CLIENT_ID);

/* The custom scheme Cognito redirects back to. Must match both app.json's
   `scheme` and the callback URL registered on the mobile app client. */
export const AUTH_REDIRECT_SCHEME = 'sparkmobile';
export const AUTH_REDIRECT_URI = `${AUTH_REDIRECT_SCHEME}://auth/callback`;

/** Account sign-in needs a Cognito app client configured for mobile. Until
    that exists, the app offers pairing-code mode instead of showing a sign-in
    button that cannot work. */
export const accountAuthAvailable = Boolean(COGNITO_DOMAIN && COGNITO_CLIENT_ID);

/** Whether the app is usable at all. Without a relay URL there is nothing to
    connect to, and the auth screen says so rather than failing at first tap. */
export const configured = Boolean(RELAY_URL);

export const CONFIG_HELP =
  'Set EXPO_PUBLIC_RELAY_URL in mobile/.env to the address of your SPARK relay ' +
  '(for example ws://192.168.1.20:8787/session), then restart the dev server.';
