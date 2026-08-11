# Vendored browser assets

`sentry-browser.min.js` — official Sentry Browser SDK IIFE (`bundle.min.js`), served same-origin so ad blockers are less likely to strip the script. Refresh with:

```bash
npm run vendor:sentry
```

Do not load `browser.sentry-cdn.com` from the widget; envelopes go through `POST /api/monitoring`.
