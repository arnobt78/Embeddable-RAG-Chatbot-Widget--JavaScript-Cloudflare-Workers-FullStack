# Requirements — Cycle C1

Status legend: `BASELINE` = already implemented in code | `CANDIDATE` = proposed, needs Gate 1 | `DEFERRED` | `REJECTED`

---

## Baseline (verified in code)

| ID | Statement | Evidence | Status |
|---|---|---|---|
| REQ-0001 | Worker serves embeddable static assets from `public/` with long-cache headers | `src/index.js` ASSETS fetch + Cache-Control | BASELINE |
| REQ-0002 | `POST /api/chat` streams AI replies via SSE using Workers AI with in-binding model fallback | `runChatStream()` + `CHAT_MODELS` (llama-3.1-8b-instruct-fast → glm-4.7-flash) | BASELINE |
| REQ-0003 | Chat uses RAG: BGE embedding + Vectorize top-K FAQ context | `faq()` + `@cf/baai/bge-base-en-v1.5` (`EMBED_MODEL`) | BASELINE |
| REQ-0004 | Sessions persist in KV for 30 days via `chatbot_session` cookie | `CHAT_SESSIONS` + TTL | BASELINE |
| REQ-0005 | `GET /api/history` returns messages for current session cookie | history route | BASELINE |
| REQ-0006 | `POST /api/seed` upserts hardcoded FAQ embeddings into Vectorize (secret-gated) | `seed()` + `assertSeedAuth` / `SEED_SECRET` | BASELINE |
| REQ-0007 | `GET /api/health` returns `{ status: "ok", sentryDsn }` | health route | BASELINE |
| REQ-0008 | Widget is zero-dependency vanilla JS, configurable via `window.CHATBOT_*` | `public/widget.js` | BASELINE |
| REQ-0009 | Widget supports dark/light theme, mobile layout, streaming UI | `public/widget.js` | BASELINE |
| REQ-0010 | CORS allows any origin for embed use | `Access-Control-Allow-Origin: *` | BASELINE |
| REQ-0011 | Protect `/api/seed` with a shared secret; reject unauthenticated calls | `assertSeedAuth` fail-closed | BASELINE |
| REQ-0012 | Rate-limit `/api/chat` via Workers Rate Limiting binding | `CHAT_LIMITER` + `assertChatRateLimit` 20/min | BASELINE |
| REQ-0016 | Optional Sentry via `@sentry/cloudflare` + capture on chat/RAG/seed hard failures | `Sentry.withSentry` + `captureErr` when `SENTRY_DSN` set | BASELINE |
| REQ-0022 | CF-native production guardrails (robots.txt AI scrapers + seed/chat controls) | `public/robots.txt` + REQ-0011/0012 | BASELINE (partial) |
| REQ-0023 | Browser Sentry envelopes tunnel through `POST /api/monitoring` (DSN allowlist) | `monitoring()` + vendored browser SDK | BASELINE |

---

## Candidate (proposed for C1 — need approval)

| ID | Statement | Rationale | Priority | Status |
|---|---|---|---|---|
| REQ-0013 | Add automated smoke tests for API routes (health, chat validation, seed auth) | Zero test coverage today | P1 | CANDIDATE |
| REQ-0014 | Extract FAQ corpus from `seed()` into a data file; seed reads that source | Maintainability; 20 FAQs hardcoded in handler | P1 | CANDIDATE |
| REQ-0015 | Improve third-party embed session reliability (cookie `SameSite` / alternate session id strategy) | Cross-site embeds may drop `SameSite=Lax` cookies | P1 | CANDIDATE |
| REQ-0017 | Optional analytics events for widget open / message sent (PostHog or CF Analytics — Workers-compatible) | Guide exists but targets Next.js | P2 | CANDIDATE |
| REQ-0018 | Multi-model / provider fallback for chat (Workers AI primary; optional external fallback per LLM guide) | Single-model SPOF | P2 | CANDIDATE |
| REQ-0019 | Adapt portable docs so they match this CF Workers stack (or mark as external references only) | Docs currently describe Next.js / Vercel / other repos | P1 | CANDIDATE |
| REQ-0020 | TypeScript migration (Worker + optional typed widget) | Not present; optional quality uplift | P3 | CANDIDATE |
| REQ-0021 | Redis/Upstash caching layer for embeddings or FAQ lookup | Guide is Next.js-oriented; KV already used for sessions — justify before adding | P3 | CANDIDATE |

---

## Explicit non-goals (unless approved)

- Migrating hosting from Cloudflare Workers to Vercel/Next.js
- Blindly implementing the Next.js Redis/Sentry/PostHog guide as written
- Rewriting the widget into React/Next without a separate cycle

---

## Traceability notes

- New tasks must reference a REQ-ID.
- Changing a BASELINE REQ requires a CHANGELOG + DECISION_LOG entry.
