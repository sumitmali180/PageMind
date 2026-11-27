import React, { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  RefreshCw,
  Sparkles,
  Square,
} from 'lucide-react';
import { SummaryDepth, SummaryResult } from '@/types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { LoadingState } from './LoadingState';

interface SummaryProps {
  summary: SummaryResult | null;
  isStreaming: boolean;
  depth: SummaryDepth;
  canAnalyze: boolean;
  onChangeDepth: (depth: SummaryDepth) => void;
  onAnalyze: (forceRefresh?: boolean) => void;
  onStop: () => void;
}

const DEPTH_OPTIONS: Array<{ value: SummaryDepth; label: string }> = [
  { value: 'brief', label: 'Brief' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'detailed', label: 'Detailed' },
];

export const Summary: React.FC<SummaryProps> = ({
  summary,
  isStreaming,
  depth,
  canAnalyze,
  onChangeDepth,
  onAnalyze,
  onStop,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!summary?.content) return;
    try {
      await navigator.clipboard.writeText(summary.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard write may fail if popup loses focus
    }
  };

  return (
    <section className="pm-section pm-summary-card" aria-label="Page summary">
      <div className="pm-summary-toolbar">
        <div className="pm-summary-heading">
          <span className="pm-section-title">Summary</span>
          {summary?.cached && <span className="pm-badge">Cached</span>}
        </div>

        <div className="pm-summary-controls">
          <div
            className="pm-segmented"
            role="group"
            aria-label="Summary depth"
          >
            {DEPTH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`pm-seg-btn ${depth === opt.value ? 'is-active' : ''}`}
                aria-pressed={depth === opt.value}
                disabled={isStreaming}
                onClick={() => onChangeDepth(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {isStreaming ? (
            <button
              type="button"
              className="pm-icon-btn pm-icon-btn-sm"
              onClick={onStop}
              aria-label="Stop generating summary"
              title="Stop"
            >
              <Square size={13} />
            </button>
          ) : (
            summary && (
              <>
                <button
                  type="button"
                  className="pm-icon-btn pm-icon-btn-sm"
                  onClick={() => onAnalyze(true)}
                  disabled={!canAnalyze}
                  aria-label="Regenerate summary"
                  title="Regenerate"
                >
                  <RefreshCw size={13} />
                </button>
                <button
                  type="button"
                  className="pm-icon-btn pm-icon-btn-sm"
                  onClick={handleCopy}
                  aria-label={copied ? 'Summary copied' : 'Copy summary'}
                  title={copied ? 'Copied' : 'Copy summary'}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                </button>
                <button
                  type="button"
                  className="pm-icon-btn pm-icon-btn-sm"
                  onClick={() => setCollapsed((c) => !c)}
                  aria-expanded={!collapsed}
                  aria-label={collapsed ? 'Expand summary' : 'Collapse summary'}
                  title={collapsed ? 'Expand' : 'Collapse'}
                >
                  {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
              </>
            )
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="pm-summary-body">
          {!summary && !isStreaming && (
            <div className="pm-summary-empty">
              <p className="pm-muted-text">
                Page content extracted locally. Nothing is sent to Groq until you
                analyze or ask a question.
              </p>
              <button
                type="button"
                className="pm-btn pm-btn-primary"
                disabled={!canAnalyze}
                onClick={() => onAnalyze(false)}
              >
                <Sparkles size={14} />
                <span>Summarize page</span>
              </button>
            </div>
          )}

          {isStreaming && !summary?.content && (
            <LoadingState label="Generating summary…" />
          )}

          {summary?.content && <MarkdownRenderer content={summary.content} />}
        </div>
      )}
    </section>
  );
};

