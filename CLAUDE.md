# CLAUDE.md

## Project
**ai-chatbot-widget** — Embeddable RAG FAQ chatbot (CF Workers + vanilla JS). Not Next/Vite/React.

| Field | Value |
|---|---|
| Cycle | C1 |
| Gate | GATE-0001 partial (models, guardrails, CHAT_LIMITER, Sentry) |
| Resume | `.agile-v/STATE.md` |
| Live | https://ai-chatbot-widget.arnobt78.workers.dev/ |

## Stack
- FE: `public/widget.js`, `index.html`, Tailwind→`styles.css`, `vendor/sentry-browser.min.js`
- BE: `src/index.js` + `nodejs_compat`
- AI: llama-3.1-8b-instruct-fast → glm-4.7-flash; embed bge-base-en-v1.5
- Data: KV `CHAT_SESSIONS`; Vectorize `faq-vectors`
- Limit: `CHAT_LIMITER` 20/60s
- Secrets: `SEED_SECRET`; `SENTRY_DSN` (`@sentry/cloudflare` + `POST /api/monitoring`)

## Scripts
`npm run dev` | `deploy` | `build:css` | `vendor:sentry`

## Rules
Code is SoT. Prefer Workers patterns; ignore Next densify/Zod/Redis/Vite from portable docs unless adapted. Never commit `.dev.vars`.

## Validation
`.agile-v/VALIDATION_SUMMARY.md` · resume `.agile-v/STATE.md`
