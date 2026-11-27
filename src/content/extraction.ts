import { Readability } from '@mozilla/readability';
import {
  ExtractedLink,
  ExtractedPageContent,
  ExtractedSection,
  PageMetadata,
  PageType,
} from '@/types';
import { extractDomain } from '@/utils/permissions';
import { hashContent, sanitizeHttpUrl, sanitizePlainText } from '@/utils/sanitize';

const CLUTTER_SELECTORS = [
  'script',
  'style',
  'noscript',
  'template',
  'iframe',
  'svg',
  'nav',
  'footer',
  'header nav',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[aria-hidden="true"]',
  '[class*="cookie"]',
  '[id*="cookie"]',
  '[class*="consent"]',
  '[id*="consent"]',
  '[class*="newsletter"]',
  '[class*="promo"]',
  '[class*="advertisement"]',
  '[class*="ad-banner"]',
  '[data-testid="cookie-policy-manage-dialog"]',
];

const MAX_CODE_BLOCKS = 8;
const MAX_TABLES = 5;
const MAX_LINKS = 15;
const MAX_SECTIONS = 16;

function getMetaContent(doc: Document, selectors: string[]): string | undefined {
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    const val = el?.getAttribute('content') || el?.textContent;
    if (val && val.trim()) {
      return sanitizePlainText(val, 300);
    }
  }
  return undefined;
}

/**
 * Classifies the webpage into a content type for context-aware summarization.
 */
export function detectPageType(url: string, doc: Document): PageType {
  const lowerUrl = url.toLowerCase();
  const hostname = extractDomain(url).toLowerCase();

  if (hostname === 'github.com' || hostname.endsWith('.github.com')) {
    return 'github';
  }
  if (
    hostname === 'stackoverflow.com' ||
    hostname.endsWith('.stackexchange.com') ||
    hostname === 'superuser.com' ||
    hostname === 'serverfault.com'
  ) {
    return 'stackoverflow';
  }
  if (hostname.includes('wikipedia.org')) {
    return 'wikipedia';
  }
  if (hostname === 'youtube.com' || hostname === 'youtu.be' || hostname === 'm.youtube.com') {
    return 'youtube';
  }
  if (
    lowerUrl.includes('/docs/') ||
    lowerUrl.includes('/documentation') ||
    lowerUrl.includes('/reference/') ||
    lowerUrl.includes('/api/') ||
    hostname.startsWith('docs.') ||
    hostname === 'developer.mozilla.org' ||
    hostname === 'react.dev' ||
    hostname === 'typescriptlang.org'
  ) {
    return 'documentation';
  }
  if (
    lowerUrl.includes('/jobs/') ||
    lowerUrl.includes('/careers/') ||
    hostname.includes('greenhouse.io') ||
    hostname.includes('lever.co') ||
    hostname.includes('indeed.com') ||
    (hostname.includes('linkedin.com') && lowerUrl.includes('/jobs'))
  ) {
    return 'job';
  }
  if (
    lowerUrl.includes('/product/') ||
    lowerUrl.includes('/dp/') ||
    doc.querySelector('[itemtype*="schema.org/Product"]') !== null ||
    doc.querySelector('meta[property="og:type"][content="product"]') !== null
  ) {
    return 'product';
  }
  if (
    hostname.includes('coursera.org') ||
    hostname.includes('edx.org') ||
    hostname.includes('khanacademy.org') ||
    hostname.includes('mit.edu') ||
    hostname.includes('stanford.edu') ||
    lowerUrl.includes('/learn/') ||
    lowerUrl.includes('/tutorial')
  ) {
    return 'educational';
  }
  if (
    doc.querySelector('meta[property="og:type"][content="article"]') !== null ||
    doc.querySelector('[itemtype*="NewsArticle"]') !== null ||
    lowerUrl.includes('/news/')
  ) {
    return hostname.includes('medium.com') ||
      hostname.includes('substack.com') ||
      lowerUrl.includes('/blog/')
      ? 'blog'
      : 'news';
  }
  if (lowerUrl.includes('/blog') || hostname.includes('substack.com') || hostname.includes('medium.com')) {
    return 'blog';
  }

  return 'general';
}

function removeClutter(root: Document): void {
  for (const selector of CLUTTER_SELECTORS) {
    const nodes = root.querySelectorAll(selector);
    nodes.forEach((node) => node.remove());
  }

  // Remove inline-hidden elements
  const all = root.querySelectorAll('[style]');
  all.forEach((el) => {
    const style = (el.getAttribute('style') || '').toLowerCase();
    if (
      style.includes('display: none') ||
      style.includes('display:none') ||
      style.includes('visibility: hidden') ||
      style.includes('visibility:hidden')
    ) {
      el.remove();
    }
  });
}

