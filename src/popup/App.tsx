import React, { useCallback, useEffect, useId, useState } from 'react';
import { CheckCircle2, ExternalLink, KeyRound, ShieldAlert } from 'lucide-react';
import { AppSettings } from '@/types';
import {
  DEFAULT_SETTINGS,
  getApiKey,
  getSettings,
  saveApiKey,
  saveSettings,
} from '@/storage/settings';
import { testApiConnection } from '@/services/grok';
import { maskApiKey } from '@/utils/sanitize';
import { usePageContent } from '@/hooks/usePageContent';
import { useChat } from '@/hooks/useChat';
import { Header } from './components/Header';
import { PageInfo } from './components/PageInfo';
import { Summary } from './components/Summary';
import { Chat } from './components/Chat';
import { Settings } from './components/Settings';
import { ErrorState } from './components/ErrorState';
import { LoadingState } from './components/LoadingState';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // First-launch setup state
  const [setupKey, setSetupKey] = useState('');
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSuccess, setSetupSuccess] = useState<string | null>(null);
  const setupInputId = useId();

  const refreshKeyState = useCallback(async () => {
    const key = await getApiKey();
    if (key && key.trim()) {
      setHasKey(true);
      setMaskedKey(maskApiKey(key));
    } else {
      setHasKey(false);
      setMaskedKey('');
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      const [loadedSettings, key] = await Promise.all([
        getSettings(),
        getApiKey(),
      ]);
      if (!active) return;
      setSettings(loadedSettings);
      if (key && key.trim()) {
        setHasKey(true);
        setMaskedKey(maskApiKey(key));
      }
      setSettingsLoaded(true);
    }
    void init();
    return () => {
      active = false;
    };
  }, []);

  // Apply theme attribute to root html element
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', settings.theme);
    }
  }, [settings.theme]);

  const handleUpdateSettings = useCallback(
    async (partial: Partial<AppSettings>) => {
      const next = await saveSettings(partial);
      setSettings(next);
    },
    [],
  );

  const page = usePageContent(settings, hasKey, settingsLoaded);
  const chat = useChat(page.pageContent, settings);

  const handleSetupSave = async (e: React.FormEvent, testFirst: boolean) => {
    e.preventDefault();
    const trimmed = setupKey.trim();
    if (!trimmed) return;
    setSetupBusy(true);
    setSetupError(null);
    setSetupSuccess(null);

    try {
      if (testFirst) {
        const res = await testApiConnection(trimmed, settings.apiEndpoint);
        setSetupSuccess(`Connected (${res.models.length} models available)`);
      }
      await saveApiKey(trimmed);
      setSetupKey('');
      await refreshKeyState();
      if (page.pageContent) {
        void page.analyzePage({ pageOverride: page.pageContent });
      }
    } catch (err) {
      setSetupError(
        err instanceof Error ? err.message : 'Could not verify API key.',
      );
    } finally {
      setSetupBusy(false);
    }
  };

  const activeTitle =
    page.pageContent?.metadata.title || page.tabPreview?.title || 'PageMind';
  const activeDomain =
    page.pageContent?.metadata.domain || page.tabPreview?.domain || '';

  return (
    <div className="pm-shell">
      <Header
        domain={activeDomain}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings((s) => !s)}
      />

      <main className="pm-main">
        {showSettings ? (
          <Settings
            settings={settings}
            hasKey={hasKey}
            maskedKey={maskedKey}
            onUpdateSettings={handleUpdateSettings}
            onKeyChanged={refreshKeyState}
            onBack={() => setShowSettings(false)}
          />
        ) : !hasKey && settingsLoaded ? (
          <section className="pm-setup-card" aria-label="First-time setup">
            <div className="pm-setup-header">
              <KeyRound size={18} className="pm-setup-icon" aria-hidden="true" />
              <div>
                <h1 className="pm-setup-title">Connect your Groq API key</h1>
                <p className="pm-setup-subtitle">
                  Understand any page. Ask anything.
                </p>
              </div>
            </div>

            <p className="pm-muted-text">
              PageMind runs locally in your browser using your own Groq API
              key. Your key stays in local extension storage and is only sent to{' '}
              <code>api.groq.com</code>.
            </p>

            <form
              className="pm-setup-form"
              onSubmit={(e) => void handleSetupSave(e, true)}
            >
              <label htmlFor={setupInputId} className="pm-label">
                Groq API Key
              </label>
              <input
                id={setupInputId}
                type="password"
                className="pm-input"
                value={setupKey}
                onChange={(e) => setSetupKey(e.target.value)}
                placeholder="gsk_…"
                autoComplete="off"
                spellCheck={false}
              />

              {setupError && (
                <div className="pm-inline-feedback is-err" role="alert">
                  <ShieldAlert size={13} />
                  <span>{setupError}</span>
                </div>
              )}
              {setupSuccess && (
                <div className="pm-inline-feedback is-ok" role="status">
                  <CheckCircle2 size={13} />
                  <span>{setupSuccess}</span>
                </div>
              )}

              <div className="pm-setup-actions">
                <button
                  type="submit"
                  className="pm-btn pm-btn-primary"
                  disabled={!setupKey.trim() || setupBusy}
                >
                  {setupBusy ? 'Verifying…' : 'Test & Save Key'}
                </button>
                <button
                  type="button"
                  className="pm-btn pm-btn-secondary"
                  disabled={!setupKey.trim() || setupBusy}
                  onClick={(e) => void handleSetupSave(e, false)}
                >
                  Save without testing
                </button>
              </div>
            </form>

            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="pm-link"
            >
              <span>Get a free API key at console.groq.com/keys</span>
              <ExternalLink size={12} />
            </a>
          </section>
        ) : (
          <div className="pm-workspace">
            <PageInfo
              title={activeTitle}
              domain={activeDomain}
              favIconUrl={
                page.pageContent?.metadata.favIconUrl ||
                page.tabPreview?.favIconUrl
              }
              status={page.status}
              statusMessage={page.statusMessage}
              pageType={page.pageContent?.pageType}
              wordCount={page.pageContent?.wordCount}
            />

            {page.status === 'reading' && !page.pageContent && (
              <section className="pm-section">
                <LoadingState label="Extracting readable content…" />
              </section>
            )}

            {page.status === 'restricted' && page.errorMessage && (
              <ErrorState
                title="Page cannot be read"
                message={page.errorMessage}
                variant="restricted"
              />
            )}

            {page.status === 'error' && page.errorMessage && (
              <ErrorState
                title="Unable to analyze page"
                message={page.errorMessage}
                onRetry={
                  page.pageContent
                    ? () => void page.analyzePage({ forceRefresh: true })
                    : () => void page.retryExtraction()
                }
                onOpenSettings={() => setShowSettings(true)}
              />
            )}

            {page.pageContent && (
              <>
                <Summary
                  summary={page.summary}
                  isStreaming={page.summaryStreaming}
                  depth={page.depth}
                  canAnalyze={hasKey && page.status !== 'reading'}
                  onChangeDepth={page.setDepth}
                  onAnalyze={(forceRefresh) =>
                    void page.analyzePage({ forceRefresh })
                  }
                  onStop={page.stopSummary}
                />

                <Chat
                  messages={chat.messages}
                  isStreaming={chat.isStreaming}
                  disabled={!hasKey || !page.pageContent}
                  pageType={page.pageContent.pageType}
                  onSend={(text) => void chat.sendMessage(text)}
                  onStop={chat.stopGeneration}
                  onRetry={() => void chat.retryLast()}
                  onClear={() => void chat.clearConversation()}
                />
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

