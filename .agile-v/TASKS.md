# Tasks — Cycle C1

## Wave 0 — Analysis / memory (this session)

| ID | Task | REQ | Status |
|---|---|---|---|
| TASK-0001 | Bootstrap `.agile-v/` and reconcile with repo | — | DONE |
| TASK-0002 | Fill `CLAUDE.md` from verified stack | — | DONE |
| TASK-0003 | Produce prioritized plan for Gate 1 | — | DONE |

---

## Wave 1 — Security hardening (recommended first after approval)

| ID | Task | REQ | Status |
|---|---|---|---|
| TASK-0010 | Add auth gate to `/api/seed` (secret header/env) | REQ-0011 | PENDING approval |
| TASK-0011 | Document seed secret in README + `.dev.vars.example` | REQ-0011 | PENDING approval |
| TASK-0012 | Add chat rate limiting (define limits + storage) | REQ-0012 | PENDING approval |

---

## Wave 2 — Maintainability & docs alignment

| ID | Task | REQ | Status |
|---|---|---|---|
| TASK-0020 | Move FAQ corpus out of `seed()` into data module/file | REQ-0014 | PENDING approval |
| TASK-0021 | Label/adapt portable docs for Workers context (REQ-0019) | REQ-0019 | PENDING approval |
| TASK-0022 | Session strategy for cross-site embeds | REQ-0015 | PENDING approval |

---

## Wave 3 — Validation & observability

| ID | Task | REQ | Status |
|---|---|---|---|
| TASK-0030 | Introduce smoke/integration test harness | REQ-0013 | PENDING approval |
| TASK-0031 | Improve RAG/chat error visibility (observability) | REQ-0016 | PENDING approval |
| TASK-0032 | Optional analytics (decide PostHog vs CF) | REQ-0017 | PENDING approval |

---

## Wave 4 — Resilience / optional upgrades

| ID | Task | REQ | Status |
|---|---|---|---|
| TASK-0040 | Multi-provider LLM fallback design + implement | REQ-0018 | PENDING approval |
| TASK-0041 | CF-specific production guardrails | REQ-0022 | PENDING approval |
| TASK-0042 | Evaluate Redis need vs existing KV/Vectorize | REQ-0021 | PENDING approval |
| TASK-0043 | TypeScript migration plan (separate mini-cycle if approved) | REQ-0020 | PENDING approval |

---

## Recommended Gate 1 selection

**Approve Wave 1 (P0)** as first implementation slice unless human directs otherwise.
