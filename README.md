# PageMind — AI Webpage Reader & Chat Companion
**Understand any page. Ask anything.**

PageMind is a privacy-first Manifest V3 browser extension for **Google Chrome** and **Brave** that extracts the meaningful content of the active webpage, generates a context-aware summary using the **xAI Grok API**, and lets you ask follow-up questions in an interactive chat interface.

---

## Features

- **Intelligent Webpage Extraction**: Uses `@mozilla/readability` plus domain-aware extractors (GitHub, Stack Overflow, YouTube, documentation, news, blogs, job listings, product pages) while stripping navigation, footers, ads, cookie banners, and hidden elements.
- **Context-Aware Summarization**: Adapts summary structure to the page type and supports **Brief**, **Balanced**, and **Detailed** depth modes with streaming responses.
- **Interactive AI Chat**: Ask follow-up questions grounded in the active page, with streaming responses, stop/retry controls, copyable answers, starter prompts, and IME-safe `Enter` to send (`Shift+Enter` for newline).
- **Privacy-First Architecture**:
  - Auto-analysis on popup open is **OFF by default**—nothing is sent to xAI until you click **Summarize page** or send a chat message (or explicitly enable auto-analyze).
  - Zero background tab monitoring, zero browsing history collection, zero analytics or telemetry.
  - Local summary caching (by URL, depth, and content hash) and optional per-URL chat history with one-click clearing.
- **Prompt Injection & XSS Protection**:
  - Untrusted webpage content is sanitized, stripped of invisible control characters, and wrapped in `<untrusted_webpage_content>` delimiters with strict grounding instructions.
  - AI responses are rendered via a safe React Markdown renderer without `dangerouslySetInnerHTML`.
- **Light & Dark Mode**: Follows system preference (`System`) or lets you override (`Light` / `Dark`).

---

## Permissions Explained

PageMind requests the minimum permissions required to function:

| Permission | Why it is needed |
| --- | --- |
| `activeTab` | Grants temporary access to the currently active tab *only* when you click the PageMind toolbar icon or shortcut. |
| `scripting` | Injects the content extractor into the active tab on demand when you open PageMind (no persistent background content scripts). |
| `storage` | Stores your settings, encrypted API key, optional chat history, and summary cache locally in `chrome.storage.local`. |
| `https://api.x.ai/*` (host) | Allows direct HTTPS requests from the extension to the official xAI Grok API. |

---

## API Key Security

- Your xAI API key is **never** hardcoded, logged, or displayed in full after saving.
- PageMind encrypts your API key in `chrome.storage.local` using WebCrypto AES-GCM with a locally generated key.
- **Important limitation**: Because this is a client-side browser extension, local extension storage is **not** equivalent to an OS hardware vault and cannot completely protect a user-provided API key from a compromised local machine or malicious extension code.
- If you configure a custom API endpoint in Settings, PageMind validates that it uses HTTPS and displays a warning before sending your key to any domain other than `api.x.ai`.

---

## Development & Build

### Prerequisites

- **Node.js** 20+ (tested on Node v24.16.0)
- **npm** 10+

### Install Dependencies

```bash
npm install
```

### Run Tests

```bash
npm test
```

### Build for Production

```bash
npm run build
```

This runs TypeScript type-checking (`tsc --noEmit`) and outputs the production extension bundle into `dist/`.

---

## Local Installation

### Google Chrome

1. Run `npm run build` to generate the `dist/` folder.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked**.
5. Select the `dist/` folder inside this project.
6. Pin **PageMind** to your toolbar for quick access (or press `Ctrl+Shift+Y` / `Cmd+Shift+Y`).

### Brave Browser

1. Run `npm run build` to generate the `dist/` folder.
2. Open Brave and navigate to `brave://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked**.
5. Select the `dist/` folder inside this project.
6. Pin **PageMind** to your toolbar (or press `Ctrl+Shift+Y` / `Cmd+Shift+Y`).

---

## Groq API Key Setup

1. Create or sign in to your free account at [console.groq.com/keys](https://console.groq.com/keys).
2. Generate an API key (`gsk_...`).
3. Click the **PageMind** toolbar icon.
4. Paste your API key into the setup screen and click **Test & Save Key**.
5. Default model is `llama-3.3-70b-versatile` (also includes `llama-3.1-8b-instant`, `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, plus live model discovery via `GET /models`). You can also switch to xAI or any compatible HTTPS endpoint in Settings.

