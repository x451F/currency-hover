# Currency Hover Extension

A Manifest V3 Chrome extension that converts selected numbers into multiple currencies with a lightweight tooltip.

## Features
- Highlight a number on any webpage to see conversions near your selection.
- Popup controls for enable/disable, base currency, target currencies, and rate refresh.
- Full options page for cache TTL, tooltip behavior, and optional currency detection.
- Frankfurter API (no API key) with cache + TTL and graceful error handling.
  - Currency detection recognizes dollar/euro/pound/yen symbols and ISO codes in the selection text.
- Favorites for quick target toggling and a theme setting (system/light/dark).

## Setup
```bash
pnpm i
pnpm build
```

Load unpacked:
1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `dist` folder.

## Dev Workflow
- `pnpm dev` builds in watch mode to `dist`.
- `pnpm lint` runs ESLint.
- `pnpm test` runs parser unit tests.

## Architecture Overview
```
src/
  background/   Service worker + rate fetching/caching
  content/      Selection handling + tooltip rendering
  shared/       Types, settings, storage, parsing, formatting
  popup/        Popup UI
  options/      Options page UI
```

### Data Flow
- Content script detects selection, parses first number, and sends `CONVERT` to the background.
- Background retrieves cached rates (or fetches new ones), computes conversions, and replies.
- Tooltip renders results and auto-hides (or hides on ESC/click/scroll).

### Storage
- `chrome.storage.sync` stores user settings.
- `chrome.storage.local` caches FX rates per base currency with TTL.

## Debugging Tips
- Inspect the service worker via **chrome://extensions -> Service Worker**.
- Use **Inspect popup** for the popup UI.
- Use DevTools on any tab to inspect the content script.

## Notes on MV3
- Service worker is an ES module (`background.js`).
- Content script is also an ES module (`content.js`) via the manifest `type` field.
- Rates are fetched only from `https://api.frankfurter.dev/*` (host permission).

## Icons
Placeholder PNG icons are provided in `public/icons/` (replace with real artwork):
- `icon16.png`
- `icon32.png`
- `icon48.png`
- `icon128.png`

## Build Output
`pnpm build` outputs:
- `dist/manifest.json`
- `dist/background.js`
- `dist/content.js`
- `dist/popup.html`
- `dist/options.html`
- `dist/content.css`
