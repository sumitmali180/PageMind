import { describe, expect, it } from 'vitest';
import {
  clearAllChatHistory,
  clearApiKey,
  clearSummaryCache,
  DEFAULT_SETTINGS,
  getApiKey,
  getCachedSummary,
  getChatHistory,
  getSettings,
  saveApiKey,
  saveChatHistory,
  saveSettings,
  setCachedSummary,
} from '@/storage/settings';

describe('storage & settings', () => {
  it('saves, retrieves, and clears API keys', async () => {
    expect(await getApiKey()).toBeNull();
    await saveApiKey('dummy-key-abc123');
    expect(await getApiKey()).toBe('dummy-key-abc123');
    await clearApiKey();
    expect(await getApiKey()).toBeNull();
  });

  it('persists and merges settings with privacy-first defaults', async () => {
    const initial = await getSettings();
    expect(initial.autoAnalyzeOnOpen).toBe(false);
    expect(initial.model).toBe(DEFAULT_SETTINGS.model);

    const updated = await saveSettings({
      theme: 'dark',
      defaultSummaryDepth: 'detailed',
    });
    expect(updated.theme).toBe('dark');
    expect(updated.defaultSummaryDepth).toBe('detailed');
    expect((await getSettings()).theme).toBe('dark');
  });

  it('caches summaries by url, depth, and contentHash', async () => {
    await setCachedSummary('https://example.com/post', {
      content: 'Cached summary',
      depth: 'balanced',
      pageType: 'blog',
      model: 'grok-4.7',
      generatedAt: Date.now(),
      contentHash: 'hash1',
    });

    const hit = await getCachedSummary(
      'https://example.com/post',
      'balanced',
      'hash1',
      60,
    );
    expect(hit?.content).toBe('Cached summary');
    expect(hit?.cached).toBe(true);

    const missHash = await getCachedSummary(
      'https://example.com/post',
      'balanced',
      'hash2',
      60,
    );
    expect(missHash).toBeNull();

    await clearSummaryCache();
    expect(
      await getCachedSummary('https://example.com/post', 'balanced', 'hash1', 60),
    ).toBeNull();
  });

  it('saves and clears per-URL chat history', async () => {
    await saveChatHistory('https://example.com/a', [
      { id: '1', role: 'user', content: 'Hello?', createdAt: 1 },
    ]);
    expect(await getChatHistory('https://example.com/a')).toHaveLength(1);
    await clearAllChatHistory();
    expect(await getChatHistory('https://example.com/a')).toHaveLength(0);
  });
});

