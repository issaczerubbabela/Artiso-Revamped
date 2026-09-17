# Phase 5 — Android Parity & Hardening

**Platform:** Android (with any fixes that also apply upstream to web).
**Estimated duration:** 2–3 weeks.
**Depends on:** [Phase 4](phase-4-android-shell-launch.md).

## Goal

Close the gap between "runs on Android" (Phase 4) and "feels native on
Android," and harden the app for public release rather than internal
testing.

## Features in scope

**Performance**
- [ ] Profile on 2–3 real mid/low-end Android devices, not just the Phase 4
      reference device — validate memory/cold-start/filter-latency NFRs
      hold across the hardware range the source app's install base implies.
- [ ] Tune `PerformanceMode` defaults ([09](../architecture/09-settings-preferences.md))
      based on real device profiling, not assumption.
- [ ] Validate the offline-first sync queue survives Android's aggressive
      background app termination (a failure mode desktop browsers don't
      have).

**Native feel**
- [ ] Gesture conflict audit: confirm canvas pinch/pan doesn't fight the
      Android edge-swipe back gesture at screen edges.
- [ ] Verify permission rationale dialogs match current Android version
      expectations (scoped storage compliance, per source spec §8.18).
- [ ] App icon/splash/status-bar polish pass.

**Reliability**
- [ ] Crash-free session rate baseline established (target from source
      spec's own KPI table, §10.4: < 0.5% crash rate).
- [ ] Storage-full, permission-revoked-mid-session, and low-memory
      failure modes explicitly tested (source spec §8.19 error-handling
      checklist).

## Explicitly out of scope

New features. This phase is entirely about making Phase 1–4's feature set
solid on real Android hardware.

## Exit criteria

- [ ] All NFR targets ([00-system-overview.md](../architecture/00-system-overview.md#7-cross-cutting-nfrs-carried-from-the-source-specs-stage-1011))
      hold on the low end of the tested device range, not just the
      reference device.
- [ ] Crash-free session rate ≥ 99.5% across an internal testing cohort.
- [ ] No gesture conflicts reported in a dedicated usability pass.
- [ ] Ready for Play Store production rollout (moved out of internal
      testing track).
