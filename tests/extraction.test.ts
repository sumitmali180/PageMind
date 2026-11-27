import { describe, expect, it } from 'vitest';
import { detectPageType, extractPageContent } from '@/content/extraction';

describe('content extraction', () => {
  it('extracts main article content while removing nav, footer, cookie banners, and scripts', () => {
    const doc = document.implementation.createHTMLDocument('Test Article');
    doc.title = 'Understanding Manifest V3 Extensions';
    doc.body.innerHTML = `
      <nav><a href="/">Home</a><a href="/pricing">Pricing</a></nav>
      <div id="cookie-consent">Accept cookies now!</div>
      <main>
        <article>
          <h1>Understanding Manifest V3 Extensions</h1>
          <p>Manifest V3 introduces service workers to replace persistent background pages, improving browser security and memory efficiency.</p>
          <p>Developers should use activeTab and scripting permissions so extensions only access pages when the user explicitly clicks the toolbar icon.</p>
          <pre><code>chrome.scripting.executeScript({ target: { tabId }, files: ['content-script.js'] });</code></pre>
          <table>
            <tr><th>Feature</th><th>Status</th></tr>
            <tr><td>Service Worker</td><td>Required</td></tr>
          </table>
        </article>
      </main>
      <footer>Copyright 2026 Example Corp</footer>
      <script>window.secretLeak = true;</script>
    `;

    const extracted = extractPageContent(
      doc,
      'https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions',
    );

    expect(extracted.pageType).toBe('documentation');
    expect(extracted.metadata.domain).toBe('developer.mozilla.org');
    expect(extracted.mainText).toContain('Manifest V3 introduces service workers');
    expect(extracted.mainText).not.toContain('Accept cookies now');
    expect(extracted.mainText).not.toContain('secretLeak');
    expect(extracted.codeBlocks.length).toBe(1);
    expect(extracted.tables.length).toBe(1);
    expect(extracted.tables[0]).toContain('| Feature | Status |');
    expect(extracted.wordCount).toBeGreaterThan(20);
  });

  it('detects specialized page types accurately', () => {
    const emptyDoc = document.implementation.createHTMLDocument('');
    expect(detectPageType('https://github.com/facebook/react', emptyDoc)).toBe(
      'github',
    );
    expect(
      detectPageType('https://stackoverflow.com/questions/12345/test', emptyDoc),
    ).toBe('stackoverflow');
    expect(
      detectPageType('https://en.wikipedia.org/wiki/TypeScript', emptyDoc),
    ).toBe('wikipedia');
    expect(
      detectPageType('https://www.youtube.com/watch?v=dQw4w9WgXcQ', emptyDoc),
    ).toBe('youtube');
    expect(detectPageType('https://boards.greenhouse.io/acme/jobs/1', emptyDoc)).toBe(
      'job',
    );
  });
});

