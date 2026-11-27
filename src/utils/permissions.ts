/**
 * URL and endpoint permission checks for PageMind.
 * Ensures we never attempt to inject into restricted browser URLs
 * and validates xAI API endpoints before sending credentials.
 */

export const DEFAULT_API_ENDPOINT = 'https://api.groq.com/openai/v1';
export const DEFAULT_XAI_ENDPOINT = DEFAULT_API_ENDPOINT;

const OFFICIAL_API_HOSTS = new Set(['api.groq.com', 'api.x.ai']);

const RESTRICTED_PROTOCOLS = [
  'chrome:',
  'chrome-extension:',
  'brave:',
  'edge:',
  'about:',
  'moz-extension:',
  'view-source:',
  'devtools:',
  'file:',
  'data:',
  'javascript:',
];

const RESTRICTED_HOSTNAMES = new Set([
  'chromewebstore.google.com',
  'chrome.google.com',
  'microsoftedge.microsoft.com',
  'addons.mozilla.org',
]);

export interface PageAccessCheck {
  allowed: boolean;
  reason?: string;
}

/**
 * Checks whether a tab URL can be read by a content script via activeTab + scripting.
 */
export function checkPageAccess(url?: string): PageAccessCheck {
  if (!url) {
    return {
      allowed: false,
      reason:
        'This tab does not expose a readable URL. Open a standard webpage (http or https) to use PageMind.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      allowed: false,
      reason: 'This page has an invalid or unsupported URL.',
    };
  }

  if (RESTRICTED_PROTOCOLS.includes(parsed.protocol)) {
    return {
      allowed: false,
      reason:
        'Browser internal pages and local files cannot be read by extensions for security reasons.',
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      allowed: false,
      reason: `Pages using the "${parsed.protocol}" protocol are not supported.`,
    };
  }

  if (RESTRICTED_HOSTNAMES.has(parsed.hostname.toLowerCase())) {
    return {
      allowed: false,
      reason:
        'Extension stores (such as the Chrome Web Store) restrict content scripts for browser security.',
    };
  }

  return { allowed: true };
}

export interface EndpointValidation {
  valid: boolean;
  isOfficialXai: boolean;
  normalizedUrl?: string;
  warning?: string;
  error?: string;
}

/**
 * Validates an API base URL to prevent accidental credential disclosure.
 */
export function validateApiEndpoint(rawEndpoint: string): EndpointValidation {
  const trimmed = rawEndpoint.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return {
      valid: false,
      isOfficialXai: false,
      error: 'API endpoint cannot be empty.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      isOfficialXai: false,
      error: 'Please enter a valid URL (for example, https://api.x.ai/v1).',
    };
  }

  const isLocalhost =
    parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

  if (parsed.protocol !== 'https:' && !isLocalhost) {
    return {
      valid: false,
      isOfficialXai: false,
      error: 'API endpoint must use HTTPS to protect your API key in transit.',
    };
  }

  const isOfficialXai =
    parsed.protocol === 'https:' && OFFICIAL_API_HOSTS.has(parsed.hostname);

  if (!isOfficialXai) {
    return {
      valid: true,
      isOfficialXai: false,
      normalizedUrl: parsed.toString().replace(/\/+$/, ''),
      warning:
        'Custom endpoint detected: your API key will be sent to this domain instead of api.groq.com. Only use endpoints you fully trust.',
    };
  }

  return {
    valid: true,
    isOfficialXai: true,
    normalizedUrl: parsed.toString().replace(/\/+$/, ''),
  };
}

/**
 * Extracts a clean display domain from a URL.
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

