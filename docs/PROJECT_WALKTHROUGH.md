# Project Walkthrough — Cloudflare Chatbot Widget

Short learning path. Full details: [README.md](../README.md). Agent memory: [CLAUDE.md](../CLAUDE.md), [`.agile-v/STATE.md`](../.agile-v/STATE.md).

---

## What you build

An **embeddable chat widget** (one script tag) backed by a **Cloudflare Worker** that:

1. Stores sessions in **KV**
2. Retrieves FAQ context via **Vectorize** (RAG + BGE embeddings)
3. Streams answers via **Workers AI** (Llama 3.1 Fast → GLM-4.7-Flash fallback)
4. Caps abuse with **Rate Limiting** (`CHAT_LIMITER`, 20/min/IP)
5. Protects FAQ seeding with **`SEED_SECRET`**
6. Optional **Sentry** (`SENTRY_DSN`) — Worker SDK + browser tunnel `POST /api/monitoring`

---

## Structure (mental map)

```text
src/index.js          Worker: routes, RAG, chat, seed, monitoring tunnel, assets
public/widget.js      Browser widget (SSE client + optional Sentry via tunnel)
public/vendor/        Self-hosted cb-obs.min.js (Sentry browser SDK; neutral name vs adblock)
public/index.html     Demo page
public/robots.txt     Block AI scrapers
public/styles.css     Built CSS (from src/*.css)
wrangler.jsonc        Bindings: AI, VECTORIZE, KV, ASSETS, CHAT_LIMITER
.dev.vars.example     Template for SEED_SECRET + SENTRY_DSN
```

---

## Request flow

```text
widget.js  --POST /api/chat-->  Worker
                                 ├─ CHAT_LIMITER.limit(ip)
                                 ├─ KV session (cookie)
                                 ├─ BGE embed → Vectorize topK
                                 └─ stream CHAT_MODELS → SSE → widget
```

---

## APIs

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | `{ status, sentryDsn }` |
| POST | `/api/chat` | SSE stream; rate-limited |
| GET | `/api/history` | Messages for session cookie |
| POST | `/api/seed` | Bearer / `X-Seed-Secret` required |
| POST | `/api/monitoring` | Sentry envelope tunnel (DSN allowlist) |

Static: `/`, `/widget.js`, `/styles.css`, `/robots.txt`, `/vendor/cb-obs.min.js`

---

## Env / bindings (no classic `.env` required for chat)

| Name | How | Purpose |
|---|---|---|
| `AI` / `VECTORIZE` / `CHAT_SESSIONS` / `ASSETS` | `wrangler.jsonc` | Core runtime |
| `CHAT_LIMITER` | `wrangler.jsonc` → `ratelimits` | 20 req / 60s / IP |
| `SEED_SECRET` | `.dev.vars` locally; dashboard Secret or `wrangler secret put` in prod | Authorize seed |
| `SENTRY_DSN` | Optional secret | Worker Sentry + monitoring tunnel allowlist |

```bash
cp .dev.vars.example .dev.vars
npm run dev
npm run deploy
curl -X POST https://YOUR.workers.dev/api/seed \
  -H "Authorization: Bearer $SEED_SECRET"
```

---

## Learn by doing

1. Run `npm run dev` → open local URL → ask an FAQ question  
2. Change one FAQ in `seed()` → redeploy → re-seed  
3. Swap/add a model in `CHAT_MODELS` at top of `src/index.js`  
4. Embed elsewhere: set `window.CHATBOT_BASE_URL` then load `widget.js`  
5. Observability: set `SENTRY_DSN` → deploy → confirm `/api/health` has `sentryDsn` and Network shows `POST /api/monitoring`

---

## Reuse elsewhere

- **Widget only:** point `CHATBOT_BASE_URL` at this Worker  
- **RAG helper:** copy `faq()` + `EMBED_MODEL` into another Worker with Vectorize  
- **Streaming:** copy `runChatStream()` + SSE transform pattern  

Security reports: [SECURITY.md](../SECURITY.md) → contact@arnobmahmud.com
