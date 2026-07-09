import type { BuildingKind, Inventory } from '../types/game';

export type BuildingRecipe = {
  kind: BuildingKind;
  name: string;
  description: string;
  cost: Partial<Pick<Inventory, 'wood' | 'stone' | 'crops' | 'cores'>>;
  footprint: { width: number; height: number };
};

export const BUILDING_RECIPES: Record<BuildingKind, BuildingRecipe> = {
  farmHut: {
    kind: 'farmHut',
    name: 'Auto Farm Hut',
    description: 'Adds a worker who tills, plants, waters, and harvests nearby.',
    cost: { wood: 8, stone: 4, crops: 2 },
    footprint: { width: 3, height: 3 }
  },
  campfire: {
    kind: 'campfire',
    name: 'Campfire',
    description: 'Restores energy quickly while you stand nearby.',
    cost: { wood: 4, stone: 3 },
    footprint: { width: 1, height: 1 }
  },
  workshop: {
    kind: 'workshop',
    name: 'Workshop',
    description: 'Upgrades tools and doubles the speed of farm workers.',
    cost: { wood: 12, stone: 10, crops: 4 },
    footprint: { width: 3, height: 3 }
  },
  waterCollector: {
    kind: 'waterCollector',
    name: 'Water Collector',
    description: 'Stores clean water over time. Drink it to restore thirst.',
    cost: { wood: 10, stone: 8, crops: 2 },
    footprint: { width: 3, height: 3 }
  },
  watchtower: {
    kind: 'watchtower',
    name: 'Watchtower',
    description: 'Automatically attacks slimes during increasingly dangerous raids.',
    cost: { wood: 18, stone: 14, cores: 3 },
    footprint: { width: 3, height: 3 }
  },
  greenhouse: {
    kind: 'greenhouse',
    name: 'Greenhouse',
    description: 'Produces crops and seeds continuously through every day and night.',
    cost: { wood: 16, stone: 10, crops: 12, cores: 2 },
    footprint: { width: 3, height: 3 }
  }
};

export const canAfford = (inventory: Inventory, recipe: BuildingRecipe): boolean =>
  Object.entries(recipe.cost).every(
    ([resource, amount]) => inventory[resource as keyof Inventory] >= (amount ?? 0)
  );
