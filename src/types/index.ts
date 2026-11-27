export type PageType =
  | 'news'
  | 'blog'
  | 'documentation'
  | 'github'
  | 'stackoverflow'
  | 'product'
  | 'educational'
  | 'wikipedia'
  | 'job'
  | 'youtube'
  | 'general';

export type SummaryDepth = 'brief' | 'balanced' | 'detailed';

export type ThemePreference = 'system' | 'light' | 'dark';

export type PageStatus =
  | 'idle'
  | 'reading'
  | 'analyzing'
  | 'ready'
  | 'restricted'
  | 'error';

export interface PageMetadata {
  title: string;
  url: string;
  domain: string;
  favIconUrl?: string;
  author?: string;
  publishedDate?: string;
  siteName?: string;
  description?: string;
  language?: string;
}

export interface ExtractedLink {
  text: string;
  href: string;
}

export interface ExtractedSection {
  heading: string;
  content: string;
}

export interface ExtractedPageContent {
  metadata: PageMetadata;
  pageType: PageType;
  mainText: string;
  excerpt?: string;
  headings: string[];
  sections: ExtractedSection[];
  codeBlocks: string[];
  tables: string[];
  keyLinks: ExtractedLink[];
  wordCount: number;
  contentHash: string;
  extractedAt: number;
  truncated?: boolean;
}

export interface SummaryResult {
  content: string;
  depth: SummaryDepth;
  pageType: PageType;
  model: string;
  generatedAt: number;
  contentHash: string;
  cached?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  error?: string;
}

export interface GrokModel {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
  supportsTemperature?: boolean;
}

export interface AppSettings {
  model: string;
  apiEndpoint: string;
  temperature: number;
  defaultSummaryDepth: SummaryDepth;
  theme: ThemePreference;
  autoAnalyzeOnOpen: boolean;
  saveChatHistory: boolean;
  cacheSummaries: boolean;
  cacheTtlMinutes: number;
}

export type ApiErrorCode =
  | 'MISSING_KEY'
  | 'INVALID_KEY'
  | 'INSUFFICIENT_CREDITS'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'SERVER_ERROR'
  | 'ABORTED'
  | 'INVALID_ENDPOINT'
  | 'BAD_REQUEST'
  | 'UNKNOWN';

export class PageMindApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status?: number;
  readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    code: ApiErrorCode,
    status?: number,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'PageMindApiError';
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface ExtractionResponse {
  ok: boolean;
  data?: ExtractedPageContent;
  error?: string;
  reason?: 'RESTRICTED_PAGE' | 'EMPTY_PAGE' | 'EXTRACTION_FAILED';
}

