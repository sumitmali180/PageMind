import {
  ChatMessage,
  GrokModel,
  PageMindApiError,
} from '@/types';
import { DEFAULT_XAI_ENDPOINT, validateApiEndpoint } from '@/utils/permissions';
import { redactSensitiveTokens } from '@/utils/sanitize';

export const AVAILABLE_GROK_MODELS: GrokModel[] = [
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile',
    description: 'High-quality reasoning, summarization & Q&A on Groq',
    contextWindow: 128_000,
    supportsTemperature: true,
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant',
    description: 'Ultra-fast responses for quick summaries & chat',
    contextWindow: 128_000,
    supportsTemperature: true,
  },
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT-OSS 120B',
    description: 'Open-weight reasoning model on Groq',
    contextWindow: 128_000,
    supportsTemperature: true,
  },
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT-OSS 20B',
    description: 'Fast open-weight model on Groq',
    contextWindow: 128_000,
    supportsTemperature: true,
  },
];

export interface GrokMessagePayload {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamCompletionOptions {
  apiKey: string;
  endpoint?: string;
  model: string;
  messages: GrokMessagePayload[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onToken: (delta: string, fullText: string) => void;
}

export function buildChatCompletionsRequest(options: {
  endpoint?: string;
  model: string;
  messages: GrokMessagePayload[];
  temperature?: number;
  maxTokens?: number;
  stream: boolean;
}): { url: string; body: Record<string, unknown> } {
  const endpointCheck = validateApiEndpoint(
    options.endpoint || DEFAULT_XAI_ENDPOINT,
  );
  if (!endpointCheck.valid || !endpointCheck.normalizedUrl) {
    throw new PageMindApiError(
      endpointCheck.error || 'Invalid API endpoint.',
      'INVALID_ENDPOINT',
    );
  }

  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    stream: options.stream,
  };

  if (typeof options.temperature === 'number') {
    body.temperature = Math.min(2, Math.max(0, options.temperature));
  }
  if (typeof options.maxTokens === 'number' && options.maxTokens > 0) {
    body.max_tokens = options.maxTokens;
  }

  return {
    url: `${endpointCheck.normalizedUrl}/chat/completions`,
    body,
  };
}

export async function parseApiErrorResponse(
  response: Response,
): Promise<PageMindApiError> {
  let detail = '';
  try {
    const text = await response.text();
    try {
      const json = JSON.parse(text) as {
        error?: { message?: string; code?: string } | string;
        message?: string;
      };
      if (typeof json.error === 'string') {
        detail = json.error;
      } else if (json.error?.message) {
        detail = json.error.message;
      } else if (json.message) {
        detail = json.message;
      }
    } catch {
      detail = text.slice(0, 200);
    }
  } catch {
    detail = '';
  }

  const safeDetail = redactSensitiveTokens(detail);
  const status = response.status;

  if (status === 401) {
    return new PageMindApiError(
      'Your Groq API key is invalid or expired. Check your key in Settings.',
      'INVALID_KEY',
      status,
    );
  }

  if (status === 402 || /credit|balance|quota|billing/i.test(safeDetail)) {
    return new PageMindApiError(
      'Your API account has insufficient credits or quota.',
      'INSUFFICIENT_CREDITS',
      status,
    );
  }

  if (status === 403) {
    return new PageMindApiError(
      'Access denied by the API. Verify your API key permissions and account status.',
      'INVALID_KEY',
      status,
    );
  }

  if (status === 429) {
    const retryHeader = response.headers.get('retry-after');
    const retrySeconds = retryHeader ? Number.parseInt(retryHeader, 10) : undefined;
    return new PageMindApiError(
      retrySeconds && !Number.isNaN(retrySeconds)
        ? `Rate limit reached. Please wait about ${retrySeconds} seconds and try again.`
        : 'Rate limit reached on the Groq API. Please wait a moment and try again.',
      'RATE_LIMITED',
      status,
      Number.isNaN(retrySeconds) ? undefined : retrySeconds,
    );
  }

  if (status === 400 || status === 422) {
    return new PageMindApiError(
      safeDetail || 'The request was rejected by the API. Check your model selection and settings.',
      'BAD_REQUEST',
      status,
    );
  }

  if (status === 404) {
    return new PageMindApiError(
      'The selected model or API endpoint was not found. Verify your model name in Settings.',
      'BAD_REQUEST',
      status,
    );
  }

  if (status >= 500) {
    return new PageMindApiError(
      'The xAI API is temporarily unavailable. Please try again in a moment.',
      'SERVER_ERROR',
      status,
    );
  }

  return new PageMindApiError(
    safeDetail || `API request failed with status ${status}.`,
    'UNKNOWN',
    status,
  );
}

/**
 * Parses a single SSE line ("data: {...}") and extracts any text delta.
 */
export function extractSseDelta(line: string): {
  done: boolean;
  delta: string;
} {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith('data:')) {
    return { done: false, delta: '' };
  }
  const payload = trimmed.slice(5).trim();
  if (payload === '[DONE]') {
    return { done: true, delta: '' };
  }

