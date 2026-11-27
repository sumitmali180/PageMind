import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppSettings,
  ChatMessage,
  ExtractedPageContent,
  PageMindApiError,
} from '@/types';
import {
  clearChatHistoryForUrl,
  getApiKey,
  getChatHistory,
  saveChatHistory,
} from '@/storage/settings';
import { streamChatCompletion, toGrokMessages } from '@/services/grok';
import { trimChatHistory } from '@/services/context-manager';
import { buildChatSystemPrompt } from '@/services/summarizer';

export interface UseChatResult {
  messages: ChatMessage[];
  isStreaming: boolean;
  sendMessage: (text: string) => Promise<void>;
  stopGeneration: () => void;
  retryLast: () => Promise<void>;
  clearConversation: () => Promise<void>;
}

function createId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useChat(
  pageContent: ExtractedPageContent | null,
  settings: AppSettings,
): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const pageUrl = pageContent?.metadata.url;

  useEffect(() => {
    let active = true;
    async function load() {
      if (!pageUrl || !settings.saveChatHistory) {
        setMessages([]);
        return;
      }
      const saved = await getChatHistory(pageUrl);
      if (active) {
        setMessages(saved);
      }
    }
    void load();
    return () => {
      active = false;
      abortRef.current?.abort();
    };
  }, [pageUrl, settings.saveChatHistory]);

  const persistIfEnabled = useCallback(
    async (nextMessages: ChatMessage[]) => {
      if (pageUrl && settings.saveChatHistory) {
        await saveChatHistory(pageUrl, nextMessages);
      }
    },
    [pageUrl, settings.saveChatHistory],
  );

  const runCompletion = useCallback(
    async (historyBeforeAssistant: ChatMessage[], assistantId: string) => {
      if (!pageContent) return;

      const apiKey = await getApiKey();
      if (!apiKey) {
        const next = historyBeforeAssistant.concat({
          id: assistantId,
          role: 'assistant',
          content: '',
          createdAt: Date.now(),
          error: 'Please add your xAI API key in Settings to use chat.',
        });
        setMessages(next);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);

      const systemPrompt = buildChatSystemPrompt(pageContent);
      const trimmed = trimChatHistory(historyBeforeAssistant);
      const payloadMessages = toGrokMessages(systemPrompt, trimmed);

      let latestContent = '';

      try {
        const finalContent = await streamChatCompletion({
          apiKey,
          endpoint: settings.apiEndpoint,
          model: settings.model,
          messages: payloadMessages,
          temperature: settings.temperature,
          signal: controller.signal,
          onToken: (_delta, full) => {
            latestContent = full;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: full, error: undefined } : m,
              ),
            );
          },
        });

        const completed: ChatMessage[] = historyBeforeAssistant.concat({
          id: assistantId,
          role: 'assistant',
          content: finalContent || latestContent,
          createdAt: Date.now(),
        });
        setMessages(completed);
        await persistIfEnabled(completed);
      } catch (err) {
        if (err instanceof PageMindApiError && err.code === 'ABORTED') {
          if (latestContent.trim()) {
            const partial: ChatMessage[] = historyBeforeAssistant.concat({
              id: assistantId,
              role: 'assistant',
              content: latestContent,
              createdAt: Date.now(),
            });
            setMessages(partial);
            await persistIfEnabled(partial);
          } else {
            setMessages(historyBeforeAssistant);
          }
          return;
        }

        const errorMsg =
          err instanceof Error
            ? err.message
            : 'Something went wrong while generating a response.';
        const errored: ChatMessage[] = historyBeforeAssistant.concat({
          id: assistantId,
          role: 'assistant',
          content: latestContent,
          createdAt: Date.now(),
          error: errorMsg,
        });
        setMessages(errored);
      } finally {
        setIsStreaming(false);
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [
      pageContent,
      persistIfEnabled,
      settings.apiEndpoint,
      settings.model,
      settings.temperature,
    ],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !pageContent || isStreaming) return;

      const userMessage: ChatMessage = {
        id: createId(),
        role: 'user',
        content: trimmed,
        createdAt: Date.now(),
      };
      const assistantId = createId();
      const assistantPlaceholder: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
      };

      const historyWithUser = [...messagesRef.current, userMessage];
      setMessages([...historyWithUser, assistantPlaceholder]);
      await runCompletion(historyWithUser, assistantId);
    },
    [isStreaming, pageContent, runCompletion],
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const retryLast = useCallback(async () => {
    if (isStreaming || messagesRef.current.length === 0) return;

    const current = [...messagesRef.current];
    if (current[current.length - 1]?.role === 'assistant') {
      current.pop();
    }
    if (current.length === 0) return;

    const assistantId = createId();
    const placeholder: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
    };
    setMessages([...current, placeholder]);
    await runCompletion(current, assistantId);
  }, [isStreaming, runCompletion]);

  const clearConversation = useCallback(async () => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setMessages([]);
    if (pageUrl) {
      await clearChatHistoryForUrl(pageUrl);
    }
  }, [pageUrl]);

  return {
    messages,
    isStreaming,
    sendMessage,
    stopGeneration,
    retryLast,
    clearConversation,
  };
}

