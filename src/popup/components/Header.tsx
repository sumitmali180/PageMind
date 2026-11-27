import React from 'react';
import { ArrowLeft, Settings } from 'lucide-react';

interface HeaderProps {
  domain?: string;
  showSettings: boolean;
  onToggleSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  domain,
  showSettings,
  onToggleSettings,
}) => {
  return (
    <header className="pm-header">
      <div className="pm-brand">
        <span className="pm-logo" aria-hidden="true">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="2"
              y="1.75"
              width="12"
              height="12.5"
              rx="2.5"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeOpacity="0.35"
            />
            <path
              d="M4.5 5.25H11.5M4.5 8H9.75M4.5 10.75H7.75"
              stroke="currentColor"
              strokeWidth="1.35"
              strokeLinecap="round"
            />
            <circle cx="11" cy="10.75" r="1.15" fill="var(--pm-accent)" />
          </svg>
        </span>
        <span className="pm-brand-name">PageMind</span>
        {domain && !showSettings && (
          <span className="pm-domain-pill" title={domain}>
            {domain}
          </span>
        )}
      </div>

      <button
        type="button"
        className="pm-icon-btn"
        onClick={onToggleSettings}
        aria-label={showSettings ? 'Back to page view' : 'Open settings'}
        title={showSettings ? 'Back' : 'Settings'}
      >
        {showSettings ? <ArrowLeft size={16} /> : <Settings size={16} />}
      </button>
    </header>
  );
};

