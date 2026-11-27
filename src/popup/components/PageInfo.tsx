import React, { useState } from 'react';
import { Globe } from 'lucide-react';
import { PageStatus, PageType } from '@/types';
import { sanitizeHttpUrl } from '@/utils/sanitize';

interface PageInfoProps {
  title: string;
  domain: string;
  favIconUrl?: string;
  status: PageStatus;
  statusMessage: string;
  pageType?: PageType;
  wordCount?: number;
}

const PAGE_TYPE_LABELS: Record<PageType, string> = {
  news: 'News',
  blog: 'Article',
  documentation: 'Docs',
  github: 'GitHub',
  stackoverflow: 'Q&A',
  product: 'Product',
  educational: 'Learning',
  wikipedia: 'Wiki',
  job: 'Job',
  youtube: 'Video',
  general: 'Page',
};

export const PageInfo: React.FC<PageInfoProps> = ({
  title,
  domain,
  favIconUrl,
  status,
  statusMessage,
  pageType,
  wordCount,
}) => {
  const [iconError, setIconError] = useState(false);
  const safeFavicon = favIconUrl && !iconError ? sanitizeHttpUrl(favIconUrl) : null;

  return (
    <section className="pm-page-card" aria-label="Active webpage">
      <div className="pm-page-row">
        <div className="pm-favicon-wrap" aria-hidden="true">
          {safeFavicon ? (
            <img
              src={safeFavicon}
              alt=""
              width={16}
              height={16}
              className="pm-favicon"
              onError={() => setIconError(true)}
            />
          ) : (
            <Globe size={14} className="pm-favicon-fallback" />
          )}
        </div>

        <div className="pm-page-meta">
          <h1 className="pm-page-title" title={title}>
            {title}
          </h1>
          <div className="pm-page-sub">
            <span className="pm-page-domain">{domain}</span>
            {pageType && (
              <>
                <span aria-hidden="true">·</span>
                <span className="pm-page-type">{PAGE_TYPE_LABELS[pageType]}</span>
              </>
            )}
            {typeof wordCount === 'number' && wordCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>{wordCount.toLocaleString()} words</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div
        className={`pm-status-row pm-status-${status}`}
        role="status"
        aria-live="polite"
      >
        <span className="pm-status-dot" aria-hidden="true" />
        <span>{statusMessage}</span>
      </div>
    </section>
  );
};