function extractHeadings(container: Element | Document): string[] {
  const headings: string[] = [];
  const seen = new Set<string>();
  container.querySelectorAll('h1, h2, h3').forEach((el) => {
    const text = sanitizePlainText(el.textContent || '', 160);
    if (text && !seen.has(text)) {
      seen.add(text);
      headings.push(text);
    }
  });
  return headings.slice(0, 24);
}

function extractCodeBlocks(container: Element | Document): string[] {
  const blocks: string[] = [];
  container.querySelectorAll('pre').forEach((pre) => {
    if (blocks.length >= MAX_CODE_BLOCKS) return;
    const text = sanitizePlainText(pre.textContent || '', 1200);
    if (text && text.length >= 12) {
      blocks.push(text);
    }
  });
  return blocks;
}

function extractTables(container: Element | Document): string[] {
  const tables: string[] = [];
  container.querySelectorAll('table').forEach((table) => {
    if (tables.length >= MAX_TABLES) return;
    const rows: string[] = [];
    table.querySelectorAll('tr').forEach((tr, idx) => {
      if (idx >= 12) return;
      const cells = Array.from(tr.querySelectorAll('th, td')).map((cell) =>
        sanitizePlainText(cell.textContent || '', 80).replace(/\|/g, '/'),
      );
      if (cells.some((c) => c.length > 0)) {
        rows.push(`| ${cells.join(' | ')} |`);
      }
    });
    if (rows.length > 0) {
      tables.push(rows.join('\n'));
    }
  });
  return tables;
}

function extractKeyLinks(
  container: Element | Document,
  pageUrl: string,
): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const seen = new Set<string>();

  container.querySelectorAll('a[href]').forEach((a) => {
    if (links.length >= MAX_LINKS) return;
    const text = sanitizePlainText(a.textContent || '', 80);
    if (!text || text.length < 3) return;
    const rawHref = a.getAttribute('href') || '';
    if (rawHref.startsWith('#')) return;

    try {
      const resolved = new URL(rawHref, pageUrl).toString();
      const safe = sanitizeHttpUrl(resolved);
      if (safe && !seen.has(safe)) {
        seen.add(safe);
        links.push({ text, href: safe });
      }
    } catch {
      // Ignore malformed URLs
    }
  });

  return links;
}

function extractSections(container: Element | Document): ExtractedSection[] {
  const sections: ExtractedSection[] = [];
  const headings = Array.from(container.querySelectorAll('h1, h2, h3'));
  if (headings.length === 0) return sections;

  for (const h of headings) {
    if (sections.length >= MAX_SECTIONS) break;
    const headingText = sanitizePlainText(h.textContent || '', 120);
    if (!headingText) continue;

    const parts: string[] = [];
    let sibling = h.nextElementSibling;
    while (sibling && !/^H[1-3]$/.test(sibling.tagName)) {
      const text = sanitizePlainText(sibling.textContent || '', 600);
      if (text) parts.push(text);
      if (parts.join('\n').length > 1000) break;
      sibling = sibling.nextElementSibling;
    }

    if (parts.length > 0) {
      sections.push({
        heading: headingText,
        content: parts.join('\n'),
      });
    }
  }
  return sections;
}

function extractDomainSpecificText(
  doc: Document,
  pageType: PageType,
): string | null {
  if (pageType === 'github') {
    const about = sanitizePlainText(
      doc.querySelector('.BorderGrid-cell p, [data-pjax="#repo-content-pjax-container"] .f4')
        ?.textContent || '',
      400,
    );
    const readme = sanitizePlainText(
      doc.querySelector('article.markdown-body')?.textContent || '',
      14000,
    );
    const combined = [about ? `Repository summary: ${about}` : '', readme]
      .filter(Boolean)
      .join('\n\n');
    return combined || null;
  }

  if (pageType === 'stackoverflow') {
    const question = sanitizePlainText(
      doc.querySelector('.question .js-post-body')?.textContent || '',
      6000,
    );
    const answers = Array.from(
      doc.querySelectorAll('.answer .js-post-body'),
    )
      .slice(0, 3)
      .map((el, i) => `Answer ${i + 1}:\n${sanitizePlainText(el.textContent || '', 3000)}`);
    const combined = [question ? `Question:\n${question}` : '', ...answers]
      .filter(Boolean)
      .join('\n\n');
    return combined || null;
  }

  if (pageType === 'youtube') {
    const title = sanitizePlainText(
      doc.querySelector('h1.ytd-watch-metadata, h1.title')?.textContent || '',
      200,
    );
    const channel = sanitizePlainText(
      doc.querySelector('#channel-name a, ytd-channel-name a')?.textContent || '',
      120,
    );
    const description = sanitizePlainText(
      doc.querySelector('#description-inner, #description')?.textContent || '',
      6000,
    );
    const parts = [
      title ? `Video Title: ${title}` : '',
      channel ? `Channel: ${channel}` : '',
      description ? `Description:\n${description}` : '',
    ].filter(Boolean);
    return parts.length > 0 ? parts.join('\n\n') : null;
  }

  return null;
}

