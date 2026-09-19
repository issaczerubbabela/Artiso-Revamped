# 11 — Shared Data Model / Schema

Package: `packages/shared-types` (Zod schemas — source of truth for both
client TS types and the Postgres schema)

## Entities

```ts
type User = {
  id: string;
  email: string;
  createdAt: string;
  // synced workflow defaults (see 09-settings-preferences.md split table)
  defaultGridConfig: GridConfig;
  defaultAdjustments: Pick<Operation, "brightness" | "contrast" | "saturation">[];
  defaultExportSettings: ExportSettings;
};

type Project = {
  id: string;
  ownerId: string;
  name: string;
  tags: string[];
  thumbnailAssetId: string | null;
  createdAt: string;
  updatedAt: string;
};

type Reference = {
  id: string;
  projectId: string;
  originalAssetId: string;
  editStack: Operation[];
  gridConfig: GridConfig;
  notes: string;
  createdAt: string;
  updatedAt: string;
  version: number;           // monotonic, used for last-write-wins conflict check (see 08)
};

type Operation =
  | { type: "crop"; rect: { x: number; y: number; w: number; h: number } }  // normalized 0-1
  | { type: "rotate"; degrees: 0 | 90 | 180 | 270 }
  | { type: "flip"; axis: "horizontal" | "vertical" }
  | { type: "brightness"; value: number }   // -100..100
  | { type: "contrast"; value: number }     // -100..100
  | { type: "saturation"; value: number }   // -100..100
  | { type: "filter"; id: FilterId; params?: Record<string, number> };

type FilterId =
  | "grayscale" | "highContrast" | "lowContrast" | "threshold"
  | "posterize" | "pencilSketch" | "edgeDetect" | "invert"
  | "blur" | "sharpen";

type GridConfig = {
  rows: number;
  cols: number;
  color: string;
  opacity: number;            // 0-100
  thickness: "veryThin" | "thin" | "medium" | "thick" | "extraThick";
  numberingMode: "off" | "numbers" | "letters" | "alphanumeric" | "roman" | "custom";
  visible: boolean;
  snapToImage: boolean;
};

type Preset = {
  id: string;
  ownerId: string;
  name: string;               // e.g. "Portrait Fine Grid", "Graphite Sketch"
  gridConfig: GridConfig;
  filterStack: Operation[];
  exportSettings: ExportSettings;
  createdAt: string;
};

type Asset = {
  id: string;
  ownerId: string;
  storageKey: string;          // originals/{userId}/{contentHash}.{ext}
  contentHash: string;         // dedupe key, unique constraint
  width: number;
  height: number;
  sizeBytes: number;
  createdAt: string;
};

type ExportSettings = {
  format: "png" | "jpeg";
  quality: number;             // 0-100
  includeGrid: boolean;
  includeAdjustments: boolean;
  profileId?: string;
};
```

## Postgres tables (mirrors the above 1:1)

`users`, `projects`, `references` (`edit_stack jsonb`, `grid_config jsonb`),
`presets`, `assets` (`content_hash` unique), `export_history`.

Every table has an `owner_id` (or reachable via `project_id → owner_id`)
column with a Row Level Security policy scoped to the owner. In Phases 0–5
nothing was readable or writable across accounts. Since
[phase 8](../phases/phase-8-collaboration-split-view.md), a Project can be
shared: `project_members(project_id, user_id, role)` (role `editor` or
`viewer`) extends read access to projects, references, and the assets behind
them, and write access to references for editors. Membership itself changes
only through `SECURITY DEFINER` functions (see [08](08-project-sync-backend.md)).
`references` also gained `secondary_grid_config`, `annotations`, and
`removed_annotation_ids` (annotation tombstones for collaborative merge).

## Versioning

`references.version` increments on every metadata write; used exclusively
for the last-write-wins conflict check described in
[08-project-sync-backend.md](08-project-sync-backend.md#conflict-resolution-last-write-wins-explicit-simplifying-assumption).

## IndexedDB (local mirror)

The same shapes are mirrored locally (via Dexie or idb) for offline-first
operation — `references`/`projects`/`presets` object stores keyed
identically to their Postgres counterparts, plus a `syncQueue` store for
pending writes. This is intentionally the *same* shape client- and
server-side to avoid a mapping layer.

## Dependencies

This module has no dependencies — every other module depends on it. Changes
here are the highest-blast-radius change in the system and should be
reviewed accordingly.

## Phase 9 addendum — paper, crop, grid settings

Per [phase-9](../phases/phase-9-drawing-grid-overhaul.md) and
[`Grid-Feature-Spec.md`](Grid-Feature-Spec.md) §3:

- `Reference` gains `paper`, `crop`, `gridSettings` (each nullable, default
  `null`, so rows saved earlier keep parsing). `Paper` is preset + orientation
  + `widthMm/heightMm`; `Crop` is `{x, y, w, h}` in pixels of the oriented
  original (aspect always `widthMm / heightMm`); `GridSettings` is per the spec
  (`cellMm`, overlay toggles, `radialStepDeg`, per-axis label scheme, one shared
  `style {color, widthPx, opacity 0–1}`, `marginMm: 0`).
- `Preset` gains optional `gridSettings`; `User` gains optional
  `defaultGridSettings`. The legacy `gridConfig` / `defaultGridConfig` fields
  remain for back-compat; `Reference.gridConfig` is ignored by new clients once
  `paper` is set. `secondaryGridConfig` continues to hold the layered guide.
- `Display {dpi, screen}` is **device-local** (`localStorage`), not part of any
  synced entity.
- Sync merge groups: `paper` + `crop` merge together as one **framing** group
  (crop's aspect depends on paper); `gridSettings` is its own group.
- Supabase migration `0002`: nullable `jsonb` columns
  `references.paper|crop|grid_settings`, `presets.grid_settings`,
  `profiles.default_grid_settings`. No backfill: legacy references are migrated
  lazily on load.
