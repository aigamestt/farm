export type ToolId = 'hoe' | 'water' | 'axe' | 'pickaxe' | 'seed';

export type Inventory = {
  wood: number;
  stone: number;
  seeds: number;
  crops: number;
  berries: number;
  cores: number;
  water: number;
};

export type FarmTile = {
  tilled: boolean;
  watered: boolean;
  planted: boolean;
  growth: number;
  mature: boolean;
};

export type WorldObjectKind = 'tree' | 'rock' | 'berry';

export type WorldObject = {
  id: string;
  kind: WorldObjectKind;
  tileX: number;
  tileY: number;
  sprite: Phaser.GameObjects.Sprite;
  hp: number;
};

export type Enemy = {
  id: string;
  sprite: Phaser.GameObjects.Sprite;
  speed: number;
  hp: number;
};

export type BuildingKind =
  | 'farmHut'
  | 'campfire'
  | 'workshop'
  | 'waterCollector'
  | 'watchtower'
  | 'greenhouse';

export type SavedBuilding = {
  id: string;
  kind: BuildingKind;
  tileX: number;
  tileY: number;
};

export type Building = SavedBuilding & {
  sprite: Phaser.GameObjects.Sprite;
  worker?: Phaser.GameObjects.Sprite;
  lastAction: number;
};

export type SaveData = {
  version: 1;
  player: { x: number; y: number };
  inventory: Inventory;
  hunger: number;
  energy: number;
  health?: number;
  thirst?: number;
  temperature?: number;
  day: number;
  dayTimer: number;
  selectedTool: ToolId;
  farmTiles: Array<[string, FarmTile]>;
  removedObjectIds: string[];
  defeatedEnemyIds: string[];
  won: boolean;
  buildings?: SavedBuilding[];
};
