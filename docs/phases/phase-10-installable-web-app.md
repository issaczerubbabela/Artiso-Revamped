# Phase 10 — Installable Web App & iPad

**Status: implemented (2026-11-07).** Activated by direct user instruction so
the app can be hosted for free and used on phone, laptop and iPad. It is the
web-only route to the cross-device goal: the Android/iOS shells (Phases 4–5,
iOS in 6) stay skipped. Hosting steps: [`../deployment.md`](../deployment.md).

## Why

The hosted web app had no manifest or service worker, so it could not be
installed, could not cold-start offline (invariant 5), and Safari could evict
its IndexedDB — the only copy of unsynced edits — after ~7 days. It had also
never run in WebKit, which every iPhone/iPad browser uses; doing so found that
**import failed on every WebKit build tested**.

## Checklist

- [x] Web app manifest, icons (any + maskable + Apple touch), Apple web-app
      metadata, `viewport-fit=cover`.
- [x] Service worker generated at build time (`apps/web/scripts/generate-sw.mjs`):
      precaches the export under a content-hash cache, cache-first, SPA
      navigations served from `/`, cross-origin (Supabase) untouched, no
      `skipWaiting` so an open session keeps the chunks it was built with.
- [x] `navigator.storage.persist()` at startup.
- [x] Safe-area insets for every floating panel (`--inset-*` in `chrome.css`).
- [x] Screen wake lock while a reference is open (`platform/wake-lock.ts`).
- [x] WebKit fixes found by running the suite in WebKit:
  - Asset bytes stored in IndexedDB as `{ bytes: ArrayBuffer, type }`, not
    `Blob` — WebKit rejects Blobs in ephemeral sessions (Safari Private
    Browsing). Old Blob rows still read.
  - Scratch-canvas fallback to a detached `<canvas>` when `OffscreenCanvas` is
    missing (Safari < 16.4); core-engine stays DOM-free via an injected factory.
  - Import errors are shown on the Projects screen (they were silent there).
  - `setPointerCapture` failure no longer drops a pointer from pan/pinch.
- [x] Playwright `webkit` project (whole suite) + `ipad.spec.ts` (touch, both
      orientations); `playwright.pwa.config.ts` (offline cold start against the
      production export). CI installs WebKit and runs both; CI now also triggers
      on pushes to `master` (it was `main`, which doesn't exist).

## Exit criteria

- [x] The whole e2e suite passes in Chromium and WebKit.
- [x] With the network cut after first load, a reload starts the app and a
      photo imports (`pwa.spec.ts`).
- [x] Pinch-zoom and touch taps work at iPad landscape (Wide) and portrait
      (Regular) (`ipad.spec.ts`).
- [ ] On a real iPad: Add to Home Screen launches full screen, chrome clears the
      rounded corners/home indicator, the screen stays awake, Apple Pencil
      annotates. (Manual — no emulator covers these.)

## Known limitations

- Playwright's WebKit on Windows is not Safari: no `OffscreenCanvas`, and it
  can't test Home Screen mode, wake lock or Pencil. The real-device pass above
  is still owed.
- iPad portrait (768–1023px) still uses the rail + narrowed dock rather than a
  distinct overlay drawer.
- No Pencil-only drawing / palm rejection: a finger and the Pencil both
  annotate in the Annotate tool.
- HEIC files dragged in from the Files app are rejected (the photo picker
  converts to JPEG on its own).
- Safari can't encode WebP, so thumbnails made there are PNG (larger, still
  correct).
