import { ExtractionResponse } from '@/types';
import { extractPageContent } from './extraction';

declare global {
  interface Window {
    __pagemindListenerRegistered?: boolean;
  }
}

if (!window.__pagemindListenerRegistered) {
  window.__pagemindListenerRegistered = true;

  chrome.runtime.onMessage.addListener(
    (
      message: { type?: string; favIconUrl?: string },
      _sender,
      sendResponse: (response: ExtractionResponse) => void,
    ) => {
      if (message?.type !== 'PAGEMIND_EXTRACT_PAGE') {
        return false;
      }

      try {
        const extracted = extractPageContent(
          document,
          window.location.href,
          message.favIconUrl,
        );

        if (!extracted.mainText || extracted.wordCount < 10) {
          sendResponse({
            ok: false,
            reason: 'EMPTY_PAGE',
            error:
              'Not enough readable text was found on this page. It may be an image-only page, canvas app, or require scrolling/interaction.',
          });
          return true;
        }

        sendResponse({ ok: true, data: extracted });
      } catch {
        sendResponse({
          ok: false,
          reason: 'EXTRACTION_FAILED',
          error: 'Could not extract readable content from this page.',
        });
      }
      return true;
    },
  );
}

