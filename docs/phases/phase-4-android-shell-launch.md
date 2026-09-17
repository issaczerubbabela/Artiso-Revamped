# Phase 4 — Android Shell & Play Store Launch

**Platform:** Android.
**Estimated duration:** 3–4 weeks.
**Depends on:** [Phase 3](phase-3-filters-presets-export.md) — wraps a
feature-complete web app; this phase is integration and native plumbing,
not new product features.

## Goal

Ship the existing web app on Android via Capacitor, satisfying the "then
Android" half of the brief, and prove the cross-device sync story
end-to-end (web ↔ Android, not just web ↔ web as validated in Phase 2).

## Features in scope

**Capacitor integration** ([10](../architecture/10-mobile-android-shell.md))
- [ ] `apps/android` project scaffolded, bundling `apps/web`'s static
      export for full offline operation.
- [ ] `PlatformAdapter` implemented: `CapacitorAdapter` for
      pick/save/share, wired in alongside the existing `WebAdapter`.
- [ ] `@capacitor/camera`, `@capacitor/filesystem`, `@capacitor/share`,
      `@capacitor/app`, `@capacitor/status-bar`, `@capacitor/splash-screen`
      integrated.
- [ ] Android back button/gesture routed into the existing close-panel
      logic from [06](../architecture/06-workspace-interaction.md).
- [ ] Lazy permission requests (camera/photos), matching source spec's own
      minimal-permissions guidance.

**Cross-device validation**
- [ ] Import and edit a Reference on Android, confirm it appears correctly
      (identical render) on the web app, and vice versa.
- [ ] Confirm WebGL2 filter rendering parity between desktop Chrome and the
      Android WebView (this is the main platform-fidelity risk of the
      "one codebase" bet — validate it explicitly, don't assume it).

**Release**
- [ ] Signed AAB build pipeline in CI.
- [ ] `versionCode`/`versionName` sync script from `package.json`.
- [ ] Play Store listing (branding per source spec §9.13's positioning
      recommendation: "Professional Reference Preparation for Artists").
- [ ] Splash screen, app icon, adaptive icon.

## Explicitly out of scope

iOS, any new product features beyond what Phase 3 already shipped on web —
this phase is deliberately scoped to *porting*, not *building*.

## Exit criteria

- [ ] App installs and runs fully offline on a mid-range Android reference
      device (not a flagship).
- [ ] Cold start < 2s, peak memory < 300MB on that reference device
      (NFRs from [00](../architecture/00-system-overview.md)).
- [ ] All Phase 1–3 features work identically on Android WebView (manual
      parity pass against the Phase 1–3 exit-criteria checklists).
- [ ] Cross-device sync validated web ↔ Android, not just web ↔ web.
- [ ] Signed AAB successfully uploaded to Play Console internal testing
      track.
