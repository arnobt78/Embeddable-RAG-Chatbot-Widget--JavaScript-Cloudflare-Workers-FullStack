# Validation Summary — Cycle C1

| Field | Value |
|---|---|
| Cycle | C1 |
| Last run | 2026-08-11 (Workers guardrails DEC-0006) |
| Eval gate status | N/A (partial Gate 1; not Gate 2 release) |

## Commands available (verified in package.json)

| Script | Purpose |
|---|---|
| `npm run build:css` | Tailwind + append widget styles → `public/styles.css` |
| `npm run dev` | build:css + `wrangler dev` |
| `npm run deploy` | build:css + `wrangler deploy` |

## Missing validation tooling

- No `typecheck` (JS only)
- No `lint` script
- No `test` script / test directory

## Session validation

| Check | Result | Notes |
|---|---|---|
| `node --check src/index.js` | PASS | Exit 0 |
| `npm run build:css` | PASS | Exit 0 |
| Seed auth helpers present | PASS | `assertSeedAuth`, `SEED_SECRET` |
| Chat rate limit helpers present | PASS | `assertChatRateLimit`, 20/60s |
| `public/robots.txt` present | PASS | AI scrapers Disallow |
| Asset cache split HTML/robots vs JS/CSS | PASS | `assetCacheControl()` |
| Static guardrails wiring check | PASS | `GUARDRAILS_OK` |
| Live deploy smoke | PENDING | User: secret + deploy |

## VAL records

| ID | Claim | Result | Evidence |
|---|---|---|---|
| VAL-0004 | Deprecated llama-3-8b-instruct removed | PASS | `CHAT_MODEL` fast variant |
| VAL-0005 | Embedding model unchanged (768-d BGE) | PASS | `EMBED_MODEL` |
| VAL-0008 | `/api/seed` fail-closed without secret | PASS (code) | `assertSeedAuth` → 503/401 |
| VAL-0009 | `/api/chat` rate-limited | PASS (code) | KV `rl:chat:…` |
| VAL-0010 | robots.txt blocks AI scrapers | PASS | `public/robots.txt` |

## Manual curl checks (after deploy)

```bash
curl -sS https://YOUR/robots.txt | head
curl -sS -X POST https://YOUR/api/seed   # expect 503 or 401
curl -sS -X POST https://YOUR/api/seed -H "Authorization: Bearer $SEED_SECRET"
# burst chat to verify 429
```
