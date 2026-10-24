import { migrateLegacySave, parseSave, type Save } from './state';
export const SAVE_KEY = 'sunge.life.v4';
export const PREVIOUS_SAVE_KEY = 'sunge.high-school.v3';
export const LEGACY_SAVE_KEY = 'sunge.high-school.v1';
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
export function readSave(getStorage: () => StoragePort): { save: Save | null; issue: string | null } {
  try {
    const port = getStorage();
    const candidates: [string, 1 | 2 | 3 | 4][] = [[SAVE_KEY, 4], [PREVIOUS_SAVE_KEY, 3], ['sunge.high-school.v2', 2], [LEGACY_SAVE_KEY, 1]];
    for (const [key, version] of candidates) {
      const raw = port.getItem(key);
      if (raw === null) continue;
      const save = version === 4 ? parseSave(raw) : migrateLegacySave(raw, version);
      return { save, issue: save ? null : '上次的进度暂时无法读取，可以重新开始。' };
    }
    return { save: null, issue: null };
  } catch { return { save: null, issue: '浏览器暂时无法读取进度，本次仍可正常游玩。' }; }
}
export function writeSave(save: Save, getStorage: () => StoragePort): boolean {
  try { getStorage().setItem(SAVE_KEY, JSON.stringify(save)); return true; } catch { return false; }
}
