import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppSettings,
  ExtractedPageContent,
  ExtractionResponse,
  PageMindApiError,
  PageStatus,
  SummaryDepth,
  SummaryResult,
} from '@/types';
import {
  getApiKey,
  getCachedSummary,
  setCachedSummary,
} from '@/storage/settings';
import { checkPageAccess, extractDomain } from '@/utils/permissions';
import { streamChatCompletion } from '@/services/grok';
import { buildSummaryPrompt } from '@/services/summarizer';

export interface ActiveTabPreview {
  title: string;
  url: string;
  domain: string;
  favIconUrl?: string;
}

export interface UsePageContentResult {
  tabPreview: ActiveTabPreview | null;
  pageContent: ExtractedPageContent | null;
  status: PageStatus;
  statusMessage: string;
  errorMessage: string | null;
  summary: SummaryResult | null;
  summaryStreaming: boolean;
  depth: SummaryDepth;
  setDepth: (depth: SummaryDepth) => void;
  analyzePage: (options?: {
    forceRefresh?: boolean;
    overrideDepth?: SummaryDepth;
    pageOverride?: ExtractedPageContent;
  }) => Promise<void>;
  stopSummary: () => void;
  retryExtraction: () => Promise<void>;
}

export function usePageContent(
  settings: AppSettings,
  hasConfiguredKey: boolean,
  settingsLoaded: boolean,
): UsePageContentResult {
  const [tabPreview, setTabPreview] = useState<ActiveTabPreview | null>(null);
  const [pageContent, setPageContent] = useState<ExtractedPageContent | null>(null);
  const [status, setStatus] = useState<PageStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('Reading page…');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [summaryStreaming, setSummaryStreaming] = useState(false);
  const [depth, setDepthState] = useState<SummaryDepth>(settings.defaultSummaryDepth);

  const abortRef = useRef<AbortController | null>(null);
  const autoTriggeredRef = useRef(false);

  useEffect(() => {
    setDepthState(settings.defaultSummaryDepth);
  }, [settings.defaultSummaryDepth]);

  const stopSummary = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSummaryStreaming(false);
  }, []);

  const analyzePage = useCallback(
    async (options?: {
      forceRefresh?: boolean;
      overrideDepth?: SummaryDepth;
      pageOverride?: ExtractedPageContent;
    }) => {
      const targetPage = options?.pageOverride ?? pageContent;
      if (!targetPage) return;

      const targetDepth = options?.overrideDepth ?? depth;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setErrorMessage(null);

      // Check local cache first unless forceRefresh is requested
      if (settings.cacheSummaries && !options?.forceRefresh) {
        const cached = await getCachedSummary(
          targetPage.metadata.url,
          targetDepth,
          targetPage.contentHash,
          settings.cacheTtlMinutes,
        );
        if (cached) {
          setSummary(cached);
          setStatus('ready');
          setStatusMessage('Ready to chat');
          return;
        }
      }

      const apiKey = await getApiKey();
      if (!apiKey) {
        setErrorMessage(
          'Add your xAI API key in Settings to generate a summary.',
        );
        setStatus('error');
        setStatusMessage('API key required');
        return;
      }

      setStatus('analyzing');
      setStatusMessage('Analyzing content…');
      setSummaryStreaming(true);

      const { messages } = buildSummaryPrompt(targetPage, targetDepth);
      let latestText = '';

      try {
        const finalText = await streamChatCompletion({
          apiKey,
          endpoint: settings.apiEndpoint,
          model: settings.model,
          messages,
          temperature: settings.temperature,
          signal: controller.signal,
          onToken: (_delta, full) => {
            latestText = full;
            setSummary({
              content: full,
              depth: targetDepth,
              pageType: targetPage.pageType,
              model: settings.model,
              generatedAt: Date.now(),
              contentHash: targetPage.contentHash,
              cached: false,
            });
          },
        });

        const result: SummaryResult = {
          content: finalText || latestText,
          depth: targetDepth,
          pageType: targetPage.pageType,
          model: settings.model,
          generatedAt: Date.now(),
          contentHash: targetPage.contentHash,
          cached: false,
        };

        setSummary(result);
        setStatus('ready');
        setStatusMessage('Ready to chat');

        if (settings.cacheSummaries && result.content.trim()) {
          await setCachedSummary(targetPage.metadata.url, result);
        }
      } catch (err) {
        if (err instanceof PageMindApiError && err.code === 'ABORTED') {
          setStatus('ready');
          setStatusMessage(latestText ? 'Summary stopped' : 'Ready to chat');
          return;
        }
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to generate summary. Please try again.';
        setErrorMessage(message);
        setStatus('error');
        setStatusMessage('Summary failed');
      } finally {
        setSummaryStreaming(false);
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [
      depth,
      pageContent,
      settings.apiEndpoint,
      settings.cacheSummaries,
      settings.cacheTtlMinutes,
      settings.model,
      settings.temperature,
    ],
  );

  const extractActiveTab = useCallback(async () => {
    setStatus('reading');
    setStatusMessage('Reading page…');
    setErrorMessage(null);

    if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
      setStatus('restricted');
      setStatusMessage('Extension context unavailable');
      setErrorMessage('Open PageMind from the browser toolbar on a webpage.');
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab?.id) {
        setStatus('restricted');
        setStatusMessage('No active tab');
        setErrorMessage('No active browser tab was found.');
        return;
      }

      const url = tab.url ?? '';
      const domain = url ? extractDomain(url) : 'Unknown page';
      setTabPreview({
        title: tab.title || domain,
        url,
        domain,
        favIconUrl: tab.favIconUrl,
      });

      const access = checkPageAccess(url);
      if (!access.allowed) {
        setStatus('restricted');
        setStatusMessage('Unable to extract content');
        setErrorMessage(
          access.reason ?? 'This page cannot be read by browser extensions.',
        );
        return;
      }

      // Inject content script on demand using activeTab + scripting
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-script.js'],
      });

      const response = (await chrome.tabs.sendMessage(tab.id, {
        type: 'PAGEMIND_EXTRACT_PAGE',
        favIconUrl: tab.favIconUrl,
      })) as ExtractionResponse | undefined;

      if (!response || !response.ok || !response.data) {
        setStatus(
          response?.reason === 'RESTRICTED_PAGE' ? 'restricted' : 'error',
        );
        setStatusMessage('Unable to extract content');
        setErrorMessage(
          response?.error ||
            'Could not extract readable content from this webpage.',
        );
        return;
      }

      const extracted = response.data;
      setPageContent(extracted);

      // Load cached summary if available (no network call)
      if (settings.cacheSummaries) {
        const cached = await getCachedSummary(
          extracted.metadata.url,
          depth,
          extracted.contentHash,
          settings.cacheTtlMinutes,
        );
        if (cached) {
          setSummary(cached);
          setStatus('ready');
          setStatusMessage('Ready to chat');
          return;
        }
      }

      setStatus('ready');
      setStatusMessage('Ready to analyze');

      if (
        settings.autoAnalyzeOnOpen &&
        hasConfiguredKey &&
        !autoTriggeredRef.current
      ) {
        autoTriggeredRef.current = true;
        await analyzePage({ pageOverride: extracted });
      }
    } catch {
      setStatus('error');
      setStatusMessage('Unable to extract content');
      setErrorMessage(
        'Could not access this tab. Try refreshing the webpage and opening PageMind again.',
      );
    }
  }, [
    analyzePage,
    depth,
    hasConfiguredKey,
    settings.autoAnalyzeOnOpen,
    settings.cacheSummaries,
    settings.cacheTtlMinutes,
  ]);

  useEffect(() => {
    if (!settingsLoaded) return;
    void extractActiveTab();
    return () => {
      abortRef.current?.abort();
    };
    // Run once when settings are loaded for this popup session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoaded]);

  const setDepth = useCallback(
    (nextDepth: SummaryDepth) => {
      setDepthState(nextDepth);
      if (pageContent && (summary || settings.autoAnalyzeOnOpen)) {
        void analyzePage({ overrideDepth: nextDepth });
      }
    },
    [analyzePage, pageContent, settings.autoAnalyzeOnOpen, summary],
  );

  return {
    tabPreview,
    pageContent,
    status,
    statusMessage,
    errorMessage,
    summary,
    summaryStreaming,
    depth,
    setDepth,
    analyzePage,
    stopSummary,
    retryExtraction: extractActiveTab,
  };
}

