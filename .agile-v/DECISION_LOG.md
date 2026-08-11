# Decision Log — Cycle C1

Append-only.

---

## DEC-0001 — Bootstrap Agile V Cycle 1

| Field | Value |
|---|---|
| Timestamp | 2026-08-11 |
| Agent | Cursor / Agile V orchestrator |
| Decision | Create `.agile-v/` and start Cycle C1 at Stage 1; no implementation code changes |
| Rationale | `.agile-v/` missing; protocol requires bootstrap + analysis + Gate 1 before coding |
| Linked | STATE.md, AGILE_V_PROTOCOL.md |

---

## DEC-0002 — Treat added docs as portable references, not current architecture

| Field | Value |
|---|---|
| Timestamp | 2026-08-11 |
| Agent | Cursor / Agile V orchestrator |
| Decision | `docs/Redis_Sentry_PostHog_INTEGRATION_GUIDE.md`, `docs/VERCEL_PRODUCTION_GUARDRAILS.md`, and much of `docs/LLM_MODEL_SELECTION.md` are **external/portable references** until adapted; source of truth remains CF Workers code |
| Rationale | Guides target Next.js/Vercel/other repos (`lib/redis.ts`, FreeScribe, CodeBook). Blind application would invent wrong stack |
| Linked | REQ-0019, RISK-0006 |

---

## DEC-0003 — Recommended first implementation wave = security (pending Gate 1)

| Field | Value |
|---|---|
| Timestamp | 2026-08-11 |
| Agent | Cursor / Agile V orchestrator |
| Decision | Propose Wave 1 (seed auth + rate limiting) as first post-approval work |
| Rationale | Highest severity verified risks on a public Worker |
| Linked | REQ-0011, REQ-0012, RISK-0001, RISK-0002 |
| Status | Superseded for model-fix slice by DEC-0004; security wave still awaiting confirmation |

---

## DEC-0004 — Migrate Workers AI chat model to llama-3.1-8b-instruct-fast

| Field | Value |
|---|---|
| Timestamp | 2026-08-11 |
| Agent | Cursor / Build |
| Decision | Replace deprecated `@cf/meta/llama-3-8b-instruct` with `@cf/meta/llama-3.1-8b-instruct-fast`; keep `@cf/baai/bge-base-en-v1.5`; no external provider fallbacks |
| Rationale | CF deprecated non-`-fast` Llama 3/3.1 IDs on 2026-05-30; `-fast` remains free-plan eligible; BGE dims must stay 768 for Vectorize |
| Linked | REQ-0002, REQ-0003, RISK-0005 |
| Status | Implemented |

---

## DEC-0005 — Workers AI in-binding chat fallback chain

| Field | Value |
|---|---|
| Timestamp | 2026-08-11 |
| Agent | Cursor / Build |
| Decision | Add `CHAT_MODELS = [llama-3.1-8b-instruct-fast, glm-4.7-flash]`; `runChatStream()` tries next model immediately on `AI.run` failure |
| Rationale | Same Workers AI binding; no external API keys; improves resilience when primary model is capacity-limited or errors |
| Linked | REQ-0002, RISK-0005 |
| Status | Implemented |

---

## DEC-0006 — Workers-native abuse / crawl guardrails

| Field | Value |
|---|---|
| Timestamp | 2026-08-11 |
| Agent | Cursor / Build |
| Decision | Add `robots.txt` AI-scraper blocks; fail-closed `SEED_SECRET` on `/api/seed`; initial KV rate-limit on `/api/chat`; do not implement Vercel/Next.js guardrails doc |
| Rationale | Public Worker cost + open seed risk; CF-native patterns match this stack |
| Linked | REQ-0011, REQ-0012, REQ-0022, RISK-0001, RISK-0002 |
| Status | Implemented (rate limit upgraded in DEC-0007) |

---

## DEC-0007 — Replace KV chat rate limit with Rate Limiting binding

| Field | Value |
|---|---|
| Timestamp | 2026-08-11 |
| Agent | Cursor / Build |
| Decision | Remove racy KV get/put counters; use `env.CHAT_LIMITER.limit({ key: ip })` with wrangler `ratelimits` 20/60 |
| Rationale | Agent Review race on concurrent chat; native binding is atomic per colo and fits abuse-prevention use case |
| Linked | REQ-0012, RISK-0002 |
| Status | Implemented |
