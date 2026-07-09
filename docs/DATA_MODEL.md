# Data Model

## Inventory

```ts
type Inventory = {
  wood: number;
  stone: number;
  seeds: number;
  crops: number;
  berries: number;
  cores: number;
};
```

## Farm Tile

```ts
type FarmTile = {
  tilled: boolean;
  watered: boolean;
  planted: boolean;
  growth: number;
  mature: boolean;
};
```

## World Object

```ts
type WorldObjectKind = 'tree' | 'rock' | 'berry';

type WorldObject = {
  id: string;
  kind: WorldObjectKind;
  tileX: number;
  tileY: number;
  sprite: Phaser.GameObjects.Sprite;
  hp: number;
};
```

## Player Runtime State

```ts
type PlayerStats = {
  hunger: number;
  energy: number;
  day: number;
  timeOfDay: number;
  collapsed: boolean;
};
```
