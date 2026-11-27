import {
  AppSettings,
  ChatMessage,
  SummaryDepth,
  SummaryResult,
} from '@/types';
import { DEFAULT_XAI_ENDPOINT } from '@/utils/permissions';
import {
  storageGet,
  storageGetAll,
  storageRemove,
  storageSet,
} from './storage';

const SETTINGS_KEY = 'pagemind_settings';
const API_KEY_RECORD = 'pagemind_api_key_v1';
const CRYPTO_SECRET_KEY = 'pagemind_local_crypto_key_v1';
const SUMMARY_CACHE_PREFIX = 'pagemind_summary_';
const CHAT_HISTORY_PREFIX = 'pagemind_chat_';

export const DEFAULT_SETTINGS: AppSettings = {
  model: 'llama-3.3-70b-versatile',
  apiEndpoint: DEFAULT_XAI_ENDPOINT,
  temperature: 0.3,
  defaultSummaryDepth: 'balanced',
  theme: 'system',
  autoAnalyzeOnOpen: false, // Privacy-first: OFF by default
  saveChatHistory: true,
  cacheSummaries: true,
  cacheTtlMinutes: 60,
};

interface EncryptedApiKeyRecord {
  iv: number[];
  ciphertext: number[];
}

function bytesToArray(bytes: Uint8Array): number[] {
  return Array.from(bytes);
}

function arrayToBytes(arr: number[]): Uint8Array<ArrayBuffer> {
  return new Uint8Array(arr);
}

async function getOrCreateLocalCryptoKey(): Promise<CryptoKey | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return null;
  }
  try {
    const existing = await storageGet<number[]>(CRYPTO_SECRET_KEY);
    if (existing && Array.isArray(existing) && existing.length === 32) {
      return await crypto.subtle.importKey(
        'raw',
        arrayToBytes(existing),
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt'],
      );
    }

    const raw = crypto.getRandomValues(new Uint8Array(32));
    await storageSet({ [CRYPTO_SECRET_KEY]: bytesToArray(raw) });
    return await crypto.subtle.importKey(
      'raw',
      raw,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt'],
    );
  } catch {
    return null;
  }
}

/**
 * Stores the user's API key encrypted with a locally generated AES-GCM key.
 * Note: This protects against casual plaintext inspection of storage, but a
 * locally installed extension cannot completely protect secrets from a
 * compromised local environment or malicious extension code.
 */
export async function saveApiKey(apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    await clearApiKey();
    return;
  }

  const cryptoKey = await getOrCreateLocalCryptoKey();
  if (cryptoKey && typeof crypto !== 'undefined' && crypto.subtle) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(trimmed);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encoded,
    );
    const record: EncryptedApiKeyRecord = {
      iv: bytesToArray(iv),
      ciphertext: bytesToArray(new Uint8Array(encrypted)),
    };
    await storageSet({ [API_KEY_RECORD]: record });
    return;
  }

  // Fallback for environments without WebCrypto subtle
  await storageSet({ [API_KEY_RECORD]: { plain: trimmed } });
}

export async function getApiKey(): Promise<string | null> {
  const record = await storageGet<EncryptedApiKeyRecord | { plain: string }>(
    API_KEY_RECORD,
  );
  if (!record) return null;

  if ('plain' in record && typeof record.plain === 'string') {
    return record.plain;
  }

  if ('iv' in record && 'ciphertext' in record) {
    const cryptoKey = await getOrCreateLocalCryptoKey();
    if (!cryptoKey) return null;
    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: arrayToBytes(record.iv) },
        cryptoKey,
        arrayToBytes(record.ciphertext),
      );
      return new TextDecoder().decode(decrypted);
    } catch {
      return null;
    }
  }

  return null;
}

export async function hasApiKey(): Promise<boolean> {
  const key = await getApiKey();
  return Boolean(key && key.trim().length > 0);
}

export async function clearApiKey(): Promise<void> {
  await storageRemove([API_KEY_RECORD, CRYPTO_SECRET_KEY]);
}

export async function getSettings(): Promise<AppSettings> {
  const saved = await storageGet<Partial<AppSettings>>(SETTINGS_KEY);
  return {
    ...DEFAULT_SETTINGS,
    ...(saved ?? {}),
  };
}

export async function saveSettings(
  partial: Partial<AppSettings>,
): Promise<AppSettings> {
  const current = await getSettings();
  const next: AppSettings = {
    ...current,
    ...partial,
  };
  await storageSet({ [SETTINGS_KEY]: next });
  return next;
}

function normalizeUrlKey(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

function summaryCacheKey(url: string, depth: SummaryDepth): string {
  return `${SUMMARY_CACHE_PREFIX}${depth}_${normalizeUrlKey(url)}`;
}

export async function getCachedSummary(
  url: string,
  depth: SummaryDepth,
  contentHash: string,
  ttlMinutes: number,
): Promise<SummaryResult | null> {
  const key = summaryCacheKey(url, depth);
  const cached = await storageGet<SummaryResult>(key);
  if (!cached) return null;

  const maxAgeMs = Math.max(1, ttlMinutes) * 60 * 1000;
  if (Date.now() - cached.generatedAt > maxAgeMs) {
    await storageRemove(key);
    return null;
  }

  if (cached.contentHash !== contentHash) {
    return null;
  }

  return { ...cached, cached: true };
}

export async function setCachedSummary(
  url: string,
  summary: SummaryResult,
): Promise<void> {
  const key = summaryCacheKey(url, summary.depth);
  await storageSet({ [key]: summary });
}

export async function clearSummaryCache(): Promise<void> {
  const all = await storageGetAll();
  const keys = Object.keys(all).filter((k) =>
    k.startsWith(SUMMARY_CACHE_PREFIX),
  );
  if (keys.length > 0) {
    await storageRemove(keys);
  }
}

function chatHistoryKey(url: string): string {
  return `${CHAT_HISTORY_PREFIX}${normalizeUrlKey(url)}`;
}

export async function getChatHistory(url: string): Promise<ChatMessage[]> {
  const messages = await storageGet<ChatMessage[]>(chatHistoryKey(url));
  return Array.isArray(messages) ? messages : [];
}

export async function saveChatHistory(
  url: string,
  messages: ChatMessage[],
): Promise<void> {
  const trimmed = messages.slice(-40);
  await storageSet({ [chatHistoryKey(url)]: trimmed });
}

export async function clearChatHistoryForUrl(url: string): Promise<void> {
  await storageRemove(chatHistoryKey(url));
}

export async function clearAllChatHistory(): Promise<void> {
  const all = await storageGetAll();
  const keys = Object.keys(all).filter((k) =>
    k.startsWith(CHAT_HISTORY_PREFIX),
  );
  if (keys.length > 0) {
    await storageRemove(keys);
  }
}

