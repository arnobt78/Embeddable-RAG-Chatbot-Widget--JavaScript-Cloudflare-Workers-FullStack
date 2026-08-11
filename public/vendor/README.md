# Vendored browser assets

`cb-obs.min.js` — official Sentry Browser SDK IIFE (`bundle.min.js`), renamed so ad blockers do not match a `*sentry*` URL filter. Served same-origin; envelopes go through `POST /api/monitoring`.

Refresh:

```bash
npm run vendor:sentry
```
