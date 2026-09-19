import { z } from 'zod';
import {
  ExportSettingsSchema,
  GridConfigSchema,
  GridSettingsSchema,
  OperationSchema,
  type Preset,
} from '@artiso/shared-types';
import { getSupabaseClient } from '../supabase-client';

const FilterStackSchema = z.array(OperationSchema);

interface PresetRow {
  id: string;
  owner_id: string;
  name: string;
  grid_config: unknown;
  // Null/absent for presets saved before the drawing-grid overhaul.
  grid_settings?: unknown | null;
  filter_stack: unknown;
  export_settings: unknown;
  created_at: string;
}

export async function syncPreset(preset: Preset): Promise<void> {
  const row: PresetRow = {
    id: preset.id,
    owner_id: preset.ownerId,
    name: preset.name,
    grid_config: preset.gridConfig,
    grid_settings: preset.gridSettings ?? null,
    filter_stack: preset.filterStack,
    export_settings: preset.exportSettings,
    created_at: preset.createdAt,
  };
  const { error } = await getSupabaseClient().from('presets').upsert(row);
  if (error) throw new Error(error.message);
}

export async function syncDeletePreset(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('presets').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function pullPresets(ownerId: string): Promise<Preset[]> {
  const { data, error } = await getSupabaseClient().from('presets').select('*').eq('owner_id', ownerId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as PresetRow[]).map(rowToPreset);
}

function rowToPreset(row: PresetRow): Preset {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    gridConfig: GridConfigSchema.parse(row.grid_config),
    ...(row.grid_settings ? { gridSettings: GridSettingsSchema.parse(row.grid_settings) } : {}),
    filterStack: FilterStackSchema.parse(row.filter_stack),
    exportSettings: ExportSettingsSchema.parse(row.export_settings),
    createdAt: row.created_at,
  };
}
