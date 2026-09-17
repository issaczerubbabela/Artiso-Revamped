import { _resetDbForTests } from '../db';

export async function resetTestDatabase(): Promise<void> {
  await _resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('artiso');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
