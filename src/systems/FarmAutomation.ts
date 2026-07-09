import type { FarmTile } from '../types/game';

export type FarmCandidate = {
  tileX: number;
  tileY: number;
  farm?: FarmTile;
};

export const selectFarmTask = (candidates: FarmCandidate[]): FarmCandidate | undefined =>
  candidates.find(({ farm }) => farm?.mature) ??
  candidates.find(({ farm }) => farm?.planted && !farm.watered) ??
  candidates.find(({ farm }) => farm?.tilled && !farm.planted) ??
  candidates.find(({ farm }) => !farm);
