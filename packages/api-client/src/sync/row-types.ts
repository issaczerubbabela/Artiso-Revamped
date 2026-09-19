// snake_case row shapes matching supabase/migrations/0001_phase2_schema.sql,
// kept separate from the camelCase shared-types schemas the rest of the app
// uses -- these mapper types exist only at the sync boundary.

export interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  tags: string[];
  thumbnail_asset_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetRow {
  id: string;
  owner_id: string;
  storage_key: string;
  content_hash: string;
  width: number;
  height: number;
  size_bytes: number;
  created_at: string;
}

export interface ReferenceRow {
  id: string;
  project_id: string;
  original_asset_id: string;
  edit_stack: unknown;
  grid_config: unknown;
  secondary_grid_config: unknown | null;
  annotations: unknown;
  removed_annotation_ids: unknown;
  notes: string;
  created_at: string;
  updated_at: string;
  version: number;
}
