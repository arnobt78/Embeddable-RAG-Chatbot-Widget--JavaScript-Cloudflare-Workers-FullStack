# Risk Register — Cycle C1

| ID | Risk | Severity | Likelihood | Mitigation | Linked |
|---|---|---|---|---|---|
| RISK-0001 | Unauthenticated `/api/seed` lets anyone overwrite Vectorize FAQ index | High | Mitigated | `SEED_SECRET` fail-closed (DEC-0006) | REQ-0011 |
| RISK-0002 | Open CORS + public `/api/chat` enables AI cost abuse | High | Partial | KV rate limit 20/min/IP (DEC-0006); CORS still `*` | REQ-0012 |
| RISK-0003 | Silent RAG failures (`faq` empty catch) degrade answer quality unnoticed | Medium | Low (mitigated) | `console.error` in `faq()` catch (partial REQ-0016) | REQ-0016 |
| RISK-0004 | Cross-site cookie (`SameSite=Lax`) may break session on third-party embeds | Medium | Medium | Session header / `None; Secure` with docs (REQ-0015) | REQ-0015 |
| RISK-0005 | Deprecated Workers AI chat model (`llama-3-8b-instruct`) breaks chat | Medium | Mitigated | Migrated to `@cf/meta/llama-3.1-8b-instruct-fast` (DEC-0004) | REQ-0002 |
| RISK-0006 | Portable docs (Next.js/Vercel) mislead agents into wrong stack changes | High (process) | High | Adapt or mark external (REQ-0019); CLAUDE.md stack truth | REQ-0019 |
| RISK-0007 | No automated tests → regressions on deploy | Medium | High | Smoke tests (REQ-0013) | REQ-0013 |
| RISK-0008 | FAQ PII/family details in public seed corpus | Medium (privacy) | Certain (in code) | Human review of published FAQ content | REQ-0006 |
| RISK-0009 | Adding Redis/Sentry/PostHog without Workers adaptation increases complexity for little gain | Medium | Med if rushed | Require architecture decision before install | REQ-0021, DEC pending |
