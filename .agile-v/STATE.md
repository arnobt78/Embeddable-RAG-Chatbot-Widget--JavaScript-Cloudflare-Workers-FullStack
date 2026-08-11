# Agile V State

| Field | Value |
|---|---|
| Cycle | C1 |
| Stage | 3 — Synthesis (partial) |
| Gate | GATE-0001 partial — model fix + Workers guardrails approved via plans |
| Status | Chat models + seed auth + chat rate limit + robots.txt implemented |
| Resume token | `C1-HG1-2026-08-11` |
| Last updated | 2026-08-11 |

---

## What this project is (verified)

Embeddable RAG FAQ chatbot widget on **Cloudflare Workers**:

- Worker API + asset serving: `src/index.js`
- Embeddable client: `public/widget.js` (vanilla JS, zero deps)
- Demo page: `public/index.html` + `public/robots.txt`
- Bindings: Workers AI, Vectorize (`faq-vectors`), KV (`CHAT_SESSIONS`), ASSETS
- Secret: `SEED_SECRET` (fail-closed seed)
- Models: `CHAT_MODELS` = llama-3.1-8b-instruct-fast → glm-4.7-flash; `EMBED_MODEL` = bge-base-en-v1.5
- Guardrails: chat 20/min/IP; AI scrapers blocked in robots.txt

Live: `https://ai-chatbot-widget.arnobt78.workers.dev/`

---

## Completed

- [x] Agile V bootstrap + analysis
- [x] Workers AI model migrate + fallback (DEC-0004 / DEC-0005)
- [x] REQ-0011 seed auth, REQ-0012 rate limit, REQ-0022 partial robots (DEC-0006)
- [x] README / SECURITY / `.agile-v` sync

---

## Remaining

- [ ] `wrangler deploy` + `wrangler secret put SEED_SECRET` then smoke live APIs
- [ ] Remaining candidates (tests, FAQ extract, session SameSite, etc.)
- [ ] Stage 4 Red Team / Gate 2 for release

---

## Blockers

- Deploy/smoke needs user Cloudflare auth + production `SEED_SECRET`.

---

## Next exact task

User: set `SEED_SECRET`, deploy, verify `/robots.txt`, seed with Bearer, chat under/over rate limit.
