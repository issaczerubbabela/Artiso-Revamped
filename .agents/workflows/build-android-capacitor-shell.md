# Workflow: Build the Android Capacitor Shell

Architecture: [docs/architecture/10-mobile-android-shell.md](../../docs/architecture/10-mobile-android-shell.md)

## Trigger

Phase 4 work: wrapping the web app for Android, or adding a new native
capability (camera, filesystem, share) later.

## Preconditions

- `apps/web` builds a static export successfully and is feature-complete
  through Phase 3.
- The `PlatformAdapter` interface already exists in `apps/web`, currently
  with only a `WebAdapter` implementation.

## Procedure

1. **Scaffold, don't hand-write, the native project.** Use
   `npx cap add android` against the existing static export output — do not
   write Gradle/Kotlin from scratch. Custom native code should be the
   exception, not the norm.
2. **Bundle the build, don't point at a URL.** Confirm the Capacitor config
   serves the app from the bundled `www`/`out` directory, not a remote
   server — this is what makes the app work fully offline. Verify by
   testing in airplane mode immediately after the first successful build.
3. **Implement `CapacitorAdapter` matching the existing `PlatformAdapter`
   interface exactly** — `pickImage()` via `@capacitor/camera`,
   `saveFile()` via `@capacitor/filesystem`, `share()` via
   `@capacitor/share`. Do not change the interface to accommodate Android;
   if the interface doesn't fit, that's a sign it needs to be revisited at
   the architecture level, not patched around.
4. **Select the adapter at runtime** via `Capacitor.isNativePlatform()` at
   a single composition point (e.g. app bootstrap/DI), not scattered
   `if (native)` checks.
5. **Wire back button before anything else native-specific.** Use
   `@capacitor/app`'s `backButton` listener to call into the same
   close-panel logic the desktop `Esc` key uses (see
   [06-workspace-interaction.md](../../docs/architecture/06-workspace-interaction.md)).
   Test this early — it's the native behavior most likely to feel wrong if
   done last.
6. **Request permissions lazily.** Camera/photo permissions are requested
   only when Import/Camera is actually invoked by the user, never at app
   launch — configure the manifest to declare them, but do not call the
   request API proactively.
7. **Validate WebGL2 parity** on an actual Android device/emulator against
   desktop Chrome for a fixed set of filter outputs — this is the one place
   the "one codebase" bet could silently break, since WebView GL driver
   behavior varies by device/OEM.
8. **Wire the version sync script** (`package.json` → `versionCode`/
   `versionName`) before the first CI release build, not after.

## Files/modules touched

`apps/android/*` (generated + Capacitor config), `apps/web/.../CapacitorAdapter.*`,
CI release pipeline config.

## Testing checklist

- [ ] App runs fully offline immediately after install (airplane mode from
      first launch).
- [ ] Back button/gesture closes open panels before exiting the app.
- [ ] Camera and gallery import both work and correctly hand off to the
      existing Import pipeline (see
      [build-image-import-pipeline.md](build-image-import-pipeline.md)).
- [ ] Export → save to gallery and → native share sheet both work.
- [ ] Filter output visually matches desktop Chrome on the same test-image
      set (WebGL2 parity check).
- [ ] Cold start < 2s, peak memory < 300MB on a mid-range reference device.
- [ ] Permission prompts appear only when the relevant feature is used, not
      at launch.

## Common pitfalls

- Pointing the WebView at a hosted URL "temporarily" and forgetting to
  switch to the bundled build before release — breaks offline operation
  entirely.
- Implementing Android-specific UI branches instead of using the adapter
  seam — reintroduces the two-codebase problem this architecture exists to
  avoid.
- Requesting all permissions upfront at launch — directly contradicts the
  minimal-permissions principle carried over from the source app's own
  security assessment.

## Related knowledge items

[`ki-canvas-first-design`](../knowledge/ki-canvas-first-design.md) (native
chrome — status bar, splash — must stay out of the canvas's way, same as on
web).
