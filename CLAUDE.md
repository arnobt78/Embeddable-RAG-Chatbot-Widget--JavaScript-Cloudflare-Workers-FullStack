# CLAUDE.md

## Project
**ai-chatbot-widget** — Embeddable RAG FAQ chatbot on Cloudflare Workers (vanilla JS widget + Worker API).

| Field | Value |
|---|---|
| Cycle | C1 |
| Gate | GATE-0001 partial (models + guardrails + CHAT_LIMITER) |
| Resume | `.agile-v/STATE.md` |
| Live | https://ai-chatbot-widget.arnobt78.workers.dev/ |

---

## Stack
- **FE:** `public/widget.js` (zero deps), `public/index.html`, Tailwind → `styles.css`
- **BE:** `src/index.js` (Worker)
- **AI:** `CHAT_MODELS` = `@cf/meta/llama-3.1-8b-instruct-fast` → `@cf/zai-org/glm-4.7-flash`; `EMBED_MODEL` = `@cf/baai/bge-base-en-v1.5`
- **Data:** KV `CHAT_SESSIONS`; Vectorize `faq-vectors` (768-d)
- **Limit:** `CHAT_LIMITER` 20/60s (Rate Limiting binding)
- **Secret:** `SEED_SECRET` (fail-closed `/api/seed`)

---

## Scripts
`npm run dev` | `npm run deploy` | `npm run build:css`

---

## Rules
- Code is SoT. This is **not** Next.js/Vite/React.
- Prefer extending Worker + widget; no parallel stacks.
- Portable docs under `docs/` may describe other repos — reconcile before applying.
- Never commit `.dev.vars`.

---

## Validation
Record in `.agile-v/VALIDATION_SUMMARY.md`. Resume from `.agile-v/STATE.md`.
