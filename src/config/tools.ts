import type { ToolId } from '../types/game';

export const TOOL_ORDER: ToolId[] = ['hoe', 'water', 'axe', 'pickaxe', 'seed'];

export const TOOL_LABELS: Record<ToolId, string> = {
  hoe: 'Hoe',
  water: 'Water',
  axe: 'Axe',
  pickaxe: 'Pick',
  seed: 'Seed'
};
