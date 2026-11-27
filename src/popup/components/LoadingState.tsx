import React from 'react';

interface LoadingStateProps {
  label?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  label = 'Reading page content…',
}) => {
  return (
    <div className="pm-loading" role="status" aria-live="polite">
      <div className="pm-skeleton-line pm-skeleton-w80" />
      <div className="pm-skeleton-line pm-skeleton-w95" />
      <div className="pm-skeleton-line pm-skeleton-w65" />
      <span className="pm-visually-hidden">{label}</span>
    </div>
  );
};

