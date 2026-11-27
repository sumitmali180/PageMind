import React, { useId, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { AppSettings, SummaryDepth, ThemePreference } from '@/types';
import { AVAILABLE_GROK_MODELS, testApiConnection } from '@/services/grok';
import {
  clearAllChatHistory,
  clearApiKey,
  clearSummaryCache,
  saveApiKey,
} from '@/storage/settings';
import { DEFAULT_XAI_ENDPOINT, validateApiEndpoint } from '@/utils/permissions';
import { maskApiKey } from '@/utils/sanitize';

interface SettingsProps {
  settings: AppSettings;
  hasKey: boolean;
  maskedKey: string;
  onUpdateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  onKeyChanged: () => Promise<void>;
  onBack: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  settings,
  hasKey,
  maskedKey,
  onUpdateSettings,
  onKeyChanged,
  onBack,
}) => {
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const keyInputId = useId();
  const modelId = useId();
  const endpointId = useId();
  const depthId = useId();

  const endpointValidation = validateApiEndpoint(settings.apiEndpoint);

  const modelOptions = (() => {
    const knownIds = new Set(AVAILABLE_GROK_MODELS.map((m) => m.id));
    const extra = discoveredModels
      .filter((id) => !knownIds.has(id) && !id.toLowerCase().includes('whisper'))
      .map((id) => ({
        id,
        name: id,
        description: 'Discovered from API',
      }));
    return [...AVAILABLE_GROK_MODELS, ...extra];
  })();

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    await saveApiKey(trimmed);
    setKeyInput('');
    setShowKey(false);
    setTestResult({ ok: true, message: `Saved (${maskApiKey(trimmed)})` });
    await onKeyChanged();
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const candidate = keyInput.trim();
      if (candidate) {
        await saveApiKey(candidate);
        setKeyInput('');
        await onKeyChanged();
      }
      const { getApiKey } = await import('@/storage/settings');
      const activeKey = candidate || (await getApiKey()) || '';
      const res = await testApiConnection(activeKey, settings.apiEndpoint);
      setDiscoveredModels(res.models);
      setTestResult({
        ok: true,
        message: `Connected (${res.models.length} models available)`,
      });
    } catch (err) {
      setTestResult({
        ok: false,
        message:
          err instanceof Error ? err.message : 'Connection test failed.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleClearKey = async () => {
    await clearApiKey();
    setKeyInput('');
    setTestResult(null);
    await onKeyChanged();
    setNotice('API key removed from local storage.');
  };

  const handleClearChats = async () => {
    await clearAllChatHistory();
    setNotice('Saved conversations cleared.');
  };

  const handleClearCache = async () => {
    await clearSummaryCache();
    setNotice('Cached page summaries cleared.');
  };

  return (
    <div className="pm-settings" role="region" aria-label="Settings">
      {/* AI Configuration */}
      <section className="pm-settings-group">
        <h2 className="pm-settings-heading">AI Configuration</h2>

        <form className="pm-field" onSubmit={handleSaveKey}>
          <label htmlFor={keyInputId} className="pm-label">
            Groq API Key
          </label>
          {hasKey && (
            <div className="pm-key-status">
              <KeyRound size={13} aria-hidden="true" />
              <span>Stored locally: {maskedKey}</span>
            </div>
          )}
          <div className="pm-input-row">
            <div className="pm-input-wrap">
              <input
                id={keyInputId}
                type={showKey ? 'text' : 'password'}
                className="pm-input"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder={hasKey ? 'Enter new key to replace…' : 'gsk_…'}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="pm-input-eye"
                onClick={() => setShowKey((s) => !s)}
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button
              type="submit"
              className="pm-btn pm-btn-primary"
              disabled={!keyInput.trim()}
            >
              Save
            </button>
          </div>

          <div className="pm-inline-actions">
            <button
              type="button"
              className="pm-btn pm-btn-secondary"
              disabled={testing || (!hasKey && !keyInput.trim())}
              onClick={handleTestConnection}
            >
              {testing ? 'Testing…' : 'Test connection'}
            </button>
            {hasKey && (
              <button
                type="button"
                className="pm-btn pm-btn-ghost"
                onClick={handleClearKey}
              >
                Remove key
              </button>
            )}
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="pm-link"
            >
              <span>Groq Console</span>
              <ExternalLink size={11} />
            </a>
          </div>

          {testResult && (
            <div
              className={`pm-inline-feedback ${testResult.ok ? 'is-ok' : 'is-err'}`}
              role="status"
            >
              {testResult.ok ? (
                <CheckCircle2 size={13} />
              ) : (
                <AlertTriangle size={13} />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </form>

        <div className="pm-field">
          <label htmlFor={modelId} className="pm-label">
            Model
          </label>
          <select
            id={modelId}
            className="pm-select"
            value={settings.model}
            onChange={(e) => void onUpdateSettings({ model: e.target.value })}
          >
            {modelOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.id})
              </option>
            ))}
          </select>
        </div>

        <div className="pm-field">
          <label htmlFor={depthId} className="pm-label">
            Default summary depth
          </label>
          <select
            id={depthId}
            className="pm-select"
            value={settings.defaultSummaryDepth}
            onChange={(e) =>
              void onUpdateSettings({
                defaultSummaryDepth: e.target.value as SummaryDepth,
              })
            }
          >
            <option value="brief">Brief</option>
            <option value="balanced">Balanced</option>
            <option value="detailed">Detailed</option>
          </select>
        </div>

        <div className="pm-field">
          <label htmlFor={endpointId} className="pm-label">
            API endpoint
          </label>
          <input
            id={endpointId}
            type="url"
            className="pm-input"
            value={settings.apiEndpoint}
            onChange={(e) =>
              void onUpdateSettings({ apiEndpoint: e.target.value })
            }
            placeholder={DEFAULT_XAI_ENDPOINT}
          />
          {!endpointValidation.valid && endpointValidation.error && (
            <p className="pm-field-warn is-err">{endpointValidation.error}</p>
          )}
          {endpointValidation.valid && endpointValidation.warning && (
            <p className="pm-field-warn">{endpointValidation.warning}</p>
          )}
        </div>
      </section>

      {/* Appearance */}
      <section className="pm-settings-group">
        <h2 className="pm-settings-heading">Appearance</h2>
        <div className="pm-segmented pm-segmented-full" role="group" aria-label="Theme">
          {(['system', 'light', 'dark'] as ThemePreference[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`pm-seg-btn ${settings.theme === t ? 'is-active' : ''}`}
              aria-pressed={settings.theme === t}
              onClick={() => void onUpdateSettings({ theme: t })}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </section>

      {/* Privacy */}
      <section className="pm-settings-group">
        <h2 className="pm-settings-heading">Privacy & Security</h2>

        <label className="pm-toggle-row">
          <div>
            <div className="pm-toggle-title">Auto-analyze on open</div>
            <div className="pm-toggle-desc">
              Automatically send extracted page text to Groq when opening PageMind.
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.autoAnalyzeOnOpen}
            onChange={(e) =>
              void onUpdateSettings({ autoAnalyzeOnOpen: e.target.checked })
            }
          />
        </label>

        <label className="pm-toggle-row">
          <div>
            <div className="pm-toggle-title">Save conversation history</div>
            <div className="pm-toggle-desc">
              Keep recent Q&A per URL in local browser storage.
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.saveChatHistory}
            onChange={(e) =>
              void onUpdateSettings({ saveChatHistory: e.target.checked })
            }
          />
        </label>

        <div className="pm-inline-actions">
          <button
            type="button"
            className="pm-btn pm-btn-secondary"
            onClick={handleClearChats}
          >
            <Trash2 size={13} />
            <span>Clear chats</span>
          </button>
          <button
            type="button"
            className="pm-btn pm-btn-secondary"
            onClick={handleClearCache}
          >
            <Trash2 size={13} />
            <span>Clear cache</span>
          </button>
        </div>

        <div className="pm-privacy-note">
          <ShieldCheck size={14} className="pm-privacy-icon" aria-hidden="true" />
          <div>
            <p>
              <strong>What is sent:</strong> Only the active webpage&apos;s
              extracted text, title, URL, and your chat messages are sent directly
              to your configured Groq API endpoint. PageMind never collects browsing
              history, cookies, or background tabs.
            </p>
            <p>
              <strong>API key storage:</strong> Your key is stored locally in
              browser extension storage using WebCrypto AES-GCM. This is not
              equivalent to an OS hardware vault and cannot protect against a
              compromised local environment.
            </p>
          </div>
        </div>
      </section>

      {/* General */}
      <section className="pm-settings-group">
        <h2 className="pm-settings-heading">About PageMind</h2>
        <p className="pm-muted-text">
          Version 1.0.0 · Shortcut: <code>Ctrl+Shift+Y</code> /{' '}
          <code>⌘+Shift+Y</code>
        </p>
        {notice && (
          <p className="pm-inline-feedback is-ok" role="status">
            {notice}
          </p>
        )}
        <button
          type="button"
          className="pm-btn pm-btn-primary pm-btn-full"
          onClick={onBack}
        >
          Done
        </button>
      </section>
    </div>
  );
};

