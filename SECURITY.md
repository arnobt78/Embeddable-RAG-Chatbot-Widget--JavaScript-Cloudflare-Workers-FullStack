# Security Policy

## Supported Versions

| Version | Supported |
| --- | --- |
| `1.x` (main branch) | Yes |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Report privately by email:

- **Email:** [contact@arnobmahmud.com](mailto:contact@arnobmahmud.com)
- **Subject line suggestion:** `[SECURITY] Embeddable AI Chatbot Widget`

Include as much detail as you can:

- Affected URL / Worker route (for example `/api/chat`, `/api/seed`)
- Steps to reproduce
- Impact (data exposure, abuse, privilege escalation, etc.)
- Any proof-of-concept (non-destructive preferred)

You should receive an acknowledgement within a few business days. Once validated, we will work on a fix and coordinate disclosure.

## Scope Notes

This project is an embeddable Cloudflare Workers chatbot. Built-in controls include:

- **`SEED_SECRET`** — fail-closed auth on `POST /api/seed` (Bearer or `X-Seed-Secret`)
- **Chat rate limit** — Workers Rate Limiting binding `CHAT_LIMITER` (20 requests / IP / 60s), not KV counters
- **`robots.txt`** — blocks common AI scrapers on the demo site

Areas still worth responsible review:

- Cross-origin embedding and cookie / session handling (`SameSite=Lax`)
- Prompt injection and residual abuse of the public chat endpoint
- Dependency or supply-chain issues in the build toolchain

Thank you for helping keep users and operators safe.
