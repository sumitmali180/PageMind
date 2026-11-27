import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '@/popup/App';
import { Chat } from '@/popup/components/Chat';
import { Summary } from '@/popup/components/Summary';
import { saveApiKey } from '@/storage/settings';

describe('Popup UI components', () => {
  it('shows first-launch setup screen when no API key is configured', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Connect your Groq API key')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Groq API Key')).toBeInTheDocument();
  });

  it('allows opening Settings and toggling back when API key exists', async () => {
    await saveApiKey('dummy-test-key-9999');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText('Open settings')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Open settings'));
    expect(screen.getByText('AI Configuration')).toBeInTheDocument();
    expect(screen.getByText('Privacy & Security')).toBeInTheDocument();
  });

  it('renders Summary controls and triggers depth change', () => {
    const onChangeDepth = vi.fn();
    const onAnalyze = vi.fn();

    render(
      <Summary
        summary={{
          content: '**Main idea:** Great article.',
          depth: 'balanced',
          pageType: 'blog',
          model: 'grok-4.7',
          generatedAt: Date.now(),
          contentHash: 'abc',
        }}
        isStreaming={false}
        depth="balanced"
        canAnalyze={true}
        onChangeDepth={onChangeDepth}
        onAnalyze={onAnalyze}
        onStop={() => {}}
      />,
    );

    expect(screen.getByText('Great article.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Detailed' }));
    expect(onChangeDepth).toHaveBeenCalledWith('detailed');
  });

  it('handles Chat IME-safe Enter submission and starter prompts', () => {
    const onSend = vi.fn();
    render(
      <Chat
        messages={[]}
        isStreaming={false}
        disabled={false}
        pageType="documentation"
        onSend={onSend}
        onStop={() => {}}
        onRetry={() => {}}
        onClear={() => {}}
      />,
    );

    fireEvent.click(screen.getByText('Explain this in simple terms'));
    expect(onSend).toHaveBeenCalledWith('Explain this in simple terms');

    const input = screen.getByLabelText('Ask a question about this webpage');
    fireEvent.change(input, { target: { value: 'How does auth work?' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
    expect(onSend).toHaveBeenCalledWith('How does auth work?');
  });

  it('supports mouse resizing in both axes and resets to default size on reopen', async () => {
    const { unmount } = render(<App />);

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--pm-popup-width')).toBe('420px');
      expect(document.documentElement.style.getPropertyValue('--pm-popup-height')).toBe('580px');
    });

    const dragHandle = (
      el: HTMLElement,
      start: { x: number; y: number },
      end: { x: number; y: number },
    ) => {
      fireEvent(
        el,
        new MouseEvent('pointerdown', {
          bubbles: true,
          button: 0,
          screenX: start.x,
          screenY: start.y,
        }),
      );
      fireEvent(
        el,
        new MouseEvent('pointermove', {
          bubbles: true,
          screenX: end.x,
          screenY: end.y,
        }),
      );
      fireEvent(el, new MouseEvent('pointerup', { bubbles: true }));
    };

    const brHandle = screen.getByLabelText('Resize popup from bottom-right corner');
    dragHandle(brHandle, { x: 500, y: 500 }, { x: 620, y: 580 });

    expect(document.documentElement.style.getPropertyValue('--pm-popup-width')).toBe('540px');
    expect(document.documentElement.style.getPropertyValue('--pm-popup-height')).toBe('660px');

    const leftHandle = screen.getByLabelText('Resize popup horizontally from left edge');
    dragHandle(leftHandle, { x: 300, y: 300 }, { x: 200, y: 300 });

    expect(document.documentElement.style.getPropertyValue('--pm-popup-width')).toBe('640px');

    fireEvent.doubleClick(brHandle);
    expect(document.documentElement.style.getPropertyValue('--pm-popup-width')).toBe('420px');
    expect(document.documentElement.style.getPropertyValue('--pm-popup-height')).toBe('580px');

    // Resize again, then unmount and remount to simulate reopening the popup
    dragHandle(brHandle, { x: 500, y: 500 }, { x: 400, y: 400 });
    expect(document.documentElement.style.getPropertyValue('--pm-popup-width')).toBe('320px');
    expect(document.documentElement.style.getPropertyValue('--pm-popup-height')).toBe('480px');

    unmount();
    render(<App />);
    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--pm-popup-width')).toBe('420px');
      expect(document.documentElement.style.getPropertyValue('--pm-popup-height')).toBe('580px');
    });
  });
});

