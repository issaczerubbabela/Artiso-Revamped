import type { ExportSettings, GridConfig, Operation, Preset } from '@artiso/shared-types';
import {
  LOCAL_OWNER_ID,
  createPreset as createLocalPreset,
  deletePreset as deleteLocalPreset,
  syncDeletePreset,
  syncPreset,
  updatePreset as updateLocalPreset,
} from '@artiso/api-client';
import { useAuthStore } from '@/state/auth-store';

// Same "local write always wins, push only when signed in" pattern as
// project-actions.ts.
export async function createPresetAction(input: {
  name: string;
  gridConfig: GridConfig;
  filterStack: Operation[];
  exportSettings: ExportSettings;
}): Promise<Preset> {
  const user = useAuthStore.getState().user;
  const preset = await createLocalPreset({ ownerId: user?.id ?? LOCAL_OWNER_ID, ...input });
  if (user) void syncPreset(preset).catch(() => {});
  return preset;
}

export async function renamePresetAction(id: string, name: string): Promise<Preset> {
  const updated = await updateLocalPreset(id, { name });
  if (useAuthStore.getState().user) void syncPreset(updated).catch(() => {});
  return updated;
}

export async function deletePresetAction(id: string): Promise<void> {
  const wasSignedIn = Boolean(useAuthStore.getState().user);
  await deleteLocalPreset(id);
  if (wasSignedIn) void syncDeletePreset(id).catch(() => {});
}
