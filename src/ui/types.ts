import type { BuildingKind, Inventory, ToolId } from '../types/game';

export type GameUiState = {
  day: number;
  timeLabel: string;
  hunger: number;
  energy: number;
  health: number;
  thirst: number;
  temperature: number;
  weather: string;
  inventory: Inventory;
  selectedTool: ToolId;
  prompt: string;
  won: boolean;
  collapsed: boolean;
  canBuild: boolean;
  placementMode?: BuildingKind;
  buildings: Record<BuildingKind, number>;
  objectiveTitle: string;
  objectiveProgress: string;
  unlockedBuildings: BuildingKind[];
  raidSize: number;
};
