import { ChatMessage, ExtractedPageContent } from '@/types';
import { neutralizeDelimiterTags } from '@/utils/sanitize';
import { estimateTokens, truncateToTokenBudget } from '@/utils/token-estimator';

export const DEFAULT_PAGE_CONTEXT_TOKEN_BUDGET = 12_000;
export const DEFAULT_CHAT_HISTORY_TOKEN_BUDGET = 3_500;

/**
 * Formats extracted webpage data into a token-budgeted, prompt-injection-hardened
 * context block wrapped in <untrusted_webpage_content> delimiters.
 */
export function buildPageContextBlock(
  page: ExtractedPageContent,
  maxTokens: number = DEFAULT_PAGE_CONTEXT_TOKEN_BUDGET,
): { contextBlock: string; truncated: boolean } {
  const safeTitle = neutralizeDelimiterTags(page.metadata.title);
  const safeAuthor = page.metadata.author
    ? neutralizeDelimiterTags(page.metadata.author)
    : undefined;
  const safeDescription = page.metadata.description
    ? neutralizeDelimiterTags(page.metadata.description)
    : undefined;

  const metaLines = [
    `Title: ${safeTitle}`,
    `URL: ${page.metadata.url}`,
    `Domain: ${page.metadata.domain}`,
    `Detected Page Type: ${page.pageType}`,
    safeAuthor ? `Author: ${safeAuthor}` : null,
    page.metadata.publishedDate
      ? `Published: ${page.metadata.publishedDate}`
      : null,
    safeDescription ? `Description: ${safeDescription}` : null,
  ].filter(Boolean);

  const headingsSection =
    page.headings.length > 0
      ? `\nHeadings:\n${page.headings
          .slice(0, 15)
          .map((h) => `- ${neutralizeDelimiterTags(h)}`)
          .join('\n')}`
      : '';

  const tablesSection =
    page.tables.length > 0
      ? `\nTables:\n${page.tables
          .slice(0, 3)
          .map((t) => neutralizeDelimiterTags(t))
          .join('\n\n')}`
      : '';

  const codeSection =
    page.codeBlocks.length > 0
      ? `\nCode Snippets:\n${page.codeBlocks
          .slice(0, 4)
          .map((c) => `\`\`\`\n${neutralizeDelimiterTags(c)}\n\`\`\``)
          .join('\n\n')}`
      : '';

  const linksSection =
    page.keyLinks.length > 0
      ? `\nKey Links:\n${page.keyLinks
          .slice(0, 10)
          .map((l) => `- ${neutralizeDelimiterTags(l.text)}: ${l.href}`)
          .join('\n')}`
      : '';

  const overheadText = `${metaLines.join('\n')}${headingsSection}${tablesSection}${codeSection}${linksSection}`;
  const overheadTokens = estimateTokens(overheadText);
  const mainBudget = Math.max(1_000, maxTokens - overheadTokens);

  const sanitizedMain = neutralizeDelimiterTags(page.mainText);
  const { text: budgetedMain, truncated } = truncateToTokenBudget(
    sanitizedMain,
    mainBudget,
  );

  const contextBlock = [
    '<untrusted_webpage_content>',
    metaLines.join('\n'),
    headingsSection,
    '\nMain Content:',
    budgetedMain,
    tablesSection,
    codeSection,
    linksSection,
    '</untrusted_webpage_content>',
  ]
    .filter((part) => part.trim().length > 0)
    .join('\n');

  return { contextBlock, truncated };
}

/**
 * Keeps the most recent chat messages that fit within the token budget.
 */
export function trimChatHistory(
  messages: ChatMessage[],
  maxTokens: number = DEFAULT_CHAT_HISTORY_TOKEN_BUDGET,
): ChatMessage[] {
  const valid = messages.filter((m) => !m.error && m.content.trim().length > 0);
  const kept: ChatMessage[] = [];
  let usedTokens = 0;

  for (let i = valid.length - 1; i >= 0; i--) {
    const msg = valid[i];
    const tokens = estimateTokens(msg.content) + 12;
    if (usedTokens + tokens > maxTokens && kept.length > 0) {
      break;
    }
    kept.unshift(msg);
    usedTokens += tokens;
  }

  return kept;
}

