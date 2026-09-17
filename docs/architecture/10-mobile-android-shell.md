# 10 — Android Shell (Capacitor)

Package: `apps/android`

## Purpose

A thin native wrapper around the exact same `apps/web` production build,
giving it access to device features (gallery, camera, filesystem, share)
and a Play Store presence — **not** a second implementation of the UI or
rendering pipeline. This is what makes "web first, then Android" a wrapping
exercise rather than a rewrite.

## How it works

`apps/web` builds to a static export (`next build && next export`, or
Next.js's static output mode), bundled directly into the Capacitor Android
project so the app works **fully offline** out of the box — it is not
merely a WebView pointed at a hosted URL. Capacitor 6, targeting a
Chromium-based Android WebView (WebGL2-capable since API 26+, matching the
[Canvas Renderer](05-canvas-renderer.md)'s WebGL2 baseline).

## Native plugins in use

| Plugin | Used for |
| --- | --- |
| `@capacitor/camera` | Gallery picker + camera capture (replaces the web `<input type="file">`) |
| `@capacitor/filesystem` | Save exports to device storage / Photos |
| `@capacitor/share` | Native share sheet for exported images |
| `@capacitor/app` | Back-button/back-gesture handling, app lifecycle (background/foreground) |
| `@capacitor/status-bar`, `@capacitor/splash-screen` | Branding — matches the source app's splash screen (source spec §2.4) |

IndexedDB (offline cache) and the Supabase JS client (sync) work unmodified
inside the Capacitor WebView — **no Android-specific backend code is
needed**; this is a direct payoff of the "one web codebase" platform
decision in [00](00-system-overview.md).

## The `PlatformAdapter` seam

A single interface in `apps/web` is the only place platform branching
happens:

```ts
interface PlatformAdapter {
  pickImage(): Promise<Blob>;
  saveFile(blob: Blob, suggestedName: string): Promise<void>;
  share(blob: Blob, title?: string): Promise<void>;
}
```

Two implementations, selected at runtime via `Capacitor.isNativePlatform()`:

- `WebAdapter` — `<input type="file">`, `<a download>`, Web Share API.
- `CapacitorAdapter` — `@capacitor/camera`, `@capacitor/filesystem`,
  `@capacitor/share`.

No other module ([Image Import](01-image-import.md),
[Export](07-export-engine.md)) branches on platform directly — they call
`PlatformAdapter`, keeping the platform-specific surface area to one file
per concern.

## Back button / back gesture

Android hardware back button and the gesture-nav back swipe are both routed
through `@capacitor/app`'s `backButton` listener into the same close-panel
logic the desktop `Esc` key triggers (see
[06-workspace-interaction.md](06-workspace-interaction.md)): closes an open
sheet/dialog first, only exits the app when the workspace is at Idle/Home
with nothing open.

## Permissions

Camera and photo library access declared in the Capacitor Android manifest
config, but **requested lazily** — only when Import/Camera is actually
invoked, never on app launch. This matches the source spec's own security
assessment guidance (§8.17/§8.18: minimal permissions, scoped-storage
compliance) and avoids a cold-open permission wall that would hurt the
"fast setup" need for Beginner/Student personas.

## Build & release

- Capacitor generates a standard Gradle/Android Studio project; no custom
  native (Kotlin/Java) code expected beyond plugin configuration.
- CI produces a signed AAB for Play Store submission.
- `versionCode`/`versionName` derived from `package.json` via a small sync
  script, so web and Android releases share a single version source of
  truth.

## Performance validation

Target: peak WebView memory **< 300MB**, cold start **< 2s**, on a
mid-range reference device (specific device TBD in Phase 4 test plan) — not
a flagship, since the source app's install base skews toward typical
consumer Android hardware.

## Dependencies

- `apps/web` build output (the only real dependency).
- `packages/api-client` — same sync logic runs unmodified.

## Deferred

iOS shell (same Capacitor project, near-zero-rewrite addition, explicitly
out of scope per the "web then Android" brief ordering).
