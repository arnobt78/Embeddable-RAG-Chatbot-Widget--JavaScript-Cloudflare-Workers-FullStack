# Embeddable RAG FAQ-Based AI Chatbot Widget - JavaScript, Cloudflare Workers, Vectorize, BGE Model, Llama 3.1 Full-Stack Project

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Workers AI](https://img.shields.io/badge/Workers%20AI-Llama%203.1%20%2B%20GLM-orange)](https://developers.cloudflare.com/workers-ai/)
[![Vectorize](https://img.shields.io/badge/Vectorize-RAG-0EA5E9)](https://developers.cloudflare.com/vectorize/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Wrangler](https://img.shields.io/badge/Wrangler-4.x-black)](https://developers.cloudflare.com/workers/wrangler/)
[![Rate Limit](https://img.shields.io/badge/Rate%20Limit-20%2Fmin-red)](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
[![Launch with Diploi](https://diploi.com/launch.svg)](https://diploi.com/launch/arnobt78/Embeddable-AI-Chatbot-Widget--JavaScript-Cloudflare-Workers-FullStack)

A production-ready, embeddable AI chatbot widget powered by Cloudflare Workers, featuring RAG (Retrieval Augmented Generation), real-time streaming responses, and a zero-dependency client-side script.

- **Live Demo:** [https://ai-chatbot-widget.arnobt78.workers.dev/](https://ai-chatbot-widget.arnobt78.workers.dev/)
- **Production Live:** [https://www.arnobmahmud.com/](https://www.arnobmahmud.com/)
- **Security:** See [SECURITY.md](./SECURITY.md) for private vulnerability reporting
- **Walkthrough:** [docs/PROJECT_WALKTHROUGH.md](./docs/PROJECT_WALKTHROUGH.md) — short learning path
- **Author:** [Arnob Mahmud](https://www.arnobmahmud.com/) | LinkedIn: [https://www.linkedin.com/in/arnob-mahmud-05839655/](https://www.linkedin.com/in/arnob-mahmud-05839655/) | Contact: [contact@arnobmahmud.com](mailto:contact@arnobmahmud.com)

![Screenshot 2026-01-25 at 15 10 10](https://github.com/user-attachments/assets/62c0b8eb-0d6c-416f-b6df-cc223b816a6e)

## Table of Contents

- [Overview](#overview)
- [Who This Is For (Learning Goals)](#who-this-is-for-learning-goals)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Keywords (Short Glossary)](#keywords-short-glossary)
- [Project Structure](#project-structure)
- [How It Works (Walkthrough)](#how-it-works-walkthrough)
- [Installation & Setup](#installation--setup)
- [Environment Variables & Bindings](#environment-variables--bindings)
- [Scripts & Local Development](#scripts--local-development)
- [Deployment](#deployment)
- [Seeding the FAQ Knowledge Base](#seeding-the-faq-knowledge-base)
- [Usage — Embed the Widget](#usage--embed-the-widget)
- [API Endpoints](#api-endpoints)
- [Backend Deep Dive (`src/index.js`)](#backend-deep-dive-srcindexjs)
- [Frontend Widget Deep Dive (`public/widget.js`)](#frontend-widget-deep-dive-publicwidgetjs)
- [Demo Page (`public/index.html`)](#demo-page-publicindexhtml)
- [CSS & Styling](#css--styling)
- [AI Models (Chat + RAG)](#ai-models-chat--rag)
- [Reusing Pieces in Other Projects](#reusing-pieces-in-other-projects)
- [Code Examples](#code-examples)
- [Security Notes](#security-notes)
- [Related Documentation](#related-documentation)
- [Troubleshooting](#troubleshooting)
- [Conclusion](#conclusion)
- [License](#license)
- [Happy Coding!](#happy-coding-)

> Prefer a shorter tour first? Start with [docs/PROJECT_WALKTHROUGH.md](./docs/PROJECT_WALKTHROUGH.md).

---

## Overview

This repository is a **full-stack edge chatbot**:

| Layer         | What it is                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| **Frontend**  | A single vanilla JavaScript file (`public/widget.js`) that injects a floating chat UI into any website |
| **Backend**   | One Cloudflare Worker (`src/index.js`) that serves static assets **and** exposes JSON/SSE APIs         |
| **AI**        | Cloudflare Workers AI for chat + text embeddings                                                       |
| **Memory**    | Cloudflare KV for conversation sessions (cookie-based)                                                 |
| **Knowledge** | Cloudflare Vectorize for FAQ semantic search (RAG)                                                     |

You do **not** need Next.js, React, Express, or a traditional database to run the core project. Everything important lives at the Cloudflare edge.

### What you will learn

1. How an **embeddable widget** works with one `<script>` tag
2. How **RAG** combines embeddings + a vector index + an LLM
3. How **SSE streaming** makes answers appear token-by-token
4. How **Workers bindings** (`AI`, `VECTORIZE`, `CHAT_SESSIONS`, `ASSETS`, `CHAT_LIMITER`) replace classic `.env` API wiring for many Cloudflare features
5. How a **model fallback chain** keeps chat alive if the primary model fails

---

## Who This Is For (Learning Goals)

| Level            | What to focus on                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| **Beginner**     | Embed the widget, run `npm run dev`, call `/api/health`, read the demo page                       |
| **Intermediate** | Trace `chat()` → `faq()` → `runChatStream()`, edit FAQs in `seed()`, change `CHAT_MODELS`         |
| **Advanced**     | Change Vectorize metadata shape, reuse RAG helpers, tune `CHAT_LIMITER` in wrangler.jsonc |

---

## Features

### Backend features

- **RAG (Retrieval Augmented Generation)** — embeds the user question, searches Vectorize (`topK: 3`), injects FAQ Q&A into the system prompt
- **Streaming chat** — Workers AI with `stream: true`, returned as `text/event-stream`
- **Model fallback** — primary `@cf/meta/llama-3.1-8b-instruct-fast`, then `@cf/zai-org/glm-4.7-flash` if `AI.run` fails at start
- **Session persistence** — `chatbot_session` HttpOnly cookie + KV (30-day TTL)
- **History API** — restore prior messages when the widget reloads
- **Seed API** — one-shot (or repeatable) upsert of FAQ embeddings into Vectorize
- **Health check** — simple monitoring endpoint
- **CORS** — `Access-Control-Allow-Origin: *` so the widget can be embedded cross-origin
- **Static asset serving** — `public/` via the `ASSETS` binding with long cache headers

### Frontend features

- **Zero runtime dependencies** — pure ES6+ in the browser
- **Inline + CSS file styling** — works even when host sites do not use Tailwind
- **Dark / light mode** — system preference + manual toggle
- **Mobile-aware layout** — keyboard-safe positioning on small screens
- **Typing indicator** while the stream is in progress
- **Configurable** via `window.CHATBOT_*` globals before loading the script

---

## Technology Stack

### Runtime / platform

| Technology             | Role                        | Beginner note                                                                              |
| ---------------------- | --------------------------- | ------------------------------------------------------------------------------------------ |
| **Cloudflare Workers** | Serverless JS at the edge   | Like a tiny Node server, but global and cold-start friendly                                |
| **Workers AI**         | Run LLMs + embedding models | You call `env.AI.run(modelId, { ... })` — no separate OpenAI key required for these models |
| **Vectorize**          | Vector database             | Stores embedding arrays; finds “similar meaning” FAQs                                      |
| **KV**                 | Key–value store             | Saves chat sessions as JSON strings                                                        |
| **Wrangler**           | CLI for develop + deploy    | `wrangler.dev` locally, `wrangler deploy` to production                                    |

### Frontend

| Technology                 | Role                                               |
| -------------------------- | -------------------------------------------------- |
| **Vanilla JavaScript**     | Widget logic (`public/widget.js`)                  |
| **HTML**                   | Demo page (`public/index.html`)                    |
| **Tailwind CSS**           | Utility classes for demo + widget stylesheet build |
| **PostCSS / Autoprefixer** | CSS toolchain (devDependencies)                    |

### DevDependencies (from `package.json`)

| Package                    | Why it exists                                 |
| -------------------------- | --------------------------------------------- |
| `wrangler`                 | Cloudflare Workers tooling                    |
| `tailwindcss`              | Compile `src/input.css` → `public/styles.css` |
| `postcss` / `autoprefixer` | CSS processing used with Tailwind             |

There are **no production `dependencies`** — the Worker and widget run without an npm runtime package tree on the client.

---

## Keywords (Short Glossary)

| Keyword            | Meaning in this project                                                       |
| ------------------ | ----------------------------------------------------------------------------- |
| **RAG**            | Retrieve FAQ snippets first, then generate an answer with that context        |
| **Embedding**      | A numeric vector that represents text meaning (here: 768 dimensions from BGE) |
| **Vectorize**      | Cloudflare’s vector index that stores those embeddings                        |
| **SSE**            | Server-Sent Events — a one-way stream of events from server → browser         |
| **Worker**         | A single JS module (`src/index.js`) handling every HTTP request               |
| **Binding**        | Named resource attached to the Worker (`env.AI`, `env.VECTORIZE`, …)          |
| **KV**             | Durable key–value storage for sessions                                        |
| **Widget**         | Floating chat UI injected by `widget.js`                                      |
| **Seed**           | Upload FAQ embeddings into Vectorize via `POST /api/seed`                     |
| **Fallback model** | Second Workers AI model tried if the first fails to start streaming           |

---

## Project Structure

```text
cloudflare-chatbot-widget/
├── src/
│   ├── index.js            # Cloudflare Worker: APIs + asset router + RAG + chat
│   ├── input.css           # Tailwind entry (demo utilities)
│   └── widget-styles.css   # Widget-specific CSS appended after Tailwind build
├── public/
│   ├── index.html          # Demo / landing page that loads the widget
│   ├── widget.js           # Embeddable chatbot (vanilla JS)
│   ├── vendor/             # Self-hosted Sentry browser bundle (tunnel-friendly)
│   └── styles.css          # Built CSS (generated — do not hand-edit as source of truth)
├── docs/
│   ├── PROJECT_WALKTHROUGH.md  # Short learning path
│   ├── AGILE_V_PROTOCOL.md
│   ├── LLM_MODEL_SELECTION.md
│   ├── Redis_Sentry_PostHog_INTEGRATION_GUIDE.md   # portable guide (not wired here)
│   └── VERCEL_PRODUCTION_GUARDRAILS.md             # portable guide (not wired here)
├── .agile-v/               # Agile V project memory (agents / process)
├── wrangler.jsonc          # Bindings: AI, Vectorize, KV, ASSETS, CHAT_LIMITER
├── tailwind.config.js
├── package.json
├── LICENSE
├── SECURITY.md
├── AGENTS.md
├── CLAUDE.md
└── README.md               # You are here
```

### File responsibilities (quick map)

| File                          | Responsibility                                                           |
| ----------------------------- | ------------------------------------------------------------------------ |
| `src/index.js`                | All backend logic: `/api/*`, RAG, chat stream, seed, static pass-through |
| `public/widget.js`            | UI + `fetch` to `/api/chat` and `/api/history`                           |
| `public/index.html`           | Teaching demo + sample questions                                         |
| `wrangler.jsonc`              | Declarative Cloudflare resources                                         |
| `docs/LLM_MODEL_SELECTION.md` | Model catalog notes + **this repo’s** live model IDs                     |

---

## How It Works (Walkthrough)

```text
User types a message in widget.js
        │
        ▼
POST /api/chat  ──►  Cloudflare Worker (src/index.js)
        │
        ├─► Read/create session in KV (cookie chatbot_session)
        ├─► faq(): embed question with BGE → Vectorize top 3 FAQs
        ├─► Build messages: system(+FAQ) + last 10 turns
        ├─► runChatStream(): try Llama 3.1 Fast, else GLM-4.7-Flash
        ├─► Stream SSE tokens back to the browser
        └─► On stream end: save assistant message to KV
```

### Step-by-step (beginner)

1. **Widget opens** — FAB button appears; greeting shows from `CHATBOT_GREETING`.
2. **User sends text** — `widget.js` `POST`s `{ message }` to `/api/chat` with `credentials: 'include'`.
3. **Session** — Worker reads cookie or creates `sess_<uuid>` in KV.
4. **RAG** — Question → embedding → similar FAQs → text context.
5. **Generation** — LLM streams tokens; widget appends them live.
6. **Persist** — Full assistant reply stored in KV for `/api/history`.

If RAG fails, chat still works (empty FAQ context) and the error is logged with `console.error`.

---

## Installation & Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (recommended)
- npm
- A free [Cloudflare account](https://dash.cloudflare.com/sign-up)
- Wrangler login: `npx wrangler login`

### 1. Clone and install

```bash
git clone https://github.com/arnobt78/Embeddable-AI-Chatbot-Widget--JavaScript-Cloudflare-Workers-FullStack.git
cd Embeddable-AI-Chatbot-Widget--JavaScript-Cloudflare-Workers-FullStack
npm install
```

### 2. Create Cloudflare resources (first time)

**KV namespace (sessions):**

```bash
npx wrangler kv namespace create CHAT_SESSIONS
```

Copy the returned `id` into `wrangler.jsonc` → `kv_namespaces[0].id`.

**Vectorize index (FAQ embeddings — must match BGE dimensions = 768):**

```bash
npx wrangler vectorize create faq-vectors \
  --dimensions=768 \
  --metric=cosine
```

Ensure `wrangler.jsonc` has:

```jsonc
"vectorize": [
  {
    "binding": "VECTORIZE",
    "index_name": "faq-vectors"
  }
]
```

**Workers AI** — already enabled via:

```jsonc
"ai": { "binding": "AI" }
```

No separate “OpenAI-style” API key is required for the built-in Workers AI models used here.

### 3. Run locally

```bash
npm run dev
```

Open the URL Wrangler prints (usually `http://127.0.0.1:8787`).

### 4. Deploy

```bash
npm run deploy
```

### 5. Seed FAQs (required once per new Vectorize index)

```bash
curl -X POST https://YOUR-SUBDOMAIN.workers.dev/api/seed \
  -H "Authorization: Bearer YOUR_SEED_SECRET"
```

---

## Environment Variables & Bindings

### Do we need a `.env` file?

**No classic `.env` is required for chat + RAG.** Cloudflare uses **bindings** in `wrangler.jsonc` plus an optional Wrangler secret for seed auth.

| Mechanism | Required? | Purpose |
|---|---|---|
| `wrangler.jsonc` bindings | **Yes** | `AI`, `VECTORIZE`, `CHAT_SESSIONS`, `ASSETS`, `CHAT_LIMITER` |
| `SEED_SECRET` (Wrangler secret / `.dev.vars`) | **Yes to call `/api/seed`** | Fail-closed seed lock (REQ-0011) |
| `SENTRY_DSN` (Wrangler secret / `.dev.vars`) | **Optional** | Worker Sentry + `/api/monitoring` tunnel allowlist |
| `.env` / `.env.local` | **No** | Not used by this Worker |
| `CLOUDFLARE_API_TOKEN` | **Optional** | CI / non-interactive `wrangler deploy` |

### `SEED_SECRET` (required for seeding)

Local (gitignored) — copy from the example file:

```bash
cp .dev.vars.example .dev.vars
# edit SEED_SECRET to a long random string
```

Production:

```bash
npx wrangler secret put SEED_SECRET
```

If `SEED_SECRET` is missing, `POST /api/seed` returns **503**. Wrong token returns **401**.

Accepted headers:

- `Authorization: Bearer <SEED_SECRET>`
- `X-Seed-Secret: <SEED_SECRET>`

### `SENTRY_DSN` (optional observability)

Create a Sentry project as **Cloudflare Workers** (not Next.js/React). Then:

```bash
npx wrangler secret put SENTRY_DSN
# local: add SENTRY_DSN=… to `.dev.vars` (see `.dev.vars.example`)
```

Enables `@sentry/cloudflare` on the Worker (model/RAG hard failures) and allowlists `POST /api/monitoring` (browser SDK tunnel past ad blockers). Refresh the vendored browser bundle with `npm run vendor:sentry`.

### Chat rate limit (built-in)

`POST /api/chat` is limited to **20 requests per IP per 60 seconds** via the Workers **Rate Limiting** binding (`CHAT_LIMITER` in `wrangler.jsonc`). This avoids racy KV counters. Over limit → **429** with `Retry-After: 60`. Limits are enforced per Cloudflare colo (abuse prevention, not global billing accounting).

### robots.txt (AI scrapers)

[`public/robots.txt`](public/robots.txt) allows normal crawlers on `/` and **Disallow: /** for common AI scrapers (GPTBot, ChatGPT-User, Google-Extended, CCBot, anthropic-ai, ClaudeBot, Bytespider, meta-externalagent). Served with a 1-hour cache (not year-long immutable).

### Optional: shell env for deploy automation

```bash
export CLOUDFLARE_API_TOKEN="your-api-token-from-dash.cloudflare.com"
npm run deploy
```

Create a token with Workers edit permissions: [Cloudflare API Tokens](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/).

### Optional: client-side “env” for host apps

When embedding on another site (or Next.js), you only need a **public** Worker URL — not private AI keys in the browser:

```html
<script>
  window.CHATBOT_BASE_URL = "https://your-worker.workers.dev";
</script>
<script src="https://your-worker.workers.dev/widget.js"></script>
```

In a Next.js host you _might_ use:

```env
# Host app only — optional public URL to the Worker (never put Workers AI secrets in NEXT_PUBLIC_*)
NEXT_PUBLIC_CHATBOT_URL=https://your-worker.workers.dev
```

### Bindings checklist (the real “environment”)

| Binding name | Type | Used for |
|---|---|---|
| `AI` | Workers AI | Chat + embeddings |
| `VECTORIZE` | Vectorize index `faq-vectors` | RAG search / upsert |
| `CHAT_SESSIONS` | KV namespace | Session JSON |
| `CHAT_LIMITER` | Rate Limiting (20 / 60s) | Abuse cap on `/api/chat` |
| `ASSETS` | Static assets `./public` | `widget.js`, CSS, HTML, `robots.txt` |
| `SEED_SECRET` | Secret (not a binding in jsonc) | Authorize `/api/seed` |
| `SENTRY_DSN` | Secret (optional) | Sentry Worker SDK + monitoring tunnel allowlist |

---

## Scripts & Local Development

| npm script          | What it does                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| `npm run build:css` | Compiles Tailwind from `src/input.css`, then appends `src/widget-styles.css` → `public/styles.css` |
| `npm run dev`       | `build:css` + `wrangler dev`                                                                       |
| `npm run deploy`    | `build:css` + `wrangler deploy`                                                                    |

Always rebuild CSS before deploy if you edited `src/input.css` or `src/widget-styles.css` (the deploy script already does this).

---

## Deployment

1. Confirm `wrangler.jsonc` IDs match your account’s KV + Vectorize resources.
2. Set production secret: `npx wrangler secret put SEED_SECRET`.
3. Run `npm run deploy`.
4. Note the `*.workers.dev` URL.
5. Call `POST /api/seed` once with the Bearer token.
6. Open `/` and test the widget.
7. Embed on your site with `CHATBOT_BASE_URL` pointing at the Worker.

---

## Seeding the FAQ Knowledge Base

The FAQ corpus lives **inside** `seed()` in `src/index.js` (about 20 Q&A pairs about the portfolio). Seeding:

1. Embeds each `question + answer` with `@cf/baai/bge-base-en-v1.5`
2. Upserts vectors + metadata into Vectorize

```bash
curl -X POST https://YOUR-SUBDOMAIN.workers.dev/api/seed \
  -H "Authorization: Bearer YOUR_SEED_SECRET"
# → { "success": true, "count": 20 }
```

Re-run after you edit FAQ text. Changing **embedding model dimensions** requires a new Vectorize index (keep BGE 768 unless you intentionally migrate).

---

## Usage — Embed the Widget

### Minimal embed (same origin)

```html
<script>
  window.CHATBOT_TITLE = "Support Assistant";
  window.CHATBOT_GREETING = "Hi! How can I help you today?";
</script>
<script src="/widget.js"></script>
```

### Cross-origin embed (recommended pattern)

```html
<script>
  window.CHATBOT_BASE_URL = "https://ai-chatbot-widget.arnobt78.workers.dev";
  window.CHATBOT_TITLE = "Support Assistant";
  window.CHATBOT_GREETING = "Hi! How can I help you today?";
  window.CHATBOT_PLACEHOLDER = "Type your message...";
</script>
<script src="https://ai-chatbot-widget.arnobt78.workers.dev/widget.js"></script>
```

### Configuration globals

| Variable              | Default                          | Purpose                        |
| --------------------- | -------------------------------- | ------------------------------ |
| `CHATBOT_BASE_URL`    | `window.location.origin`         | Worker origin for API + assets |
| `CHATBOT_TITLE`       | `'Chat Assistant'`               | Header title                   |
| `CHATBOT_GREETING`    | `'👋 How can I help you today?'` | First bot message              |
| `CHATBOT_PLACEHOLDER` | `'Message...'`                   | Input placeholder              |

Set globals **before** loading `widget.js`.

---

## API Endpoints

Base URL = your Worker origin.

### `GET /api/health`

Liveness check. When `SENTRY_DSN` is set, also returns the public client DSN for the widget.

```bash
curl https://YOUR-SUBDOMAIN.workers.dev/api/health
# { "status": "ok", "sentryDsn": "https://…@….ingest.sentry.io/…" }  # or sentryDsn: null
```

---

### `POST /api/monitoring`

Sentry envelope tunnel (browser SDK). Same-origin / Worker-origin POST so ad blockers do not block `*.sentry.io`. Allowlists host + project from `SENTRY_DSN` only (not an open proxy).

---

### `POST /api/chat`

Streams an assistant reply (SSE).

**Request**

```http
POST /api/chat
Content-Type: application/json

{ "message": "Tell me about Arnob Mahmud" }
```

**Response**

- `Content-Type: text/event-stream`
- Optional `Set-Cookie: chatbot_session=...` on first visit
- Body: Workers AI SSE chunks (`data: {...}`)

**Errors**

- `400` — missing message
- `405` — wrong method
- `503` — all chat models in `CHAT_MODELS` failed to start

---

### `GET /api/history`

Returns messages for the current session cookie.

```bash
curl -c cookies.txt -b cookies.txt https://YOUR-SUBDOMAIN.workers.dev/api/history
# { "messages": [ { "role": "user"|"assistant", "content": "...", "timestamp": 123 } ] }
```

---

### `POST /api/seed`

Upserts FAQ embeddings into Vectorize. **Requires** `SEED_SECRET`.

```bash
curl -X POST https://YOUR-SUBDOMAIN.workers.dev/api/seed \
  -H "Authorization: Bearer YOUR_SEED_SECRET"
# { "success": true, "count": N }

# Without secret → 503 or 401
```

---

### Static assets

| Path | Description |
|---|---|
| `/` or `/index.html` | Demo page |
| `/widget.js` | Embeddable widget |
| `/styles.css` | Compiled styles |
| `/robots.txt` | Crawl rules (blocks AI scrapers) |

Served via `env.ASSETS`. JS/CSS use long immutable cache; HTML and `robots.txt` use `max-age=3600`.

---

## Backend Deep Dive (`src/index.js`)

Think of the Worker as a tiny router + helpers.

### Important constants

```js
const CHAT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const CHAT_MODEL_FALLBACK = "@cf/zai-org/glm-4.7-flash";
const CHAT_MODELS = [CHAT_MODEL, CHAT_MODEL_FALLBACK];
const EMBED_MODEL = "@cf/baai/bge-base-en-v1.5";
const TTL = 30 * 24 * 60 * 60; // session cookie + KV TTL (seconds)
const CHAT_RATE_WINDOW_S = 60; // matches wrangler CHAT_LIMITER period
// Limit value (20) lives in wrangler.jsonc → ratelimits.CHAT_LIMITER
```

### `runChatStream(env, messages)`

Tries each model in `CHAT_MODELS` until `env.AI.run(..., { stream: true })` succeeds. If the primary fails (capacity, deprecation, transient error), the fallback starts **immediately**. Mid-stream failures cannot switch models after bytes are already sent.

### `faq(env, q)` — RAG

1. Embed `q` with `EMBED_MODEL`
2. `VECTORIZE.query(..., { topK: 3, returnMetadata: "all" })`
3. Format matches as `Q: ...\nA: ...`
4. On error → log + return `""` (chat continues without FAQ context)

### `chat(req, env)`

Rate-limit check → validates input → session → RAG → stream → save to KV on flush.

### `seed(req, env)`

`assertSeedAuth` → hardcoded FAQ array → parallel embeddings → `VECTORIZE.upsert`.

### Default export `fetch`

Routes `/api/*` or falls through to `ASSETS`.

---

## Frontend Widget Deep Dive (`public/widget.js`)

An IIFE that:

1. Creates a floating button (`#cb-btn`) with inline styles (works without Tailwind on the host)
2. Loads `/styles.css` asynchronously from `CHATBOT_BASE_URL`
3. Builds the chat panel DOM (header, messages, input, menu)
4. Binds open/close, theme toggle, clear chat, send message
5. Streams `/api/chat` and updates the message list progressively
6. Loads `/api/history` on init with `credentials: 'include'`

### Why inline styles?

Host sites may not include your Tailwind build. Critical positioning uses inline `style` so the FAB still appears correctly.

### Reuse tip

Copy `public/widget.js` + ensure `styles.css` (or equivalent) is reachable from `CHATBOT_BASE_URL`. Point `CHATBOT_BASE_URL` at any compatible Worker implementing the same API shapes.

---

## Demo Page (`public/index.html`)

Teaching page that:

- Explains the widget
- Lists sample FAQ questions
- Sets `CHATBOT_TITLE` / `CHATBOT_GREETING`
- Loads `/widget.js`

Use it as a template for your own landing page or keep it as a local playground.

---

## CSS & Styling

| Source                  | Role                                         |
| ----------------------- | -------------------------------------------- |
| `src/input.css`         | Tailwind directives for the demo page        |
| `src/widget-styles.css` | Widget-specific rules appended at build time |
| `public/styles.css`     | **Generated** output used in production      |

```bash
npm run build:css
```

`tailwind.config.js` scans `./public/**/*.{html,js}` and enables `darkMode: 'class'`.

---

## AI Models (Chat + RAG)

| Role            | Model ID                              | Notes                                                                  |
| --------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| Chat (primary)  | `@cf/meta/llama-3.1-8b-instruct-fast` | Free-plan friendly; replaces deprecated `@cf/meta/llama-3-8b-instruct` |
| Chat (fallback) | `@cf/zai-org/glm-4.7-flash`           | Used if primary `AI.run` throws                                        |
| Embeddings      | `@cf/baai/bge-base-en-v1.5`           | 768-d — must match Vectorize index                                     |

This project does **not** call Gemini, OpenRouter, Groq, or Hugging Face APIs. Those providers appear only as portable reference material in `docs/LLM_MODEL_SELECTION.md`.

Change models in one place at the top of `src/index.js` (`CHAT_MODELS` / `EMBED_MODEL`).

---

## Reusing Pieces in Other Projects

### 1. Reuse the widget on any website

Point `CHATBOT_BASE_URL` at your deployed Worker and include `widget.js` (see [Usage](#usage--embed-the-widget)).

### 2. Reuse the RAG helper

Copy `faq()` + `EMBED_MODEL` into another Worker that already has `AI` + `VECTORIZE` bindings. Keep dimensions consistent.

### 3. Reuse streaming chat

Copy `runChatStream()` + the SSE `TransformStream` pattern from `chat()`. Your client must read `text/event-stream` the same way `widget.js` does.

### 4. Reuse session cookies

Pattern: HttpOnly cookie → KV JSON → history endpoint. Works for any small conversational app on Workers.

### 5. Swap the FAQ corpus

Edit the `faqs` array in `seed()`, redeploy, re-seed. Or later extract FAQs to a JSON file and import it (nice homework exercise).

### 6. Host frameworks (Next.js example)

```jsx
// App Router layout — load once globally
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.CHATBOT_BASE_URL="${process.env.NEXT_PUBLIC_CHATBOT_URL}";`,
          }}
        />
        <script
          src={`${process.env.NEXT_PUBLIC_CHATBOT_URL}/widget.js`}
          defer
        />
      </body>
    </html>
  );
}
```

Remember: the **AI keys stay on Cloudflare**; the host app only needs the public Worker URL.

---

## Code Examples

### Health check

```bash
curl https://ai-chatbot-widget.arnobt78.workers.dev/api/health
```

### Chat (non-stream debug tip)

Use the live widget, or stream with curl:

```bash
curl -N -X POST https://YOUR-SUBDOMAIN.workers.dev/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Where is Arnob located?"}'
```

### Custom chat model list

```js
// src/index.js — educational example
const CHAT_MODELS = [
  "@cf/meta/llama-3.1-8b-instruct-fast",
  "@cf/zai-org/glm-4.7-flash",
  // add another free-plan Workers AI text model if needed
];
```

### Custom FAQs (concept)

```js
const faqs = [
  ["What is your refund policy?", "Refunds are available within 14 days..."],
  ["How do I contact support?", "Email support@example.com..."],
];
```

Then redeploy + authenticated `POST /api/seed`.

---

## Security Notes

- `/api/seed` is **secret-gated** (`SEED_SECRET`) — fail-closed if unset.
- `/api/chat` is **rate-limited** (20 req / IP / min via `CHAT_LIMITER`) to protect Workers AI Neurons.
- `/api/monitoring` tunnels Sentry envelopes only for the configured `SENTRY_DSN` host/project (not auth; allowlist only).
- `public/robots.txt` blocks common AI scrapers from the demo HTML.
- CORS is wide open (`*`) by design for embeddability — consider an allowlist if you only support specific sites.
- Session cookies use `HttpOnly; SameSite=Lax` — third-party embeds may need a different session strategy (`SameSite=None; Secure` or header-based session ids).
- Report vulnerabilities privately via [SECURITY.md](./SECURITY.md) (`contact@arnobmahmud.com`).

---

## Related Documentation

| Doc | Purpose |
|---|---|
| [SECURITY.md](./SECURITY.md) | Private vulnerability reporting |
| [docs/PROJECT_WALKTHROUGH.md](./docs/PROJECT_WALKTHROUGH.md) | Short educational walkthrough |
| [docs/LLM_MODEL_SELECTION.md](./docs/LLM_MODEL_SELECTION.md) | Free-tier model reference + **this repo’s** Workers AI IDs |
| [docs/AGILE_V_PROTOCOL.md](./docs/AGILE_V_PROTOCOL.md) | Agent / quality workflow |
| [docs/VERCEL_PRODUCTION_GUARDRAILS.md](./docs/VERCEL_PRODUCTION_GUARDRAILS.md) | **External reference only** (Next.js/Vercel) — not applied here; use Workers patterns above |
| [CLAUDE.md](./CLAUDE.md) / [AGENTS.md](./AGENTS.md) | Agent orientation |
| `.agile-v/` | Living project state for Agile V cycles |

Portable guides under `docs/` about Redis/Sentry/PostHog are **not** wired into this Worker — adapt carefully if you borrow ideas.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Chat returns Cloudflare `1101` | Deprecated / unavailable chat model, or undeployed local fix | Deploy current `src/index.js`; confirm `CHAT_MODELS` |
| Chat returns `429` | Rate limit (20/min/IP) | Wait for `Retry-After` seconds |
| Seed returns `503` | `SEED_SECRET` not set | Add `.dev.vars` or `wrangler secret put SEED_SECRET` |
| Seed returns `401` | Wrong/missing Bearer token | Use `Authorization: Bearer …` matching the secret |
| Answers ignore FAQs | Vectorize empty or wrong dimensions | Authenticated `POST /api/seed`; index must be 768-d for BGE |
| Widget UI broken on host site | CSS not loaded / wrong `CHATBOT_BASE_URL` | Set `CHATBOT_BASE_URL` to Worker origin; ensure `/styles.css` 200 |
| History empty after refresh | Cookie blocked / third-party context | Check cookie flags; test first-party Worker demo first |
| `wrangler deploy` fails in CI | Missing token | Set `CLOUDFLARE_API_TOKEN` |
| Neurons / capacity errors | Free-tier daily limit or model capacity | Wait for UTC reset; fallback model may still answer |

---

## Conclusion

This project is a compact, teachable example of a **modern edge AI stack**: a portable chat widget, a single Worker backend, RAG over Vectorize, streaming LLM replies, and session memory in KV — without a traditional app server.

Use it to:

- Learn RAG end-to-end on Cloudflare
- Ship a portfolio or support chatbot quickly
- Copy patterns (SSE, bindings, embed scripts) into your own Workers

Explore the live demo, read `src/index.js` top-to-bottom once, then change one FAQ and re-seed — that single loop teaches most of the architecture.

---

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT). Feel free to use, modify, and distribute the code as per the terms of the license.

---

## Happy Coding! 🎉

This is an **open-source project** — feel free to use, enhance, and extend this project further!

If you have any questions or want to share your work, reach out via GitHub or my portfolio at [https://www.arnobmahmud.com](https://www.arnobmahmud.com/).
