import Phaser from 'phaser';
import {
  DAY_LENGTH_SECONDS,
  INTERACT_RANGE,
  MAX_ENERGY,
  MAX_HUNGER,
  PLAYER_SPEED,
  TILE_SIZE,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from '../config/game';
import { TOOL_LABELS, TOOL_ORDER } from '../config/tools';
import { BUILDING_RECIPES, canAfford } from '../config/recipes';
import { SaveService } from '../services/SaveService';
import { selectFarmTask, type FarmCandidate } from '../systems/FarmAutomation';
import type {
  Building,
  BuildingKind,
  Enemy,
  FarmTile,
  Inventory,
  SaveData,
  ToolId,
  WorldObject
} from '../types/game';
import type { GameUiState } from '../ui/types';

type Keys = Phaser.Types.Input.Keyboard.CursorKeys & {
  W: Phaser.Input.Keyboard.Key;
  A: Phaser.Input.Keyboard.Key;
  S: Phaser.Input.Keyboard.Key;
  D: Phaser.Input.Keyboard.Key;
  SPACE: Phaser.Input.Keyboard.Key;
  E: Phaser.Input.Keyboard.Key;
  R: Phaser.Input.Keyboard.Key;
  C: Phaser.Input.Keyboard.Key;
  Q: Phaser.Input.Keyboard.Key;
  ONE: Phaser.Input.Keyboard.Key;
  TWO: Phaser.Input.Keyboard.Key;
  THREE: Phaser.Input.Keyboard.Key;
  FOUR: Phaser.Input.Keyboard.Key;
  FIVE: Phaser.Input.Keyboard.Key;
  ENTER: Phaser.Input.Keyboard.Key;
  H: Phaser.Input.Keyboard.Key;
  ESC: Phaser.Input.Keyboard.Key;
};

export class GameScene extends Phaser.Scene {
  private keys!: Keys;
  private player!: Phaser.GameObjects.Sprite;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private worldLayer!: Phaser.GameObjects.Container;
  private objectLayer!: Phaser.GameObjects.Container;
  private cropLayer!: Phaser.GameObjects.Container;
  private hudLayer!: Phaser.GameObjects.Container;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private dayText!: Phaser.GameObjects.Text;
  private hungerBar!: Phaser.GameObjects.Rectangle;
  private energyBar!: Phaser.GameObjects.Rectangle;
  private hungerText!: Phaser.GameObjects.Text;
  private energyText!: Phaser.GameObjects.Text;
  private inventoryText!: Phaser.GameObjects.Text;
  private toolSlots: Phaser.GameObjects.Container[] = [];
  private promptText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private guideLayer!: Phaser.GameObjects.Container;
  private guideVisible = true;
  private hasStarted = false;
  private farmTiles = new Map<string, FarmTile>();
  private farmVisuals = new Map<string, Phaser.GameObjects.GameObject[]>();
  private objects: WorldObject[] = [];
  private objectBlueprints: Array<Pick<WorldObject, 'id' | 'kind' | 'tileX' | 'tileY'>> = [];
  private enemies: Enemy[] = [];
  private inventory: Inventory = {
    wood: 0,
    stone: 0,
    seeds: 8,
    crops: 0,
    berries: 3,
    cores: 0,
    water: 2
  };
  private selectedTool: ToolId = 'hoe';
  private hunger = MAX_HUNGER;
  private energy = MAX_ENERGY;
  private health = 100;
  private thirst = 100;
  private temperature = 100;
  private day = 1;
  private dayTimer = 0;
  private collapsed = false;
  private lastFarmTick = 0;
  private lastEnemyHit = 0;
  private touchDirection = new Phaser.Math.Vector2();
  private actionQueued = false;
  private eatQueued = false;
  private buildQueued = false;
  private drinkQueued = false;
  private actionAnimating = false;
  private isMoving = false;
  private removedObjectIds = new Set<string>();
  private defeatedEnemyIds = new Set<string>();
  private won = false;
  private loadedPlayerPosition?: { x: number; y: number };
  private objectiveText!: Phaser.GameObjects.Text;
  private statusPanel!: Phaser.GameObjects.Rectangle;
  private inventoryPanel!: Phaser.GameObjects.Rectangle;
  private inventoryTitle!: Phaser.GameObjects.Text;
  private toolPanel!: Phaser.GameObjects.Rectangle;
  private helpText!: Phaser.GameObjects.Text;
  private guideShade!: Phaser.GameObjects.Rectangle;
  private resizeWorldOverlay = (gameSize: Phaser.Structs.Size): void => {
    this.nightOverlay.setSize(gameSize.width, gameSize.height);
    this.fitWorldToViewport(gameSize.width, gameSize.height);
  };
  private buildings: Building[] = [];
  private placementMode?: BuildingKind;
  private loadedBuildings: SaveData['buildings'] = [];
  private buildingCounter = 0;
  private nightWaveStarted = false;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.loadGame();
    window.dispatchEvent(new CustomEvent('game-status', { detail: { message: '', visible: false } }));
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH * TILE_SIZE, WORLD_HEIGHT * TILE_SIZE);
    this.worldLayer = this.add.container();
    this.cropLayer = this.add.container();
    this.objectLayer = this.add.container();

    this.createWorld();
    this.farmTiles.forEach((farm, key) => {
      const [tileX, tileY] = key.split(',').map(Number);
      this.drawFarmTile(tileX, tileY, farm);
    });
    this.createObjects();
    this.createPlayer();
    this.createEnemies();
    this.createBuildings();
    this.createWorldOverlay();
    this.createInput();
    this.createTouchInput();
    this.setGuideVisible(this.guideVisible);
    this.time.addEvent({ delay: 5000, loop: true, callback: () => this.saveGame() });
    window.addEventListener('beforeunload', this.saveGame);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('beforeunload', this.saveGame);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.resizeWorldOverlay);
    });
  }

  update(time: number, delta: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC) && this.placementMode) {
      this.placementMode = undefined;
      this.updateHud();
    } else if (
      Phaser.Input.Keyboard.JustDown(this.keys.H) ||
      Phaser.Input.Keyboard.JustDown(this.keys.ESC)
    ) {
      this.setGuideVisible(!this.guideVisible);
    }
    if (this.guideVisible) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.ENTER) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
        this.hasStarted = true;
        this.setGuideVisible(false);
      }
      return;
    }
    if (this.collapsed) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.R)) {
        SaveService.clear();
        this.scene.restart();
      }
      return;
    }

    this.handleToolSelection();
    this.handleMovement(delta);
    this.updateSurvival(delta);
    this.updateFarming(time);
    this.updateEnemies(delta, time);
    this.updateBuildings(time, delta);
    this.handleActions();
    this.updateHud();
  }

  private createWorld(): void {
    for (let y = 0; y < WORLD_HEIGHT; y += 1) {
      for (let x = 0; x < WORLD_WIDTH; x += 1) {
        const tile = this.add.image(x * TILE_SIZE, y * TILE_SIZE, 'grass').setOrigin(0);
        this.worldLayer.add(tile);
      }
    }
  }

  private createObjects(): void {
    const occupied = new Set<string>();
    const placements = [
      ...this.scatter('tree', 20, 2, occupied),
      ...this.scatter('rock', 14, 3, occupied),
      ...this.scatter('berry', 10, 4, occupied)
    ];

    this.objectBlueprints = placements.map((object, index) => ({
      id: `${object.kind}-${index}`,
      kind: object.kind,
      tileX: object.tileX,
      tileY: object.tileY
    }));
    this.objectBlueprints.forEach((object) => {
      if (this.removedObjectIds.has(object.id)) return;
      this.spawnResource(object);
    });
  }

  private spawnResource(
    object: Pick<WorldObject, 'id' | 'kind' | 'tileX' | 'tileY'>
  ): void {
    const sprite = this.add
        .sprite(object.tileX * TILE_SIZE + 16, object.tileY * TILE_SIZE + 29, object.kind)
        .setOrigin(0.5, 0.9)
        .setDepth(object.tileY * TILE_SIZE + 29)
        .setScale(object.kind === 'tree' ? 0.64 : object.kind === 'rock' ? 0.35 : 0.4);
    const shadow = this.add
        .ellipse(sprite.x, sprite.y - 3, object.kind === 'tree' ? 52 : 38, 13, 0x183322, 0.25)
        .setDepth(sprite.depth - 1);
    sprite.setData('shadow', shadow);
    this.objects.push({
      id: object.id,
      kind: object.kind,
      tileX: object.tileX,
      tileY: object.tileY,
      sprite,
      hp: object.kind === 'tree' ? 3 : object.kind === 'rock' ? 4 : 1
    });
  }

  private scatter(
    kind: WorldObject['kind'],
    count: number,
    seed: number,
    occupiedTiles: Set<string>
  ): WorldObject[] {
    const objects: WorldObject[] = [];
    let cursor = seed * 17;
    while (objects.length < count) {
      cursor += 11;
      const tileX = 2 + ((cursor * 7) % (WORLD_WIDTH - 4));
      const tileY = 2 + ((cursor * 13) % (WORLD_HEIGHT - 4));
      const nearCamp = Math.abs(tileX - 18) < 4 && Math.abs(tileY - 12) < 4;
      const crowded = [...occupiedTiles].some((key) => {
        const [occupiedX, occupiedY] = key.split(',').map(Number);
        return Math.abs(tileX - occupiedX) + Math.abs(tileY - occupiedY) < 2;
      });
      if (!nearCamp && !crowded) {
        occupiedTiles.add(this.tileKey(tileX, tileY));
        objects.push({
          id: '',
          kind,
          tileX,
          tileY,
          sprite: undefined as unknown as Phaser.GameObjects.Sprite,
          hp: 1
        });
      }
    }
    return objects;
  }

  private createPlayer(): void {
    this.anims.create({
      key: 'player-walk',
      frames: Array.from({ length: 8 }, (_, index) => ({ key: `playerWalk${index}` })),
      frameRate: 16,
      repeat: -1
    });
    const playerX = this.loadedPlayerPosition?.x ?? 18 * TILE_SIZE;
    const playerY = this.loadedPlayerPosition?.y ?? 12 * TILE_SIZE;
    this.playerShadow = this.add.ellipse(playerX, playerY, 30, 9, 0x183322, 0.28);
    this.player = this.add
      .sprite(
        playerX,
        playerY,
        'playerWalk0'
      )
      .setOrigin(0.5, 0.86)
      .setDepth(12 * TILE_SIZE)
      .setScale(0.5);
    this.playerShadow.setDepth(this.player.depth - 1);
    this.cameras.main.startFollow(this.player, true, 0.28, 0.28);
  }

  private createEnemies(): void {
    if (this.isNight()) this.spawnNightWave();
  }

  private spawnNightWave(): void {
    const count = this.getRaidSize();
    for (let index = 0; index < count; index += 1) {
      const side = index % 4;
      const tileX = side === 0 ? 1 : side === 1 ? WORLD_WIDTH - 2 : 2 + ((index * 7) % (WORLD_WIDTH - 4));
      const tileY = side === 2 ? 1 : side === 3 ? WORLD_HEIGHT - 2 : 2 + ((index * 5) % (WORLD_HEIGHT - 4));
      const id = `raid-${this.day}-${index}`;
      const sprite = this.add
        .sprite(tileX * TILE_SIZE, tileY * TILE_SIZE, 'slime')
        .setDepth(tileY * TILE_SIZE)
        .setScale(0.32)
        .setAlpha(1);
      this.enemies.push({ id, sprite, speed: 46 + this.day * 2, hp: 3 + Math.floor(this.day / 4) });
    }
    this.nightWaveStarted = true;
  }

  private getRaidSize(): number {
    return Math.min(18, 3 + this.day);
  }

  private createBuildings(): void {
    this.loadedBuildings?.forEach((saved) => this.spawnBuilding(saved));
    this.buildingCounter = this.buildings.length;
  }

  private spawnBuilding(saved: NonNullable<SaveData['buildings']>[number]): Building {
    const recipe = BUILDING_RECIPES[saved.kind];
    const x = saved.tileX * TILE_SIZE + 16;
    const y = (saved.tileY + Math.floor(recipe.footprint.height / 2) + 1) * TILE_SIZE - 3;
    const sprite = this.add
      .sprite(x, y, saved.kind)
      .setOrigin(0.5, 0.9)
      .setDepth(y)
      .setScale(saved.kind === 'campfire' ? 0.5 : 0.92);
    const building: Building = { ...saved, sprite, lastAction: 0 };
    if (saved.kind === 'farmHut') {
      building.worker = this.add
        .sprite(x + 42, y, 'playerWalk0')
        .setOrigin(0.5, 0.86)
        .setScale(0.42)
        .setDepth(y + 1);
    }
    this.buildings.push(building);
    this.clearBuildingFootprint(building);
    return building;
  }

  private clearBuildingFootprint(building: Building): void {
    const coveredObjects = this.objects.filter((object) =>
      this.buildingAt(object.tileX, object.tileY)
    );
    coveredObjects.forEach((object) => {
      this.removedObjectIds.add(object.id);
      (object.sprite.getData('shadow') as Phaser.GameObjects.GameObject | undefined)?.destroy();
      object.sprite.destroy();
    });
    this.objects = this.objects.filter((object) => !coveredObjects.includes(object));

    [...this.farmTiles.keys()].forEach((key) => {
      const [tileX, tileY] = key.split(',').map(Number);
      if (!this.buildingAt(tileX, tileY)) return;
      this.farmVisuals.get(key)?.forEach((visual) => visual.destroy());
      this.farmVisuals.delete(key);
      this.farmTiles.delete(key);
    });
  }

  private createWorldOverlay(): void {
    this.nightOverlay = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x020617, 0)
      .setOrigin(0)
      .setDepth(2000)
      .setScrollFactor(0);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeWorldOverlay);
    this.fitWorldToViewport(this.scale.width, this.scale.height);
  }

  private fitWorldToViewport(width: number, height: number): void {
    const worldWidth = WORLD_WIDTH * TILE_SIZE;
    const worldHeight = WORLD_HEIGHT * TILE_SIZE;
    this.cameras.main.setZoom(Math.max(1, width / worldWidth, height / worldHeight));
  }

  private createHud(): void {
    this.statusPanel = this.panel(16, 16, 248, 108);
    this.dayText = this.add.text(30, 28, '', {
      color: '#fff7d6',
      fontSize: '16px',
      fontStyle: 'bold'
    });
    this.hungerBar = this.add.rectangle(112, 64, 128, 10, 0xe98246).setOrigin(0, 0.5);
    this.energyBar = this.add.rectangle(112, 94, 128, 10, 0x7fcf72).setOrigin(0, 0.5);
    this.hungerText = this.add.text(30, 56, '', { color: '#f8fafc', fontSize: '13px' });
    this.energyText = this.add.text(30, 86, '', { color: '#f8fafc', fontSize: '13px' });

    this.inventoryPanel = this.panel(696, 16, 248, 108);
    this.inventoryTitle = this.add.text(712, 28, 'BACKPACK', {
      color: '#a7d8c2',
      fontSize: '12px',
      fontStyle: 'bold'
    });
    this.inventoryText = this.add.text(712, 52, '', {
      color: '#f8fafc',
      fontSize: '14px',
      lineSpacing: 8
    });
    this.objectiveText = this.add.text(30, 138, '', {
      color: '#fff7d6',
      fontSize: '12px',
      lineSpacing: 5,
      backgroundColor: '#17212be8',
      padding: { x: 10, y: 8 }
    });

    this.toolPanel = this.panel(252, 550, 456, 74);
    TOOL_ORDER.forEach((tool, index) => {
      const slot = this.add.container(270 + index * 86, 560);
      const box = this.add.rectangle(0, 0, 76, 52, 0x213547, 0.96).setOrigin(0);
      box.setStrokeStyle(2, 0x506477);
      box.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.selectedTool = tool;
      });
      const number = this.add.text(7, 5, String(index + 1), { color: '#9fb3c8', fontSize: '11px' });
      const label = this.add
        .text(38, 29, TOOL_LABELS[tool].replace('Watering Can', 'Water'), {
          color: '#f8fafc',
          fontSize: '11px',
          align: 'center',
          wordWrap: { width: 64 }
        })
        .setOrigin(0.5);
      slot.add([box, number, label]);
      this.toolSlots.push(slot);
    });

    this.promptText = this.add
      .text(480, 526, '', {
        color: '#fff7d6',
        fontSize: '14px',
        align: 'center',
        backgroundColor: '#17212b',
        padding: { x: 12, y: 7 }
      })
      .setOrigin(0.5);
    this.helpText = this.add.text(922, 606, 'H  HELP', {
      color: '#a7d8c2',
      fontSize: '12px'
    }).setOrigin(1);
    this.statusText = this.add
      .text(480, 300, '', {
        color: '#f8fafc',
        fontSize: '24px',
        align: 'center',
        backgroundColor: '#111827',
        padding: { x: 16, y: 14 }
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.nightOverlay = this.add
      .rectangle(0, 0, 960, 640, 0x020617, 0)
      .setOrigin(0)
      .setDepth(2000)
      .setScrollFactor(0);

    this.hudLayer.add([
      this.statusPanel,
      this.dayText,
      this.hungerBar,
      this.energyBar,
      this.hungerText,
      this.energyText,
      this.inventoryPanel,
      this.inventoryTitle,
      this.inventoryText,
      this.objectiveText,
      this.toolPanel,
      ...this.toolSlots,
      this.promptText,
      this.helpText,
      this.statusText
    ]);
    this.createGuide();
    this.layoutHud(this.scale.gameSize);
  }

  private layoutHud(gameSize: Phaser.Structs.Size): void {
    const width = gameSize.width;
    const height = gameSize.height;
    const inventoryX = Math.max(16, width - 264);
    const toolX = Math.max(8, width / 2 - 228);
    const toolY = height - 90;

    this.inventoryPanel.setPosition(inventoryX, 16);
    this.inventoryTitle.setPosition(inventoryX + 16, 28);
    this.inventoryText.setPosition(inventoryX + 16, 52);
    this.toolPanel.setPosition(toolX, toolY);
    this.toolSlots.forEach((slot, index) => slot.setPosition(toolX + 18 + index * 86, toolY + 10));
    this.promptText.setPosition(width / 2, height - 114);
    this.helpText.setPosition(width - 38, height - 34);
    this.statusText.setPosition(width / 2, height / 2);
    this.nightOverlay.setSize(width, height);

    const guideScale = Math.min(1, width / 960, height / 640);
    const guideX = (width - 960 * guideScale) / 2;
    const guideY = (height - 640 * guideScale) / 2;
    this.guideLayer.setScale(guideScale).setPosition(guideX, guideY);
    this.guideShade
      .setPosition(-guideX / guideScale, -guideY / guideScale)
      .setSize(width / guideScale, height / guideScale);
  }

  private panel(x: number, y: number, width: number, height: number): Phaser.GameObjects.Rectangle {
    const panel = this.add.rectangle(x, y, width, height, 0x17212b, 0.94).setOrigin(0);
    panel.setStrokeStyle(2, 0x3e5668);
    return panel;
  }

  private createGuide(): void {
    const touchDevice = this.sys.game.device.input.touch;
    this.guideLayer = this.add.container().setScrollFactor(0).setDepth(5000);
    this.guideShade = this.add.rectangle(0, 0, 960, 640, 0x091016, 0.9).setOrigin(0);
    const card = this.add.rectangle(480, 320, 720, 520, 0x17212b, 1);
    card.setStrokeStyle(3, 0x7fcf72);
    const title = this.add.text(480, 92, 'MOSS & MOON', {
      color: '#fff1b8',
      fontSize: '34px',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    const subtitle = this.add.text(480, 130, 'A tiny farming survival adventure', {
      color: '#a7d8c2',
      fontSize: '15px'
    }).setOrigin(0.5);
    const objective = this.add.text(
      182,
      168,
      'YOUR MISSION\nBuild a sanctuary to make the valley safe. Farm crops, chop trees,\nmine rocks, and defeat slimes for the materials shown in the goal panel.',
      { color: '#f8fafc', fontSize: '15px', lineSpacing: 8, wordWrap: { width: 596 } }
    );
    const steps = this.add.text(
      182,
      254,
      'HOW TO FARM\n1  Select Hoe, then press SPACE on grass.\n2  Select Seed Pouch and press SPACE on tilled soil.\n3  Select Water and press SPACE on the planted tile.\n4  Wait for the crop to grow, then use Seed Pouch to harvest.',
      { color: '#d7e5dc', fontSize: '14px', lineSpacing: 8, wordWrap: { width: 596 } }
    );
    const controls = this.add.text(
      182,
      390,
      touchDevice
        ? 'MOBILE CONTROLS\nMOVE          Direction pad\nUSE / ATTACK Green Use button\nSELECT TOOL   Tap a tool slot\nEAT / BUILD  Action buttons'
        : 'CONTROLS\nMOVE          WASD / ARROWS\nUSE / ATTACK SPACE\nSELECT TOOL   1  2  3  4  5\nEAT FOOD      E\nBUILD         C',
      { color: '#f8fafc', fontSize: '14px', lineSpacing: 7 }
    );
    const tips = this.add.text(
      520,
      390,
      'SURVIVAL NOTES\nStand still to regain energy\nFood restores hunger + energy\nAxe chops trees\nPickaxe mines rocks',
      { color: '#f6cf76', fontSize: '14px', lineSpacing: 7 }
    );
    const start = this.add.text(480, 548, touchDevice ? 'TAP USE TO BEGIN' : 'PRESS ENTER OR SPACE TO BEGIN', {
      color: '#0d1a16',
      backgroundColor: '#7fcf72',
      fontSize: '16px',
      fontStyle: 'bold',
      padding: { x: 20, y: 11 }
    }).setOrigin(0.5);
    this.tweens.add({ targets: start, alpha: 0.65, duration: 750, yoyo: true, repeat: -1 });
    this.guideLayer.add([this.guideShade, card, title, subtitle, objective, steps, controls, tips, start]);
    this.guideLayer.setVisible(this.guideVisible);
  }

  private setGuideVisible(visible: boolean): void {
    if (!this.hasStarted && !visible) {
      return;
    }
    this.guideVisible = visible;
    window.dispatchEvent(new CustomEvent('game-guide', { detail: visible }));
  }

  private createInput(): void {
    this.keys = this.input.keyboard!.addKeys({
      ...this.input.keyboard!.createCursorKeys(),
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
      E: Phaser.Input.Keyboard.KeyCodes.E,
      R: Phaser.Input.Keyboard.KeyCodes.R,
      C: Phaser.Input.Keyboard.KeyCodes.C,
      Q: Phaser.Input.Keyboard.KeyCodes.Q,
      ONE: Phaser.Input.Keyboard.KeyCodes.ONE,
      TWO: Phaser.Input.Keyboard.KeyCodes.TWO,
      THREE: Phaser.Input.Keyboard.KeyCodes.THREE,
      FOUR: Phaser.Input.Keyboard.KeyCodes.FOUR,
      FIVE: Phaser.Input.Keyboard.KeyCodes.FIVE,
      ENTER: Phaser.Input.Keyboard.KeyCodes.ENTER,
      H: Phaser.Input.Keyboard.KeyCodes.H,
      ESC: Phaser.Input.Keyboard.KeyCodes.ESC
    }) as Keys;
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.placementMode || this.guideVisible) return;
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.placeBuilding(Math.floor(worldPoint.x / TILE_SIZE), Math.floor(worldPoint.y / TILE_SIZE));
    });
  }

  private createTouchInput(): void {
    const joystickHandler = (event: Event) => {
      const direction = (event as CustomEvent<{ x: number; y: number }>).detail;
      this.touchDirection.set(direction.x, direction.y);
    };
    const actionHandler = (event: Event) => {
      const action = (event as CustomEvent<string>).detail;
      if (this.guideVisible) {
        this.hasStarted = true;
        this.setGuideVisible(false);
      } else if (action === 'use') {
        this.actionQueued = true;
      } else if (action === 'eat') {
        this.eatQueued = true;
      } else if (action === 'build') {
        this.buildQueued = true;
      } else if (action === 'drink') {
        this.drinkQueued = true;
      } else if (action === 'restart') {
        SaveService.clear();
        this.scene.restart();
      }
    };
    const toolHandler = (event: Event) => {
      this.selectedTool = (event as CustomEvent<ToolId>).detail;
    };
    const guideHandler = () => this.setGuideVisible(!this.guideVisible);
    const craftHandler = (event: Event) => {
      this.placementMode = (event as CustomEvent<BuildingKind | undefined>).detail;
      this.updateHud();
    };
    window.addEventListener('game-joystick', joystickHandler);
    window.addEventListener('game-action', actionHandler);
    window.addEventListener('game-tool', toolHandler);
    window.addEventListener('game-guide-toggle', guideHandler);
    window.addEventListener('game-craft', craftHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('game-joystick', joystickHandler);
      window.removeEventListener('game-action', actionHandler);
      window.removeEventListener('game-tool', toolHandler);
      window.removeEventListener('game-guide-toggle', guideHandler);
      window.removeEventListener('game-craft', craftHandler);
    });
  }

  private handleToolSelection(): void {
    const bindings = [this.keys.ONE, this.keys.TWO, this.keys.THREE, this.keys.FOUR, this.keys.FIVE];
    bindings.forEach((key, index) => {
      if (Phaser.Input.Keyboard.JustDown(key)) {
        this.selectedTool = TOOL_ORDER[index];
      }
    });
  }

  private handleMovement(delta: number): void {
    const direction = new Phaser.Math.Vector2(0, 0);
    if (this.keys.left.isDown || this.keys.A.isDown) direction.x -= 1;
    if (this.keys.right.isDown || this.keys.D.isDown) direction.x += 1;
    if (this.keys.up.isDown || this.keys.W.isDown) direction.y -= 1;
    if (this.keys.down.isDown || this.keys.S.isDown) direction.y += 1;
    direction.add(this.touchDirection);

    if (direction.lengthSq() > 0) {
      this.isMoving = true;
      const inputStrength = Math.min(1, direction.length());
      direction.normalize();
      const movementMultiplier =
        (this.energy < 20 ? 0.68 : 1) * (this.temperature < 20 ? 0.78 : 1);
      this.player.x = Phaser.Math.Clamp(
        this.player.x +
          direction.x * PLAYER_SPEED * inputStrength * movementMultiplier * (delta / 1000),
        16,
        WORLD_WIDTH * TILE_SIZE - 16
      );
      this.player.y = Phaser.Math.Clamp(
        this.player.y +
          direction.y * PLAYER_SPEED * inputStrength * movementMultiplier * (delta / 1000),
        16,
        WORLD_HEIGHT * TILE_SIZE - 16
      );
      this.player.setDepth(this.player.y);
      this.playerShadow.setPosition(this.player.x, this.player.y - 3).setDepth(this.player.y - 1);
      if (!this.player.anims.isPlaying && !this.actionAnimating) {
        this.player.play('player-walk');
      }
      this.player.setFlipX(direction.x < -0.05);
    } else if (this.player.anims.isPlaying && !this.actionAnimating) {
      this.isMoving = false;
      this.player.stop().setTexture('playerWalk0');
    } else {
      this.isMoving = false;
    }
  }

  private handleActions(): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.Q) || this.drinkQueued) {
      this.drinkQueued = false;
      this.drinkWater();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.C) || this.buildQueued) {
      this.buildQueued = false;
      this.buildSanctuary();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.E) || this.eatQueued) {
      this.eatQueued = false;
      this.eat();
    }
    const wantsAction = Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || this.actionQueued;
    this.actionQueued = false;
    if (!wantsAction || this.energy < 5) {
      return;
    }
    this.animateToolUse();
    if (this.selectedTool === 'axe' && this.attackEnemy()) {
      return;
    }

    const tileX = Math.floor(this.player.x / TILE_SIZE);
    const tileY = Math.floor(this.player.y / TILE_SIZE);
    if (this.selectedTool === 'hoe') {
      this.till(tileX, tileY);
    } else if (this.selectedTool === 'water') {
      this.water(tileX, tileY);
    } else if (this.selectedTool === 'seed') {
      this.plantOrHarvest(tileX, tileY);
    } else {
      this.hitObject();
    }
  }

  private placeBuilding(tileX: number, tileY: number): void {
    const kind = this.placementMode;
    if (!kind) return;
    const recipe = BUILDING_RECIPES[kind];
    if (!this.getUnlockedBuildings().includes(kind)) {
      this.showFloatingText('Complete the current objective first', 0xef9761);
      this.placementMode = undefined;
      return;
    }
    const halfWidth = Math.floor(recipe.footprint.width / 2);
    const halfHeight = Math.floor(recipe.footprint.height / 2);
    const footprintTiles: Array<{ x: number; y: number }> = [];
    for (let y = tileY - halfHeight; y <= tileY + halfHeight; y += 1) {
      for (let x = tileX - halfWidth; x <= tileX + halfWidth; x += 1) {
        footprintTiles.push({ x, y });
      }
    }
    const blocked = footprintTiles.some(
      ({ x, y }) =>
        x < 1 ||
        y < 1 ||
        x >= WORLD_WIDTH - 1 ||
        y >= WORLD_HEIGHT - 1 ||
        Boolean(this.objectAt(x, y)) ||
        this.farmTiles.has(this.tileKey(x, y)) ||
        Boolean(this.buildingAt(x, y))
    );
    if (blocked) {
      this.showFloatingText('Choose clear ground', 0xef9761);
      return;
    }
    if (!canAfford(this.inventory, recipe)) {
      this.showFloatingText('Not enough materials', 0xef9761);
      this.placementMode = undefined;
      return;
    }
    Object.entries(recipe.cost).forEach(([resource, amount]) => {
      this.inventory[resource as keyof Inventory] -= amount ?? 0;
    });
    this.buildingCounter += 1;
    this.spawnBuilding({
      id: `building-${this.buildingCounter}`,
      kind,
      tileX,
      tileY
    });
    this.spawnBurst(tileX * TILE_SIZE + 16, tileY * TILE_SIZE + 16, 0xf1c75b, 14);
    this.showFloatingText(`${recipe.name} built`, 0x8bd17f);
    this.placementMode = undefined;
    this.saveGame();
  }

  private updateBuildings(time: number, delta: number): void {
    this.buildings.forEach((building) => {
      if (building.kind === 'campfire') {
        const distance = Phaser.Math.Distance.Between(
          building.sprite.x,
          building.sprite.y,
          this.player.x,
          this.player.y
        );
        if (distance < 100) {
          this.energy = Math.min(MAX_ENERGY, this.energy + (delta / 1000) * 3.5);
          this.temperature = Math.min(100, this.temperature + (delta / 1000) * 8);
        }
        return;
      }
      if (building.kind === 'watchtower') {
        if (time - building.lastAction < 1100) return;
        const target = this.enemies.find(
          (enemy) =>
            Phaser.Math.Distance.Between(
              building.sprite.x,
              building.sprite.y,
              enemy.sprite.x,
              enemy.sprite.y
            ) < 190
        );
        if (!target) return;
        building.lastAction = time;
        target.hp -= 2;
        this.spawnBurst(target.sprite.x, target.sprite.y, 0xf1c75b, 4);
        if (target.hp <= 0) this.defeatEnemy(target);
        return;
      }
      if (building.kind === 'waterCollector') {
        const collectionDelay = this.getWeather() === 'Rain' ? 5000 : 11000;
        if (time - building.lastAction < collectionDelay || this.inventory.water >= 20) return;
        building.lastAction = time;
        this.inventory.water = Math.min(
          20,
          this.inventory.water + (this.getWeather() === 'Rain' ? 2 : 1)
        );
        this.spawnBurst(building.sprite.x, building.sprite.y - 18, 0x62b9dc, 4);
        this.saveGame();
        return;
      }
      if (building.kind === 'greenhouse') {
        if (time - building.lastAction < 12000) return;
        building.lastAction = time;
        this.inventory.crops += 2;
        this.inventory.seeds += 2;
        this.spawnBurst(building.sprite.x, building.sprite.y - 30, 0x79b85a, 6);
        this.saveGame();
        return;
      }
      if (building.kind !== 'farmHut') return;
      const workerDelay = this.hasWorkshop() ? 900 : 1800;
      if (time - building.lastAction < workerDelay) return;
      building.lastAction = time;
      this.runFarmWorker(building);
    });
  }

  private runFarmWorker(building: Building): void {
    const candidates: FarmCandidate[] = [];
    for (let y = building.tileY - 2; y <= building.tileY + 2; y += 1) {
      for (let x = building.tileX - 2; x <= building.tileX + 2; x += 1) {
        if (
          x < 1 ||
          y < 1 ||
          x >= WORLD_WIDTH - 1 ||
          y >= WORLD_HEIGHT - 1 ||
          this.objectAt(x, y) ||
          this.buildingAt(x, y)
        ) {
          continue;
        }
        candidates.push({ tileX: x, tileY: y, farm: this.farmTiles.get(this.tileKey(x, y)) });
      }
    }
    const target = selectFarmTask(candidates);
    if (!target) return;

    const key = this.tileKey(target.tileX, target.tileY);
    const farm = target.farm ?? {
      tilled: true,
      watered: false,
      planted: false,
      growth: 0,
      mature: false
    };
    if (farm.mature) {
      farm.planted = false;
      farm.mature = false;
      farm.watered = false;
      farm.growth = 0;
      this.inventory.crops += this.hasWorkshop() ? 3 : 2;
      this.inventory.seeds += 2;
    } else {
      if (!farm.planted && this.inventory.seeds === 0) return;
      if (!target.farm) {
        this.farmTiles.set(key, farm);
      }
      if (!farm.planted) {
        farm.planted = true;
        farm.growth = 0;
        this.inventory.seeds -= 1;
      }
      if (!farm.watered) {
        farm.watered = true;
      }
    }
    this.drawFarmTile(target.tileX, target.tileY, farm);
    this.moveWorker(building, target.tileX, target.tileY);
    this.saveGame();
  }

  private moveWorker(building: Building, tileX: number, tileY: number): void {
    if (!building.worker) return;
    const homeX = building.sprite.x + 42;
    const homeY = building.sprite.y;
    this.tweens.killTweensOf(building.worker);
    building.worker.play('player-walk');
    this.tweens.add({
      targets: building.worker,
      x: tileX * TILE_SIZE + 16,
      y: tileY * TILE_SIZE + 22,
      duration: 420,
      yoyo: true,
      hold: 220,
      onYoyo: () => building.worker?.stop().setTexture('playerWalk0'),
      onComplete: () => building.worker?.setPosition(homeX, homeY).setTexture('playerWalk0')
    });
  }

  private till(tileX: number, tileY: number): void {
    if (this.objectAt(tileX, tileY) || this.buildingAt(tileX, tileY)) {
      return;
    }
    const key = this.tileKey(tileX, tileY);
    const farm = this.farmTiles.get(key) ?? {
      tilled: false,
      watered: false,
      planted: false,
      growth: 0,
      mature: false
    };
    if (!farm.tilled) {
      farm.tilled = true;
      this.farmTiles.set(key, farm);
      this.energy -= 4;
      this.drawFarmTile(tileX, tileY, farm);
      this.spawnBurst(tileX * TILE_SIZE + 16, tileY * TILE_SIZE + 16, 0x9a704d);
    }
  }

  private water(tileX: number, tileY: number): void {
    const farm = this.farmTiles.get(this.tileKey(tileX, tileY));
    if (farm?.tilled && !farm.watered) {
      farm.watered = true;
      this.energy -= 3;
      this.drawFarmTile(tileX, tileY, farm);
      this.spawnBurst(tileX * TILE_SIZE + 16, tileY * TILE_SIZE + 16, 0x6db6d8);
    }
  }

  private plantOrHarvest(tileX: number, tileY: number): void {
    const key = this.tileKey(tileX, tileY);
    const farm = this.farmTiles.get(key);
    if (!farm?.tilled) {
      return;
    }
    if (farm.mature) {
      farm.planted = false;
      farm.mature = false;
      farm.growth = 0;
      farm.watered = false;
      this.inventory.crops += 2;
      this.inventory.seeds += 2;
      this.energy -= 2;
      this.drawFarmTile(tileX, tileY, farm);
      this.spawnBurst(tileX * TILE_SIZE + 16, tileY * TILE_SIZE + 16, 0xf1c75b, 9);
      return;
    }
    if (!farm.planted && this.inventory.seeds === 0 && this.inventory.berries > 0) {
      this.inventory.berries -= 1;
      this.inventory.seeds += 2;
      this.showFloatingText('Berry converted into 2 seeds', 0x79b85a);
    }
    if (!farm.planted && this.inventory.seeds > 0) {
      farm.planted = true;
      farm.growth = 0;
      this.inventory.seeds -= 1;
      this.energy -= 2;
      this.drawFarmTile(tileX, tileY, farm);
      this.spawnBurst(tileX * TILE_SIZE + 16, tileY * TILE_SIZE + 16, 0x79b85a, 5);
    }
  }

  private hitObject(): void {
    const object = this.nearestObject();
    if (!object) {
      return;
    }
    if (object.kind === 'tree' && this.selectedTool !== 'axe') {
      return;
    }
    if (object.kind === 'rock' && this.selectedTool !== 'pickaxe') {
      return;
    }
    if (object.kind === 'berry') {
      this.inventory.berries += 2;
      this.removeObject(object);
      this.energy -= 2;
      return;
    }

    object.hp -= this.hasWorkshop() ? 2 : 1;
    object.sprite.setTint(0xffffff);
    this.tweens.add({
      targets: object.sprite,
      x: object.sprite.x + Phaser.Math.Between(-3, 3),
      duration: 45,
      yoyo: true,
      repeat: 2
    });
    this.spawnBurst(object.sprite.x, object.sprite.y, object.kind === 'rock' ? 0xaeb7c2 : 0x9a704d, 4);
    this.time.delayedCall(80, () => object.sprite.clearTint());
    this.energy -= 5;
    this.showFloatingText(
      object.hp > 0 ? `${object.hp} strikes left` : object.kind === 'rock' ? '+2 stone' : '+3 wood',
      object.kind === 'rock' ? 0xaeb7c2 : 0xc39462
    );
    if (object.hp <= 0) {
      if (object.kind === 'tree') {
        this.inventory.wood += 3;
        this.inventory.seeds += 1;
      } else {
        this.inventory.stone += 2;
      }
      this.removeObject(object);
    }
    this.saveGame();
  }

  private attackEnemy(): boolean {
    const enemy = this.nearestEnemy();
    if (!enemy) return false;
    enemy.hp -= this.hasWorkshop() ? 2 : 1;
    this.energy -= 4;
    this.spawnBurst(enemy.sprite.x, enemy.sprite.y, 0xb56de2, 6);
    this.tweens.add({
      targets: enemy.sprite,
      x: enemy.sprite.x + (enemy.sprite.x > this.player.x ? 12 : -12),
      scaleX: 0.5,
      scaleY: 0.34,
      duration: 90,
      yoyo: true
    });
    if (enemy.hp > 0) {
      this.showFloatingText(`Slime: ${enemy.hp}/3`, 0xb56de2);
      return true;
    }
    this.defeatEnemy(enemy);
    return true;
  }

  private defeatEnemy(enemy: Enemy): void {
    this.inventory.cores += 1;
    this.defeatedEnemyIds.add(enemy.id);
    this.enemies = this.enemies.filter((candidate) => candidate.id !== enemy.id);
    this.tweens.killTweensOf(enemy.sprite);
    this.tweens.add({
      targets: enemy.sprite,
      alpha: 0,
      scale: 0.7,
      duration: 180,
      onComplete: () => enemy.sprite.destroy()
    });
    this.showFloatingText('+1 slime core', 0xb56de2);
    this.saveGame();
  }

  private updateSurvival(delta: number): void {
    this.dayTimer += delta / 1000;
    if (this.dayTimer >= DAY_LENGTH_SECONDS) {
      this.day += 1;
      this.dayTimer = 0;
      this.enemies.forEach((enemy) => enemy.sprite.destroy());
      this.enemies = [];
      this.nightWaveStarted = false;
      this.energy = Math.min(MAX_ENERGY, this.energy + 38);
      this.regrowDailyResources();
      this.objects
        .filter((object) => object.kind === 'berry')
        .forEach((object) => object.sprite.setVisible(true));
    }
    this.hunger -= (delta / 1000) * 0.38;
    this.thirst -= (delta / 1000) * 0.52;
    const coldRate = this.isNight() || this.getWeather() === 'Cold snap' ? 0.7 : -0.45;
    this.temperature = Phaser.Math.Clamp(
      this.temperature - (delta / 1000) * coldRate,
      0,
      100
    );
    if (this.getWeather() === 'Rain') {
      this.temperature = Math.max(0, this.temperature - (delta / 1000) * 0.35);
    }
    if (!this.isMoving && !this.actionAnimating && this.hunger > 20 && this.thirst > 20) {
      this.energy = Math.min(MAX_ENERGY, this.energy + (delta / 1000) * 1.5);
    }
    const healthDrain =
      (this.hunger <= 0 ? 0.7 : 0) +
      (this.thirst <= 0 ? 1.4 : 0) +
      (this.temperature < 15 ? 0.8 : 0);
    this.health = Math.min(100, this.health - (delta / 1000) * healthDrain);
    if (this.health <= 0) {
      this.collapse('You collapsed. Press R to restart.');
    }
    if (this.isNight() && !this.nightWaveStarted) this.spawnNightWave();
    const dayProgress = this.dayTimer / DAY_LENGTH_SECONDS;
    const nightAlpha = Phaser.Math.Clamp((dayProgress - 0.58) / 0.2, 0, 1) * 0.38;
    this.nightOverlay.setAlpha(nightAlpha);
  }

  private regrowDailyResources(): void {
    const quotas: Record<WorldObject['kind'], number> = { tree: 2, rock: 2, berry: 4 };
    (Object.keys(quotas) as WorldObject['kind'][]).forEach((kind) => {
      this.objectBlueprints
        .filter(
          (blueprint) =>
            blueprint.kind === kind &&
            this.removedObjectIds.has(blueprint.id) &&
            !this.buildingAt(blueprint.tileX, blueprint.tileY) &&
            !this.farmTiles.has(this.tileKey(blueprint.tileX, blueprint.tileY))
        )
        .slice(0, quotas[kind])
        .forEach((blueprint) => {
          this.removedObjectIds.delete(blueprint.id);
          this.spawnResource(blueprint);
        });
    });
  }

  private updateFarming(time: number): void {
    if (time - this.lastFarmTick < 1000) {
      return;
    }
    this.lastFarmTick = time;
    this.farmTiles.forEach((farm, key) => {
      if (this.getWeather() === 'Rain' && farm.planted) farm.watered = true;
      if (farm.planted && farm.watered && !farm.mature) {
        farm.growth += this.getWeather() === 'Rain' ? 2 : 1;
        if (farm.growth >= 12) {
          farm.mature = true;
        }
        const [tileX, tileY] = key.split(',').map(Number);
        this.drawFarmTile(tileX, tileY, farm);
      }
    });
  }

  private updateEnemies(delta: number, time: number): void {
    const active = this.isNight();
    this.enemies.forEach((enemy) => {
      enemy.sprite.setAlpha(
        Phaser.Math.Linear(enemy.sprite.alpha, active ? 1 : 0.22, Math.min(1, delta / 450))
      );
      if (!active) {
        return;
      }
      const direction = new Phaser.Math.Vector2(this.player.x - enemy.sprite.x, this.player.y - enemy.sprite.y);
      if (direction.lengthSq() > 1) {
        direction.normalize();
        enemy.sprite.x += direction.x * enemy.speed * (delta / 1000);
        enemy.sprite.y += direction.y * enemy.speed * (delta / 1000);
        enemy.sprite.setDepth(enemy.sprite.y);
      }
      if (Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y) < 24) {
        if (time - this.lastEnemyHit > 1200) {
          this.lastEnemyHit = time;
          this.health -= 8 + this.day * 0.7;
          this.cameras.main.shake(130, 0.006);
        }
      }
    });
  }

  private updateHud(): void {
    const objective = this.getObjective();
    const state: GameUiState = {
      day: this.day,
      timeLabel: this.isNight() ? 'Night' : 'Daylight',
      hunger: this.hunger,
      energy: this.energy,
      health: this.health,
      thirst: this.thirst,
      temperature: this.temperature,
      weather: this.getWeather(),
      inventory: { ...this.inventory },
      selectedTool: this.selectedTool,
      prompt: this.nearestPrompt(),
      won: this.won,
      collapsed: this.collapsed,
      canBuild: this.canBuildSanctuary(),
      placementMode: this.placementMode,
      buildings: {
        farmHut: this.buildings.filter((building) => building.kind === 'farmHut').length,
        campfire: this.buildings.filter((building) => building.kind === 'campfire').length,
        workshop: this.buildings.filter((building) => building.kind === 'workshop').length,
        waterCollector: this.buildings.filter(
          (building) => building.kind === 'waterCollector'
        ).length,
        watchtower: this.buildings.filter((building) => building.kind === 'watchtower').length,
        greenhouse: this.buildings.filter((building) => building.kind === 'greenhouse').length
      },
      objectiveTitle: objective.title,
      objectiveProgress: objective.progress,
      unlockedBuildings: this.getUnlockedBuildings(),
      raidSize: this.getRaidSize()
    };
    window.dispatchEvent(new CustomEvent('game-ui-state', { detail: state }));
  }

  private drawFarmTile(tileX: number, tileY: number, farm: FarmTile): void {
    const key = this.tileKey(tileX, tileY);
    this.farmVisuals.get(key)?.forEach((visual) => visual.destroy());
    const baseTexture = farm.watered ? 'watered' : 'tilled';
    const tile = this.add.image(tileX * TILE_SIZE, tileY * TILE_SIZE, baseTexture).setOrigin(0);
    this.worldLayer.add(tile);
    const visuals: Phaser.GameObjects.GameObject[] = [tile];
    if (farm.planted) {
      const crop = this.add
        .sprite(tileX * TILE_SIZE + 16, tileY * TILE_SIZE + 16, farm.mature ? 'cropMature' : 'cropSeed')
        .setOrigin(0.5, 0.82)
        .setDepth(tileY * TILE_SIZE + 20);
      crop.setScale(farm.mature ? 0.34 : 0.2 + farm.growth * 0.008);
      this.tweens.add({
        targets: crop,
        scaleX: crop.scaleX * 1.1,
        scaleY: crop.scaleY * 1.1,
        duration: 180,
        yoyo: true,
        ease: 'Back.out'
      });
      if (farm.mature) {
        this.tweens.add({
          targets: crop,
          angle: { from: -2, to: 2 },
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut'
        });
      }
      visuals.push(crop);
    }
    this.farmVisuals.set(key, visuals);
  }

  private nearestPrompt(): string {
    if (this.placementMode) {
      return `Click or tap clear ground to place ${BUILDING_RECIPES[this.placementMode].name}`;
    }
    if (this.thirst < 25) {
      return this.inventory.water > 0
        ? 'Press Q or Drink to use stored water'
        : 'Build a Water Collector or eat berries for thirst';
    }
    if (this.energy < 5) {
      return 'Stand still to recover energy, or eat food';
    }
    const tileX = Math.floor(this.player.x / TILE_SIZE);
    const tileY = Math.floor(this.player.y / TILE_SIZE);
    const farm = this.farmTiles.get(this.tileKey(tileX, tileY));
    const enemy = this.nearestEnemy();
    const object = this.nearestObject();
    if (enemy) {
      return this.selectedTool === 'axe'
        ? `Attack slime with Axe (${enemy.hp} health remaining)`
        : 'Select Axe to attack this slime';
    }
    if (farm?.mature) {
      return 'Harvest the ripe crop with Seed Pouch';
    }
    if (farm?.tilled && !farm.planted) {
      if (this.inventory.seeds > 0) return 'Plant a seed with Seed Pouch';
      if (this.inventory.berries > 0) return 'Seed Pouch converts 1 berry into 2 seeds';
      return 'Harvest crops or gather berries to obtain more seeds';
    }
    if (farm?.tilled && farm.planted && !farm.watered) {
      return 'Water this crop with Water';
    }
    if (object) {
      if (object.kind === 'tree') return 'Chop this tree with Axe';
      if (object.kind === 'rock') return 'Mine this rock with Pickaxe';
      return 'Gather these berries';
    }
    return 'Use the selected tool here  |  E eats food';
  }

  private nearestObject(): WorldObject | undefined {
    return this.objects.find(
      (object) =>
        Phaser.Math.Distance.Between(object.sprite.x, object.sprite.y, this.player.x, this.player.y) <=
        INTERACT_RANGE
    );
  }

  private nearestEnemy(): Enemy | undefined {
    return this.enemies.find(
      (enemy) =>
        Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y) <= 58
    );
  }

  private objectAt(tileX: number, tileY: number): WorldObject | undefined {
    return this.objects.find((object) => object.tileX === tileX && object.tileY === tileY);
  }

  private buildingAt(tileX: number, tileY: number): Building | undefined {
    return this.buildings.find((building) => {
      const footprint = BUILDING_RECIPES[building.kind].footprint;
      return (
        Math.abs(tileX - building.tileX) <= Math.floor(footprint.width / 2) &&
        Math.abs(tileY - building.tileY) <= Math.floor(footprint.height / 2)
      );
    });
  }

  private removeObject(object: WorldObject): void {
    this.removedObjectIds.add(object.id);
    this.tweens.killTweensOf(object.sprite);
    const shadow = object.sprite.getData('shadow') as Phaser.GameObjects.Ellipse | undefined;
    if (shadow) {
      this.tweens.add({ targets: shadow, alpha: 0, scaleX: 0.4, duration: 180, onComplete: () => shadow.destroy() });
    }
    this.tweens.add({
      targets: object.sprite,
      alpha: 0,
      scaleX: object.sprite.scaleX * 1.25,
      scaleY: 0,
      y: object.sprite.y - 8,
      duration: 220,
      ease: 'Back.in',
      onComplete: () => object.sprite.destroy()
    });
    this.objects = this.objects.filter((candidate) => candidate.id !== object.id);
    this.saveGame();
  }

  private eat(): void {
    if (this.inventory.berries > 0) {
      this.inventory.berries -= 1;
      this.hunger = Math.min(MAX_HUNGER, this.hunger + 16);
      this.thirst = Math.min(100, this.thirst + 8);
      this.health = Math.min(100, this.health + 2);
      this.energy = Math.min(MAX_ENERGY, this.energy + 8);
      this.showFloatingText('+16 hunger  +8 energy', 0xf19b72);
      this.saveGame();
      return;
    }
    if (this.inventory.crops > 0) {
      this.inventory.crops -= 1;
      this.hunger = Math.min(MAX_HUNGER, this.hunger + 28);
      this.thirst = Math.min(100, this.thirst + 3);
      this.health = Math.min(100, this.health + 4);
      this.energy = Math.min(MAX_ENERGY, this.energy + 15);
      this.showFloatingText('+28 hunger  +15 energy', 0xf1c75b);
      this.saveGame();
    }
  }

  private drinkWater(): void {
    if (this.inventory.water <= 0) {
      this.showFloatingText('No stored water', 0x62b9dc);
      return;
    }
    this.inventory.water -= 1;
    this.thirst = Math.min(100, this.thirst + 38);
    this.health = Math.min(100, this.health + 2);
    this.showFloatingText('+38 thirst', 0x62b9dc);
    this.saveGame();
  }

  private canBuildSanctuary(): boolean {
    return (
      !this.won &&
      this.hasWorkshop() &&
      this.buildings.some((building) => building.kind === 'waterCollector') &&
      this.inventory.wood >= 12 &&
      this.inventory.stone >= 8 &&
      this.inventory.crops >= 6 &&
      this.inventory.cores >= 2
    );
  }

  private hasWorkshop(): boolean {
    return this.buildings.some((building) => building.kind === 'workshop');
  }

  private getUnlockedBuildings(): BuildingKind[] {
    const unlocked: BuildingKind[] = ['farmHut', 'campfire'];
    if (this.buildings.some((building) => building.kind === 'farmHut')) {
      unlocked.push('workshop');
    }
    if (this.hasWorkshop()) {
      unlocked.push('waterCollector');
    }
    if (this.won) {
      unlocked.push('watchtower', 'greenhouse');
    }
    return unlocked;
  }

  private getObjective(): { title: string; progress: string } {
    if (!this.buildings.some((building) => building.kind === 'farmHut')) {
      return {
        title: 'Step 1 - Build an Auto Farm Hut',
        progress: `Wood ${this.inventory.wood}/8 | Stone ${this.inventory.stone}/4 | Crops ${this.inventory.crops}/2`
      };
    }
    if (!this.hasWorkshop()) {
      return {
        title: 'Step 2 - Build a Workshop',
        progress: `Wood ${this.inventory.wood}/12 | Stone ${this.inventory.stone}/10 | Crops ${this.inventory.crops}/4`
      };
    }
    if (!this.buildings.some((building) => building.kind === 'waterCollector')) {
      return {
        title: 'Step 3 - Secure Clean Water',
        progress: `Build a Water Collector | Wood ${this.inventory.wood}/10 | Stone ${this.inventory.stone}/8 | Crops ${this.inventory.crops}/2`
      };
    }
    if (!this.won) {
      return {
        title: 'Step 4 - Establish the Sanctuary',
        progress: `Wood ${this.inventory.wood}/12 | Stone ${this.inventory.stone}/8 | Crops ${this.inventory.crops}/6 | Cores ${this.inventory.cores}/2`
      };
    }
    if (!this.buildings.some((building) => building.kind === 'watchtower')) {
      return {
        title: 'Step 5 - Defend Against Growing Raids',
        progress: `Build a Watchtower | Tonight: ${this.getRaidSize()} slimes`
      };
    }
    if (!this.buildings.some((building) => building.kind === 'greenhouse')) {
      return {
        title: 'Step 6 - Secure Renewable Food',
        progress: 'Build a Greenhouse for permanent crop and seed production'
      };
    }
    return {
      title: `Endless Survival - Day ${this.day}`,
      progress: `${this.getRaidSize()} slimes raid tonight | Expand defenses and survive`
    };
  }

  private buildSanctuary(): void {
    if (this.won) return;
    if (!this.canBuildSanctuary()) {
      this.showFloatingText('More materials needed', 0xf1c75b);
      return;
    }
    this.inventory.wood -= 12;
    this.inventory.stone -= 8;
    this.inventory.crops -= 6;
    this.inventory.cores -= 2;
    this.won = true;
    this.spawnBurst(this.player.x, this.player.y - 20, 0xf1c75b, 18);
    this.showFloatingText('Sanctuary established - endless raids unlocked', 0xf1c75b);
    this.saveGame();
  }

  private saveGame = (): void => {
    if (!this.player) return;
    const save: SaveData = {
      version: 1,
      player: { x: this.player.x, y: this.player.y },
      inventory: this.inventory,
      hunger: this.hunger,
      energy: this.energy,
      day: this.day,
      dayTimer: this.dayTimer,
      selectedTool: this.selectedTool,
      farmTiles: [...this.farmTiles.entries()],
      removedObjectIds: [...this.removedObjectIds],
      defeatedEnemyIds: [...this.defeatedEnemyIds],
      won: this.won,
      buildings: this.buildings.map(({ id, kind, tileX, tileY }) => ({ id, kind, tileX, tileY }))
    };
    SaveService.save(save);
  };

  private loadGame(): void {
    const save = SaveService.load();
    if (!save) return;
    this.loadedPlayerPosition = save.player;
    this.inventory = {
      ...save.inventory,
      cores: save.inventory.cores ?? 0,
      water: save.inventory.water ?? 2
    };
    this.hunger = save.hunger;
    this.energy = save.energy;
    this.health = save.health ?? 100;
    this.thirst = save.thirst ?? 100;
    this.temperature = save.temperature ?? 100;
    this.day = save.day;
    this.dayTimer = save.dayTimer;
    this.selectedTool = save.selectedTool;
    this.farmTiles = new Map(save.farmTiles);
    this.removedObjectIds = new Set(save.removedObjectIds);
    this.defeatedEnemyIds = new Set(save.defeatedEnemyIds);
    this.won = save.won;
    this.loadedBuildings = save.buildings ?? [];
    this.hasStarted = true;
    this.guideVisible = false;
  }

  private animateToolUse(): void {
    if (this.actionAnimating) return;
    this.actionAnimating = true;
    this.player.stop();
    this.tweens.add({
      targets: this.player,
      angle: { from: -7, to: 9 },
      scaleX: 0.54,
      scaleY: 0.47,
      duration: 90,
      yoyo: true,
      ease: 'Quad.inOut',
      onComplete: () => {
        this.actionAnimating = false;
        this.player.setScale(0.5).setAngle(0).setTexture('playerWalk0');
      }
    });
  }

  private spawnBurst(x: number, y: number, color: number, count = 6): void {
    for (let index = 0; index < count; index += 1) {
      const mote = this.add.circle(x, y, Phaser.Math.Between(2, 4), color).setDepth(14);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(12, 28);
      this.tweens.add({
        targets: mote,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance - 8,
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(280, 460),
        ease: 'Quad.out',
        onComplete: () => mote.destroy()
      });
    }
  }

  private showFloatingText(message: string, color: number): void {
    const text = this.add
      .text(this.player.x, this.player.y - 38, message, {
        color: `#${color.toString(16).padStart(6, '0')}`,
        fontSize: '12px',
        fontStyle: 'bold',
        backgroundColor: '#17212bcc',
        padding: { x: 6, y: 3 }
      })
      .setOrigin(0.5)
      .setDepth(16);
    this.tweens.add({
      targets: text,
      y: text.y - 24,
      alpha: 0,
      duration: 900,
      ease: 'Quad.out',
      onComplete: () => text.destroy()
    });
  }

  private collapse(message: string): void {
    this.collapsed = true;
    window.dispatchEvent(
      new CustomEvent('game-status', { detail: { message: message.replace('Press R to restart.', ''), visible: true } })
    );
  }

  private isNight(): boolean {
    return this.dayTimer / DAY_LENGTH_SECONDS > 0.68;
  }

  private getWeather(): 'Clear' | 'Rain' | 'Cold snap' {
    if (this.day % 5 === 0) return 'Cold snap';
    if (this.day % 3 === 0) return 'Rain';
    return 'Clear';
  }

  private tileKey(tileX: number, tileY: number): string {
    return `${tileX},${tileY}`;
  }
}