  try {
    const parsed = JSON.parse(payload) as {
      choices?: Array<{
        delta?: { content?: string | null };
        message?: { content?: string | null };
      }>;
    };
    const content =
      parsed.choices?.[0]?.delta?.content ??
      parsed.choices?.[0]?.message?.content ??
      '';
    return { done: false, delta: content || '' };
  } catch {
    return { done: false, delta: '' };
  }
}

export async function streamChatCompletion(
  options: StreamCompletionOptions,
): Promise<string> {
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    throw new PageMindApiError(
      'Please add your xAI API key in Settings before analyzing pages.',
      'MISSING_KEY',
    );
  }

  const { url, body } = buildChatCompletionsRequest({
    endpoint: options.endpoint,
    model: options.model,
    messages: options.messages,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    stream: true,
  });

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 90_000;
  let timedOut = false;

  const onExternalAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) {
      throw new PageMindApiError('Generation stopped.', 'ABORTED');
    }
    options.signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (timedOut) {
        throw new PageMindApiError(
          'The request to xAI timed out. Try again or switch to a faster model.',
          'TIMEOUT',
        );
      }
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new PageMindApiError('Generation stopped.', 'ABORTED');
      }
      throw new PageMindApiError(
        'Network error while contacting xAI. Check your internet connection.',
        'NETWORK_ERROR',
      );
    }

    if (!response.ok) {
      throw await parseApiErrorResponse(response);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const full = json.choices?.[0]?.message?.content ?? '';
      if (full) {
        options.onToken(full, full);
      }
      return full;
    }

    if (!response.body) {
      throw new PageMindApiError(
        'The API returned an empty response stream.',
        'SERVER_ERROR',
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      let readResult: ReadableStreamReadResult<Uint8Array>;
      try {
        readResult = await reader.read();
      } catch (err) {
        if (timedOut) {
          throw new PageMindApiError(
            'The response stream timed out before finishing.',
            'TIMEOUT',
          );
        }
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw new PageMindApiError('Generation stopped.', 'ABORTED');
        }
        throw new PageMindApiError(
          'The response stream was interrupted. You can retry the request.',
          'NETWORK_ERROR',
        );
      }

      if (readResult.done) break;
      buffer += decoder.decode(readResult.value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const { done, delta } = extractSseDelta(line);
        if (done) {
          return fullText;
        }
        if (delta) {
          fullText += delta;
          options.onToken(delta, fullText);
        }
      }
    }

    // Flush any remaining buffered line
    if (buffer.trim()) {
      const { delta } = extractSseDelta(buffer);
      if (delta) {
        fullText += delta;
        options.onToken(delta, fullText);
      }
    }

    return fullText;
  } finally {
    clearTimeout(timeoutId);
    if (options.signal) {
      options.signal.removeEventListener('abort', onExternalAbort);
    }
  }
}

/**
 * Verifies API key and endpoint connectivity using GET /v1/models (zero token cost)
 * and returns any discovered model IDs.
 */
export async function testApiConnection(
  apiKey: string,
  endpoint: string = DEFAULT_XAI_ENDPOINT,
  signal?: AbortSignal,
): Promise<{ ok: true; models: string[] }> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new PageMindApiError(
      'Please enter your xAI API key.',
      'MISSING_KEY',
    );
  }

  const endpointCheck = validateApiEndpoint(endpoint);
  if (!endpointCheck.valid || !endpointCheck.normalizedUrl) {
    throw new PageMindApiError(
      endpointCheck.error || 'Invalid API endpoint.',
      'INVALID_ENDPOINT',
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    let response: Response;
    try {
      response = await fetch(`${endpointCheck.normalizedUrl}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${trimmedKey}`,
        },
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new PageMindApiError(
          'Connection test timed out. Check your network or endpoint URL.',
          'TIMEOUT',
        );
      }
      throw new PageMindApiError(
        'Could not reach the xAI API. Check your internet connection.',
        'NETWORK_ERROR',
      );
    }

    if (!response.ok) {
      throw await parseApiErrorResponse(response);
    }

    const data = (await response.json()) as {
      data?: Array<{ id?: string }>;
    };
    const models = (data.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => Boolean(id));

    return { ok: true, models };
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onAbort);
  }
}

export function toGrokMessages(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage?: string,
): GrokMessagePayload[] {
  const messages: GrokMessagePayload[] = [
    { role: 'system', content: systemPrompt },
  ];

  for (const msg of history) {
    if (!msg.error && msg.content.trim()) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  if (userMessage && userMessage.trim()) {
    messages.push({ role: 'user', content: userMessage.trim() });
  }

  return messages;
}

