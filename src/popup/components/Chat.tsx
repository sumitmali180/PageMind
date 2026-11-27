import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowUp, Square, Trash2 } from 'lucide-react';
import { ChatMessage, PageType } from '@/types';
import { getStarterPrompts } from '@/services/summarizer';
import { Message } from './Message';

interface ChatProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  disabled: boolean;
  pageType: PageType;
  onSend: (text: string) => void;
  onStop: () => void;
  onRetry: () => void;
  onClear: () => void;
}

export const Chat: React.FC<ChatProps> = ({
  messages,
  isStreaming,
  disabled,
  pageType,
  onSend,
  onStop,
  onRetry,
  onClear,
}) => {
  const [input, setInput] = useState('');
  const inputId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const starterPrompts = getStarterPrompts(pageType);

  useEffect(() => {
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || disabled || isStreaming) return;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSend(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // IME-safe check: do not submit while composing characters
      if (e.nativeEvent.isComposing || e.keyCode === 229) {
        return;
      }
      formRef.current?.requestSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 104)}px`;
  };

  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return i;
    }
    return -1;
  })();

  return (
    <section className="pm-section pm-chat-section" aria-label="Ask about this page">
      <div className="pm-chat-header">
        <span className="pm-section-title">Ask PageMind</span>
        {messages.length > 0 && (
          <button
            type="button"
            className="pm-text-btn"
            onClick={onClear}
            aria-label="Clear conversation"
          >
            <Trash2 size={12} />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div className="pm-chat-messages" ref={listRef} aria-live="polite">
        {messages.length === 0 ? (
          <div className="pm-starter-list">
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="pm-starter-chip"
                disabled={disabled || isStreaming}
                onClick={() => onSend(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : (
          messages.map((msg, idx) => (
            <Message
              key={msg.id}
              message={msg}
              isStreaming={isStreaming && idx === messages.length - 1}
              isLastAssistant={idx === lastAssistantIdx}
              onRetry={onRetry}
            />
          ))
        )}
      </div>

      <form ref={formRef} className="pm-chat-form" onSubmit={handleSubmit}>
        <label htmlFor={inputId} className="pm-visually-hidden">
          Ask a question about this webpage
        </label>
        <textarea
          ref={textareaRef}
          id={inputId}
          className="pm-chat-input"
          rows={1}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? 'Page content unavailable…'
              : 'Ask anything about this page… (Enter to send)'
          }
          disabled={disabled}
        />

        {isStreaming ? (
          <button
            type="button"
            className="pm-send-btn pm-stop-btn"
            onClick={onStop}
            aria-label="Stop generation"
            title="Stop"
          >
            <Square size={14} />
          </button>
        ) : (
          <button
            type="submit"
            className="pm-send-btn"
            disabled={disabled || !input.trim()}
            aria-label="Send message"
            title="Send (Enter)"
          >
            <ArrowUp size={15} />
          </button>
        )}
      </form>
    </section>
  );
};

