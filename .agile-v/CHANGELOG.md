# Changelog — Cycle C1

## 2026-08-11 — Workers abuse / crawl guardrails (DEC-0006)

- `public/robots.txt` blocks AI scrapers; short cache for HTML/robots
- `/api/seed` fail-closed `SEED_SECRET` (Bearer / X-Seed-Secret)
- `/api/chat` KV rate limit 20/min/IP
- `.dev.vars.example`, README, SECURITY, Agile V updates

## 2026-08-11 — Workers AI chat fallback (DEC-0005)

- Primary: `@cf/meta/llama-3.1-8b-instruct-fast`
- Instant fallback: `@cf/zai-org/glm-4.7-flash` via `runChatStream()` / `CHAT_MODELS`
- Still Workers AI only (no Gemini/OpenRouter/Groq keys)

## 2026-08-11 — Workers AI model fix (DEC-0004)

- Chat model: `@cf/meta/llama-3-8b-instruct` → `@cf/meta/llama-3.1-8b-instruct-fast`
- Embeddings: keep `@cf/baai/bge-base-en-v1.5`; centralized as `EMBED_MODEL`
- RAG: log failures in `faq()` via `console.error`
- Docs: README, CLAUDE.md, `docs/LLM_MODEL_SELECTION.md` this-repo subsection

## 2026-08-11 — Agile V bootstrap (docs/memory only)

- Created `.agile-v/` Cycle C1 project memory
- Filled `CLAUDE.md` with verified Cloudflare Workers stack
- Added candidate requirements and prioritized waves
- No application/runtime code changes
