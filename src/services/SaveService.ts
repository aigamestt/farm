import type { SaveData } from '../types/game';

const SAVE_KEY = 'moss-and-moon-save-v1';

export class SaveService {
  static load(): SaveData | undefined {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return undefined;
      const save = JSON.parse(raw) as SaveData;
      return save.version === 1 ? save : undefined;
    } catch {
      this.clear();
      return undefined;
    }
  }

  static save(data: SaveData): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // Storage can be unavailable in private or restricted browser contexts.
    }
  }

  static clear(): void {
    localStorage.removeItem(SAVE_KEY);
  }
}
