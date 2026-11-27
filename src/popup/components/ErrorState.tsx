import React from 'react';
import { AlertCircle, Lock, RefreshCw, Settings } from 'lucide-react';

interface ErrorStateProps {
  title: string;
  message: string;
  variant?: 'error' | 'restricted';
  onRetry?: () => void;
  onOpenSettings?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  message,
  variant = 'error',
  onRetry,
  onOpenSettings,
}) => {
  return (
    <div className="pm-error-card" role="alert">
      <div className="pm-error-header">
        {variant === 'restricted' ? (
          <Lock size={15} className="pm-error-icon" aria-hidden="true" />
        ) : (
          <AlertCircle size={15} className="pm-error-icon" aria-hidden="true" />
        )}
        <span className="pm-error-title">{title}</span>
      </div>
      <p className="pm-error-message">{message}</p>
      {(onRetry || onOpenSettings) && (
        <div className="pm-error-actions">
          {onRetry && (
            <button type="button" className="pm-btn pm-btn-secondary" onClick={onRetry}>
              <RefreshCw size={13} />
              <span>Retry</span>
            </button>
          )}
          {onOpenSettings && (
            <button
              type="button"
              className="pm-btn pm-btn-secondary"
              onClick={onOpenSettings}
            >
              <Settings size={13} />
              <span>Settings</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

