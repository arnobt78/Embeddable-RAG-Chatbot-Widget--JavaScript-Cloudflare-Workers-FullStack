# CLAUDE.md

## Project Overview

Project Name: ai-chatbot-widget (cloudflare-chatbot-widget)

Description: Embeddable RAG FAQ AI chatbot — Cloudflare Worker API + vanilla JS widget (SSE streaming, Vectorize RAG, KV sessions).

Current Status: Production-capable baseline on Workers; C1 model-fix (DEC-0004) implemented — chat uses `@cf/meta/llama-3.1-8b-instruct-fast`.

Current Agile V Cycle: C1

Current Gate: GATE-0001 partial APPROVED (model fix); other candidates still PENDING — resume token `C1-HG1-2026-08-11`

---

## Tech Stack

Frontend: Vanilla JavaScript widget (`public/widget.js`); demo page HTML + Tailwind-compiled CSS

Backend: Cloudflare Workers (`src/index.js`)

Database: Cloudflare KV (sessions); Vectorize (FAQ embeddings)

Authentication: Chat is public (rate-limited 20/min/IP). Session cookie `chatbot_session` (HttpOnly, SameSite=Lax). Seed requires `SEED_SECRET` (Bearer / X-Seed-Secret), fail-closed if unset.

Infrastructure: Workers AI (`@cf/meta/llama-3.1-8b-instruct-fast` → fallback `@cf/zai-org/glm-4.7-flash`, `@cf/baai/bge-base-en-v1.5`), Vectorize index `faq-vectors`, KV `CHAT_SESSIONS`, static ASSETS

Deployment: Wrangler (`npm run deploy`)

Testing: None yet (candidate REQ-0013)

---

## Architecture

Follow the existing project architecture.

Do not introduce new architectural patterns unless explicitly approved.

Preserve:

- folder structure (`src/` Worker, `public/` assets)
- naming conventions
- reusable components
- reusable hooks
- reusable libs
- reusable utilities
- reusable types
- reusable services

Prefer extending existing implementations instead of creating parallel ones.

This repo is **not** a Next.js app. Portable docs under `docs/` may describe other stacks — reconcile against code before applying.

---

## Rendering Rules

Prefer server-first architecture.

Server components:

- authentication
- metadata
- initial data loading
- layouts
- page shells
- stable UI

Client components:

- interactivity
- forms
- mutations
- dialogs
- browser APIs

Never convert an entire page into a client component because one section is interactive.

**Note for this project:** The widget is intentionally client-side vanilla JS. The Worker is the server. Do not invent a React/Next rendering split unless a dedicated cycle approves a migration.

---

## State Management

Single source of truth.

Avoid duplicated state.

Prefer the project's established query/cache strategy.

Do not duplicate:

- query keys
- mutation logic
- API calls
- schemas

**Here:** Session source of truth = KV via cookie; client `msgs[]` mirrors UI. Do not add a second session store without an approved REQ.

---

## Coding Rules

Always:

- TypeScript strict *(when/if TS is approved — currently JS)*
- reusable code
- readable code
- maintainable code
- scalable code
- production-ready code

Avoid:

- duplicated code
- dead code
- commented-out code
- unnecessary abstractions
- unrelated refactoring

---

## Validation

Before considering work complete:

- typecheck *(N/A until TS)*
- lint *(add if approved)*
- tests
- build (`npm run build:css` / `wrangler` deploy dry-run as applicable)

Record validation results in:

.agile-v/VALIDATION_SUMMARY.md

---

## Project Memory

Current project state is stored in:

.agile-v/

Always resume from:

.agile-v/STATE.md

---

## Documentation

Update only affected files.

Never duplicate information across:

- CLAUDE.md
- AGENTS.md
- .agile-v/\*
- docs/

---

## Session Workflow

Before coding:

1. Analyze
2. Plan
3. Wait for approval

After approval:

1. Implement
2. Validate
3. Update project memory
4. Write resume point

---

## Resume

Always continue from

.agile-v/STATE.md

unless instructed otherwise.
