import { describe, expect, it, vi } from 'vitest';
import {
  buildChatCompletionsRequest,
  extractSseDelta,
  parseApiErrorResponse,
  streamChatCompletion,
} from '@/services/grok';
import { PageMindApiError } from '@/types';

describe('grok API service', () => {
  it('constructs valid chat completions request payloads', () => {
    const req = buildChatCompletionsRequest({
      endpoint: 'https://api.groq.com/openai/v1/',
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Hello' }],
      temperature: 0.4,
      stream: true,
    });

    expect(req.url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(req.body.model).toBe('llama-3.3-70b-versatile');
    expect(req.body.stream).toBe(true);
    expect(req.body.temperature).toBe(0.4);
  });

  it('parses SSE deltas and [DONE] markers', () => {
    expect(
      extractSseDelta('data: {"choices":[{"delta":{"content":"Hello"}}]}'),
    ).toEqual({ done: false, delta: 'Hello' });
    expect(extractSseDelta('data: [DONE]')).toEqual({ done: true, delta: '' });
    expect(extractSseDelta(': keep-alive')).toEqual({ done: false, delta: '' });
  });

  it('maps HTTP status codes to friendly PageMindApiError codes', async () => {
    const unauth = new Response(JSON.stringify({ error: { message: 'bad key' } }), {
      status: 401,
    });
    const err401 = await parseApiErrorResponse(unauth);
    expect(err401.code).toBe('INVALID_KEY');

    const rate = new Response('', {
      status: 429,
      headers: { 'retry-after': '12' },
    });
    const err429 = await parseApiErrorResponse(rate);
    expect(err429.code).toBe('RATE_LIMITED');
    expect(err429.retryAfterSeconds).toBe(12);

    const credits = new Response(
      JSON.stringify({ error: { message: 'Insufficient credit balance' } }),
      { status: 402 },
    );
    const err402 = await parseApiErrorResponse(credits);
    expect(err402.code).toBe('INSUFFICIENT_CREDITS');
  });

  it('streams SSE response chunks using fetch mock', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":"Page "}}]}\n'),
        );
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":"Mind"}}]}\n'),
        );
        controller.enqueue(encoder.encode('data: [DONE]\n'));
        controller.close();
      },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(stream, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      }),
    );

    const tokens: string[] = [];
    const result = await streamChatCompletion({
      apiKey: 'dummy-test-key',
      model: 'grok-4.7',
      messages: [{ role: 'user', content: 'Summarize' }],
      onToken: (delta) => tokens.push(delta),
    });

    expect(result).toBe('Page Mind');
    expect(tokens).toEqual(['Page ', 'Mind']);
  });

  it('throws MISSING_KEY when apiKey is empty', async () => {
    await expect(
      streamChatCompletion({
        apiKey: '   ',
        model: 'grok-4.7',
        messages: [{ role: 'user', content: 'Hi' }],
        onToken: () => {},
      }),
    ).rejects.toBeInstanceOf(PageMindApiError);
  });
});