/**
 * Extracts structured, sanitized readable content from a DOM Document.
 * Safe to run in both browser content scripts and jsdom unit tests.
 */
export function extractPageContent(
  doc: Document,
  url: string,
  favIconUrl?: string,
): ExtractedPageContent {
  const domain = extractDomain(url);
  const pageType = detectPageType(url, doc);

  const metadata: PageMetadata = {
    title:
      sanitizePlainText(doc.title || '', 240) ||
      getMetaContent(doc, ['meta[property="og:title"]', 'meta[name="twitter:title"]']) ||
      domain,
    url,
    domain,
    favIconUrl: favIconUrl ? sanitizeHttpUrl(favIconUrl) ?? undefined : undefined,
    author: getMetaContent(doc, [
      'meta[name="author"]',
      'meta[property="article:author"]',
    ]),
    publishedDate: getMetaContent(doc, [
      'meta[property="article:published_time"]',
      'meta[name="date"]',
      'time[datetime]',
    ]),
    siteName: getMetaContent(doc, ['meta[property="og:site_name"]']),
    description: getMetaContent(doc, [
      'meta[name="description"]',
      'meta[property="og:description"]',
    ]),
    language: doc.documentElement?.lang || undefined,
  };

  // Clone document before mutating for extraction
  const clonedDoc = doc.cloneNode(true) as Document;
  removeClutter(clonedDoc);

  const domainSpecific = extractDomainSpecificText(clonedDoc, pageType);

  let articleText = '';
  let excerpt: string | undefined;
  let articleContainer: Element | Document = clonedDoc.body || clonedDoc;

  try {
    const reader = new Readability(clonedDoc);
    const parsed = reader.parse();
    if (parsed && parsed.textContent && parsed.textContent.trim().length > 80) {
      articleText = sanitizePlainText(parsed.textContent);
      excerpt = parsed.excerpt
        ? sanitizePlainText(parsed.excerpt, 320)
        : undefined;
      if (parsed.title && !metadata.title) {
        metadata.title = sanitizePlainText(parsed.title, 240);
      }
      if (parsed.byline && !metadata.author) {
        metadata.author = sanitizePlainText(parsed.byline, 120);
      }
      if (parsed.content) {
        const tempDoc = doc.implementation.createHTMLDocument('');
        tempDoc.body.innerHTML = parsed.content;
        articleContainer = tempDoc.body;
      }
    }
  } catch {
    // Fall back to main/article selector below if Readability fails
  }

  if (!articleText) {
    const mainEl =
      clonedDoc.querySelector('main, article, [role="main"], .content, #content') ||
      clonedDoc.body;
    if (mainEl) {
      articleContainer = mainEl;
      articleText = sanitizePlainText(mainEl.textContent || '');
    }
  }

  const mainText = domainSpecific
    ? sanitizePlainText(`${domainSpecific}\n\n${articleText}`)
    : articleText;

  const headings = extractHeadings(articleContainer);
  const sections = extractSections(articleContainer);
  const codeBlocks = extractCodeBlocks(articleContainer);
  const tables = extractTables(articleContainer);
  const keyLinks = extractKeyLinks(articleContainer, url);

  const wordCount = mainText ? mainText.split(/\s+/).filter(Boolean).length : 0;
  const contentHash = hashContent(`${metadata.title}\n${mainText.slice(0, 12000)}`);

  return {
    metadata,
    pageType,
    mainText,
    excerpt: excerpt ?? metadata.description,
    headings,
    sections,
    codeBlocks,
    tables,
    keyLinks,
    wordCount,
    contentHash,
    extractedAt: Date.now(),
  };
}

