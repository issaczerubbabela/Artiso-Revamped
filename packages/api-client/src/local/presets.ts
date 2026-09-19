import { PresetSchema, type ExportSettings, type GridConfig, type Operation, type Preset } from '@artiso/shared-types';
import { getDb } from './db';

export interface CreatePresetInput {
  ownerId: string;
  name: string;
  gridConfig: GridConfig;
  filterStack: Operation[];
  exportSettings: ExportSettings;
}

export async function createPreset(input: CreatePresetInput): Promise<Preset> {
  const preset: Preset = {
    id: crypto.randomUUID(),
    ownerId: input.ownerId,
    name: input.name,
    gridConfig: input.gridConfig,
    filterStack: input.filterStack,
    exportSettings: input.exportSettings,
    createdAt: new Date().toISOString(),
  };
  const db = await getDb();
  await db.put('presets', preset);
  return preset;
}

// Same read-side normalization as references.ts: a preset saved before
// gridConfig gained its `type` discriminator has no `type` in IndexedDB, and
// the schema's default only applies when parsing.
function normalizePreset(raw: Preset): Preset {
  const parsed = PresetSchema.safeParse(raw);
  return parsed.success ? parsed.data : raw;
}

export async function listPresets(): Promise<Preset[]> {
  const db = await getDb();
  return (await db.getAll('presets')).map(normalizePreset);
}

export async function getPreset(id: string): Promise<Preset | undefined> {
  const db = await getDb();
  const raw = await db.get('presets', id);
  return raw && normalizePreset(raw);
}

export async function updatePreset(id: string, patch: Partial<Pick<Preset, 'name'>>): Promise<Preset> {
  const db = await getDb();
  const existing = await db.get('presets', id);
  if (!existing) throw new Error(`Preset ${id} not found`);
  const updated: Preset = { ...existing, ...patch };
  await db.put('presets', updated);
  return updated;
}

export async function deletePreset(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('presets', id);
}

// Same "write already-authoritative remote state verbatim" pattern as
// projects.ts's applyRemoteProject / references.ts's applyRemoteReference.
export async function applyRemotePreset(preset: Preset): Promise<void> {
  const db = await getDb();
  await db.put('presets', preset);
}
