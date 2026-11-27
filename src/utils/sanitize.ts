/**
 * Utilities for sanitizing untrusted webpage content and preventing
 * prompt injection / XSS / control-character smuggling.
 */

const ZERO_WIDTH_AND_CONTROL_RE =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;

const EXCESSIVE_NEWLINES_RE = /\n{3,}/g;
const EXCESSIVE_SPACES_RE = /[ \t]{2,}/g;

/**
 * Normalizes and strips invisible/control characters from untrusted text.
 */
export function sanitizePlainText(input: string, maxLength?: number): string {
  if (!input) return '';
  let cleaned = input
    .replace(ZERO_WIDTH_AND_CONTROL_RE, '')
    .replace(/\r\n?/g, '\n')
    .replace(EXCESSIVE_SPACES_RE, ' ')
    .replace(EXCESSIVE_NEWLINES_RE, '\n\n')
    .trim();

  if (maxLength && cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength).trimEnd() + '…';
  }
  return cleaned;
}

/**
 * Escapes XML-like delimiter tags inside untrusted webpage text so that
 * extracted content cannot close our <untrusted_webpage_content> boundary.
 */
export function neutralizeDelimiterTags(input: string): string {
  return input.replace(
    /<(\/?)(untrusted_webpage_content|system|instructions|prompt)([^>]*)>/gi,
    '[$1$2$3]',
  );
}

/**
 * Validates that a URL uses an allowed safe scheme (http or https) for rendering
 * clickable links in the extension UI. Rejects javascript:, data:, vbscript:, etc.
 */
export function sanitizeHttpUrl(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Masks an API key for display (e.g. "xai-••••••abcd"). Never reveals the full key.
 */
export function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) return '••••••••';
  const prefix = trimmed.startsWith('gsk_')
    ? 'gsk_'
    : trimmed.startsWith('xai-')
      ? 'xai-'
      : trimmed.slice(0, 3);
  const suffix = trimmed.slice(-4);
  return `${prefix}••••••${suffix}`;
}

/**
 * Redacts any string that looks like a Groq, xAI, or Bearer API key from error messages or logs.
 */
export function redactSensitiveTokens(text: string): string {
  if (!text) return '';
  return text
    .replace(/gsk_[A-Za-z0-9_-]{8,}/g, 'gsk_[REDACTED]')
    .replace(/xai-[A-Za-z0-9_-]{8,}/g, 'xai-[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._-]{8,}/gi, 'Bearer [REDACTED]');
}

/**
 * Computes a fast deterministic FNV-1a 32-bit hex hash of text for cache keys.
 */
export function hashContent(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

