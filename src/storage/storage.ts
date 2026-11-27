/**
 * Local storage abstraction for PageMind.
 * Uses chrome.storage.local when running as an extension, with an in-memory
 * fallback for unit tests.
 */

const memoryFallback = new Map<string, unknown>();

function hasChromeStorage(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    Boolean(chrome.storage?.local)
  );
}

export async function storageGet<T = unknown>(key: string): Promise<T | undefined> {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(key);
    return result[key] as T | undefined;
  }
  return memoryFallback.get(key) as T | undefined;
}

export async function storageSet(items: Record<string, unknown>): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.local.set(items);
    return;
  }
  for (const [k, v] of Object.entries(items)) {
    memoryFallback.set(k, v);
  }
}

export async function storageRemove(keys: string | string[]): Promise<void> {
  const keyList = Array.isArray(keys) ? keys : [keys];
  if (hasChromeStorage()) {
    await chrome.storage.local.remove(keyList);
    return;
  }
  for (const k of keyList) {
    memoryFallback.delete(k);
  }
}

export async function storageGetAll(): Promise<Record<string, unknown>> {
  if (hasChromeStorage()) {
    return await chrome.storage.local.get(null);
  }
  return Object.fromEntries(memoryFallback.entries());
}

export function clearMemoryFallback(): void {
  memoryFallback.clear();
}

