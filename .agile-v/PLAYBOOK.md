# Playbook — Cloudflare Chatbot Widget

## Resume

1. Read `docs/AGILE_V_PROTOCOL.md`
2. Read `CLAUDE.md`
3. Read `.agile-v/STATE.md` + `CHECKPOINTS.md`
4. Load only files needed for current stage

## Architecture (do not reinvent)

```text
Browser (widget.js)
  → POST /api/chat (SSE) → Worker
      → KV session
      → AI embed (BGE) → Vectorize topK
      → AI chat (CHAT_MODEL) stream
  → GET /api/history
  → static assets via ASSETS binding
```

## Stack constraints

- **Not** Next.js / Vercel App Router
- Prefer Workers-native solutions (KV, Durable Objects, AI Gateway, Workers Analytics) over pasting Next.js guides
- Preserve vanilla JS zero-dep widget unless a cycle explicitly migrates it

## Before coding

Analyze → plan → **wait for Gate approval** → implement → validate → update STATE.md
