import * as Sentry from '@sentry/react-native';

// Regex patterns for matching sensitive PII
const PHONE_REGEX = /(?:(?:\+|00)91[\s-]?)?[6-9]\d{9}\b/g;
const JWT_REGEX = /eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/g;
const BEARER_REGEX = /Bearer\s+[A-Za-z0-9\-_.=]+/gi;

const SENSITIVE_PHONE_KEYS = ['mobile', 'phone', 'phone_number', 'contact_number'];
const SENSITIVE_TOKEN_KEYS = [
  'token',
  'jwt',
  'access_token',
  'refresh_token',
  'authorization',
  'otp',
  'code',
  'password',
  'secret',
];

/**
 * Replaces mobile phone numbers and tokens in a raw string.
 */
export function sanitizeString(text: string): string {
  if (typeof text !== 'string') return text;
  return text
    .replace(BEARER_REGEX, 'Bearer [REDACTED_TOKEN]')
    .replace(JWT_REGEX, '[REDACTED_TOKEN]')
    .replace(PHONE_REGEX, '[REDACTED_PHONE]');
}

/**
 * Recursively walks arbitrary data structures to scrub PII.
 */
export function sanitizePii(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return sanitizeString(data);
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizePii(item));
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_PHONE_KEYS.some((k) => lowerKey.includes(k))) {
        sanitized[key] = '[REDACTED_PHONE]';
      } else if (SENSITIVE_TOKEN_KEYS.some((k) => lowerKey.includes(k))) {
        sanitized[key] = '[REDACTED_TOKEN]';
      } else {
        sanitized[key] = sanitizePii(value);
      }
    }
    return sanitized;
  }

  return data;
}

/**
 * Sentry beforeSend hook to scrub mobile numbers and tokens before sending errors.
 */
export function scrubSentryEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  if (!event) return event;

  // Scrub request headers and body
  if (event.request) {
    if (event.request.headers) {
      for (const header of Object.keys(event.request.headers)) {
        const lowerHeader = header.toLowerCase();
        if (
          lowerHeader === 'authorization' ||
          lowerHeader === 'cookie' ||
          lowerHeader === 'x-auth-token'
        ) {
          event.request.headers[header] = '[REDACTED_TOKEN]';
        } else if (lowerHeader.includes('phone') || lowerHeader.includes('mobile')) {
          event.request.headers[header] = '[REDACTED_PHONE]';
        }
      }
    }
    if (event.request.data) {
      event.request.data = sanitizePii(event.request.data);
    }
  }

  // Scrub user context
  if (event.user) {
    event.user = sanitizePii(event.user);
  }

  // Scrub breadcrumbs
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => ({
      ...crumb,
      message: crumb.message ? sanitizeString(crumb.message) : crumb.message,
      data: crumb.data ? sanitizePii(crumb.data) : crumb.data,
    }));
  }

  // Scrub extra context
  if (event.extra) {
    event.extra = sanitizePii(event.extra);
  }

  // Scrub exception values
  if (event.exception?.values) {
    for (const exc of event.exception.values) {
      if (exc.value) {
        exc.value = sanitizeString(exc.value);
      }
    }
  }

  // Scrub top-level message
  if (event.message) {
    event.message = sanitizeString(event.message);
  }

  return event;
}

/**
 * Initialize Sentry with PII scrubbing.
 */
export function initSentry(): boolean {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
  if (!dsn) {
    return false;
  }

  Sentry.init({
    dsn,
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
    // Prevent default transmission of sensitive PII like IP
    sendDefaultPii: false,
    enableAutoSessionTracking: true,
  });
  return true;
}

/**
 * Conditionally wrap component with Sentry only if DSN is configured.
 */
export function wrapWithSentry<P extends object>(Component: React.ComponentType<P>): React.ComponentType<P> {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
  if (!dsn) {
    return Component;
  }
  return (Sentry.wrap as any)(Component);
}

export { Sentry };
