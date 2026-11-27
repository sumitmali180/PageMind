import React, { useState } from 'react';
import { Check, Copy, RotateCcw } from 'lucide-react';
import { ChatMessage } from '@/types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageProps {
  message: ChatMessage;
  isStreaming?: boolean;
  isLastAssistant?: boolean;
  onRetry?: () => void;
}

export const Message: React.FC<MessageProps> = ({
  message,
  isStreaming = false,
  isLastAssistant = false,
  onRetry,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard errors when focus is lost
    }
  };

  if (message.role === 'user') {
    return (
      <div className="pm-msg pm-msg-user">
        <div className="pm-msg-bubble">{message.content}</div>
      </div>
    );
  }

  return (
    <div className="pm-msg pm-msg-assistant">
      <div className="pm-msg-content">
        {message.error ? (
          <div className="pm-msg-error" role="alert">
            <span>{message.error}</span>
          </div>
        ) : message.content ? (
          <MarkdownRenderer content={message.content} />
        ) : isStreaming ? (
          <span className="pm-typing-indicator" aria-label="Thinking">
            <span />
            <span />
            <span />
          </span>
        ) : null}
      </div>

      {!isStreaming && (message.content || message.error) && (
        <div className="pm-msg-actions">
          {message.content && (
            <button
              type="button"
              className="pm-text-btn"
              onClick={handleCopy}
              aria-label={copied ? 'Response copied' : 'Copy response'}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}
          {isLastAssistant && onRetry && (
            <button
              type="button"
              className="pm-text-btn"
              onClick={onRetry}
              aria-label="Retry response"
            >
              <RotateCcw size={12} />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

