# Phase 0 — Foundations

**Platform:** Tooling only, no user-facing surface.
**Estimated duration:** 1–2 weeks.
**Depends on:** Nothing — this is the starting point.

## Goal

Stand up the monorepo, tooling, CI, and design-system skeleton so every
subsequent phase is building features, not fighting infrastructure.

## Scope

- [ ] Initialize pnpm workspace + Turborepo (`apps/web`, `packages/core-engine`,
      `packages/renderer`, `packages/ui`, `packages/api-client`,
      `packages/shared-types`).
- [ ] TypeScript strict mode across all packages; shared `tsconfig.base.json`.
- [ ] ESLint + Prettier, shared config.
- [ ] Vitest configured for `core-engine` and `renderer` (headless unit
      testing — no DOM/browser dependency for these packages, per the
      architectural invariant in [00-system-overview.md](../architecture/00-system-overview.md)).
- [ ] Playwright configured for `apps/web` E2E (empty smoke test to start).
- [ ] Next.js app scaffold in `apps/web` (App Router, static export output
      mode enabled from day one — this is what Android will bundle later).
- [ ] `packages/shared-types`: initial Zod schemas from
      [11-data-model-schema.md](../architecture/11-data-model-schema.md).
- [ ] `packages/ui`: design tokens (spacing, color, typography, **44–48px
      minimum touch target** baked in per the accessibility decision in
      [09-settings-preferences.md](../architecture/09-settings-preferences.md)),
      responsive breakpoint tokens matching
      [06-workspace-interaction.md](../architecture/06-workspace-interaction.md)
      (`compact < 768px`, `regular 768–1023px`, `wide ≥ 1024px`).
- [ ] CI: lint + typecheck + unit tests on every PR (GitHub Actions or
      equivalent).
- [ ] Empty Supabase project provisioned; connection wired end-to-end with a
      single smoke-test table, no real schema yet.

## Explicitly out of scope

Any actual product feature. No image import, no canvas, no grid. This phase
produces zero user-visible functionality by design.

## Exit criteria

- `pnpm dev` boots a blank Next.js app.
- `pnpm test` runs (and passes) headless unit tests in `core-engine`.
- `pnpm build` produces a static export.
- CI is green on a trivial PR.
- A design-system Storybook (or equivalent) renders the base tokens at all
  three breakpoints.
