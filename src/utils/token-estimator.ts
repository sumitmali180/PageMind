/**
 * Lightweight token estimation and text budgeting utilities.
 * Uses a conservative ~3.8 characters per token heuristic for English/code mix.
 */

const CHARS_PER_TOKEN = 3.8;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function truncateToTokenBudget(
  text: string,
  maxTokens: number,
): { text: string; truncated: boolean } {
  if (!text || maxTokens <= 0) {
    return { text: '', truncated: Boolean(text) };
  }
  const maxChars = Math.floor(maxTokens * CHARS_PER_TOKEN);
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }

  // Try to cut cleanly at a paragraph or sentence boundary
  const slice = text.slice(0, maxChars);
  const lastParagraph = slice.lastIndexOf('\n\n');
  const cutIndex =
    lastParagraph > maxChars * 0.65
      ? lastParagraph
      : Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('\n'));

  const cleanSlice =
    cutIndex > maxChars * 0.5 ? slice.slice(0, cutIndex + 1) : slice;

  return {
    text: `${cleanSlice.trimEnd()}\n\n[Content truncated to fit context budget]`,
    truncated: true,
  };
}

