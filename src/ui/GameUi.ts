import { TOOL_LABELS, TOOL_ORDER } from '../config/tools';
import { BUILDING_RECIPES, canAfford } from '../config/recipes';
import type { GameUiState } from './types';

export class GameUi {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.innerHTML = this.template();
    this.bindControls();
    window.addEventListener('game-ui-state', this.onState);
    window.addEventListener('game-guide', this.onGuide);
    window.addEventListener('game-status', this.onStatus);
  }

  private onState = (event: Event): void => {
    const state = (event as CustomEvent<GameUiState>).detail;
    this.text('[data-ui="day"]', `Day ${state.day} · ${state.timeLabel}`);
    this.text('[data-ui="hunger-value"]', `${Math.ceil(state.hunger)}%`);
    this.text('[data-ui="energy-value"]', `${Math.ceil(state.energy)}%`);
    this.text('[data-ui="health-value"]', `${Math.ceil(state.health)}%`);
    this.text('[data-ui="thirst-value"]', `${Math.ceil(state.thirst)}%`);
    this.text('[data-ui="temperature-value"]', `${Math.ceil(state.temperature)}%`);
    this.text('[data-ui="weather"]', state.weather);
    this.width('[data-ui="hunger-bar"]', state.hunger);
    this.width('[data-ui="energy-bar"]', state.energy);
    this.width('[data-ui="health-bar"]', state.health);
    this.width('[data-ui="thirst-bar"]', state.thirst);
    this.width('[data-ui="temperature-bar"]', state.temperature);
    this.progress('[data-ui="health-ring"]', state.health);
    this.progress('[data-ui="hunger-ring"]', state.hunger);
    this.progress('[data-ui="thirst-ring"]', state.thirst);
    this.progress('[data-ui="energy-ring"]', state.energy);
    this.progress('[data-ui="temperature-ring"]', state.temperature);
    this.text('[data-ui="wood"]', String(state.inventory.wood));
    this.text('[data-ui="stone"]', String(state.inventory.stone));
    this.text('[data-ui="seeds"]', String(state.inventory.seeds));
    this.text('[data-ui="crops"]', String(state.inventory.crops));
    this.text('[data-ui="berries"]', String(state.inventory.berries));
    this.text('[data-ui="cores"]', String(state.inventory.cores));
    this.text('[data-ui="water"]', String(state.inventory.water));
    this.text('[data-ui="prompt"]', state.prompt);
    this.text(
      '[data-ui="goal-progress"]',
      state.objectiveProgress
    );
    this.text('[data-ui="goal-title"]', state.objectiveTitle);
    this.root.querySelector('[data-ui="goal"]')?.classList.toggle('ready', state.canBuild);
    this.root.querySelectorAll<HTMLButtonElement>('[data-craft]').forEach((button) => {
      const recipe = BUILDING_RECIPES[button.dataset.craft as keyof typeof BUILDING_RECIPES];
      button.disabled =
        !state.unlockedBuildings.includes(recipe.kind) || !canAfford(state.inventory, recipe);
      button.classList.toggle('selected', state.placementMode === recipe.kind);
    });
    this.text(
      '[data-ui="building-count"]',
      `${state.buildings.farmHut} huts · ${state.buildings.workshop} workshops · ${state.buildings.waterCollector} collectors · ${state.buildings.watchtower} towers · ${state.buildings.greenhouse} greenhouses`
    );
    this.root.querySelectorAll<HTMLElement>('[data-tool]').forEach((element) => {
      element.classList.toggle('selected', element.dataset.tool === state.selectedTool);
    });
  };

  private onGuide = (event: Event): void => {
    const visible = (event as CustomEvent<boolean>).detail;
    this.root.querySelector('[data-ui="guide"]')?.classList.toggle('hidden', !visible);
  };

  private onStatus = (event: Event): void => {
    const detail = (event as CustomEvent<{ message: string; visible: boolean }>).detail;
    const modal = this.root.querySelector<HTMLElement>('[data-ui="status"]');
    if (!modal) return;
    modal.classList.toggle('hidden', !detail.visible);
    this.text('[data-ui="status-message"]', detail.message);
  };

  private bindControls(): void {
    const joystick = this.root.querySelector<HTMLElement>('[data-joystick]');
    const knob = joystick?.querySelector<HTMLElement>('[data-joystick-knob]');
    if (joystick && knob) {
      const updateJoystick = (event: PointerEvent) => {
        const bounds = joystick.getBoundingClientRect();
        const radius = bounds.width * 0.32;
        let x = event.clientX - (bounds.left + bounds.width / 2);
        let y = event.clientY - (bounds.top + bounds.height / 2);
        const distance = Math.hypot(x, y);
        if (distance > radius) {
          x = (x / distance) * radius;
          y = (y / distance) * radius;
        }
        knob.style.transform = `translate(${x}px, ${y}px)`;
        window.dispatchEvent(
          new CustomEvent('game-joystick', { detail: { x: x / radius, y: y / radius } })
        );
      };
      const resetJoystick = () => {
        knob.style.transform = 'translate(0, 0)';
        window.dispatchEvent(new CustomEvent('game-joystick', { detail: { x: 0, y: 0 } }));
      };
      joystick.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        joystick.setPointerCapture(event.pointerId);
        updateJoystick(event);
      });
      joystick.addEventListener('pointermove', (event) => {
        if (joystick.hasPointerCapture(event.pointerId)) updateJoystick(event);
      });
      joystick.addEventListener('pointerup', resetJoystick);
      joystick.addEventListener('pointercancel', resetJoystick);
    }
    this.root.querySelectorAll<HTMLButtonElement>('[data-game-action]').forEach((button) => {
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('game-action', { detail: button.dataset.gameAction }));
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => {
      button.addEventListener('pointerdown', () => {
        window.dispatchEvent(new CustomEvent('game-tool', { detail: button.dataset.tool }));
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-craft]').forEach((button) => {
      button.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('game-craft', { detail: button.dataset.craft }));
        this.root.querySelector('[data-ui="crafting"]')?.classList.remove('open');
        this.root.classList.remove('crafting-open');
      });
    });
    this.root.querySelector('[data-craft-cancel]')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('game-craft', { detail: undefined }));
      this.root.querySelector('[data-ui="crafting"]')?.classList.remove('open');
      this.root.classList.remove('crafting-open');
    });
    this.root.querySelector('[data-crafting-toggle]')?.addEventListener('click', () => {
      const open = this.root.querySelector('[data-ui="crafting"]')?.classList.toggle('open') ?? false;
      this.root.classList.toggle('crafting-open', open);
    });
    this.root.querySelector('[data-crafting-close]')?.addEventListener('click', () => {
      this.root.querySelector('[data-ui="crafting"]')?.classList.remove('open');
      this.root.classList.remove('crafting-open');
    });
    this.root.querySelector('[data-fullscreen]')?.addEventListener('click', async () => {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    });
    this.root.querySelector('[data-mobile-bag-toggle]')?.addEventListener('click', () => {
      this.root.querySelector('[data-ui="inventory"]')?.classList.toggle('mobile-open');
    });
    this.root.querySelector('[data-guide-toggle]')?.addEventListener('click', () => {
      window.dispatchEvent(new Event('game-guide-toggle'));
    });
  }

  private text(selector: string, value: string): void {
    this.root.querySelectorAll<HTMLElement>(selector).forEach((element) => {
      element.textContent = value;
    });
  }

  private width(selector: string, value: number): void {
    this.root.querySelectorAll<HTMLElement>(selector).forEach((element) => {
      element.style.width = `${Math.max(0, Math.min(100, value))}%`;
    });
  }

  private progress(selector: string, value: number): void {
    this.root.querySelectorAll<HTMLElement>(selector).forEach((element) => {
      element.style.setProperty('--value', String(Math.max(0, Math.min(100, value))));
    });
  }

  private template(): string {
    const tools = TOOL_ORDER.map(
      (tool, index) =>
        `<button class="tool-slot" data-tool="${tool}"><span>${index + 1}</span>${TOOL_LABELS[tool]}</button>`
    ).join('');
    const recipeIcons: Record<keyof typeof BUILDING_RECIPES, string> = {
      farmHut: '🏠',
      campfire: '🔥',
      workshop: '🔨',
      waterCollector: '💧',
      watchtower: '🗼',
      greenhouse: '🌿'
    };
    const recipes = Object.values(BUILDING_RECIPES)
      .map((recipe) => {
        const cost = Object.entries(recipe.cost)
          .map(([resource, amount]) => `${amount} ${resource}`)
          .join(' · ');
        return `<button class="recipe" data-craft="${recipe.kind}">
          <em class="recipe-icon">${recipeIcons[recipe.kind]}</em>
          <span class="recipe-copy"><strong>${recipe.name}</strong><span>${recipe.description}</span><small>${cost} · ${recipe.footprint.width}×${recipe.footprint.height} tiles</small></span>
        </button>`;
      })
      .join('');
    return `
      <div id="game-canvas"></div>
      <div class="game-hud">
        <button class="mobile-bag-button" data-mobile-bag-toggle>Bag</button>
        <section class="vitals ui-surface">
          <strong class="day-pill"><span data-ui="day">Day 1 · Daylight</span><small data-ui="weather">Clear</small></strong>
          <div class="stat-orb health-stat" data-ui="health-ring"><div><span>♥</span><b data-ui="health-value">100%</b></div><small>Health</small></div>
          <div class="stat-orb hunger-stat" data-ui="hunger-ring"><div><span>●</span><b data-ui="hunger-value">100%</b></div><small>Food</small></div>
          <div class="stat-orb thirst-stat" data-ui="thirst-ring"><div><span>◆</span><b data-ui="thirst-value">100%</b></div><small>Water</small></div>
          <div class="stat-orb energy-stat" data-ui="energy-ring"><div><span>ϟ</span><b data-ui="energy-value">100%</b></div><small>Energy</small></div>
          <div class="stat-orb temperature-stat" data-ui="temperature-ring"><div><span>°</span><b data-ui="temperature-value">100%</b></div><small>Warmth</small></div>
        </section>
        <section class="inventory ui-surface" data-ui="inventory">
          <strong>Backpack</strong>
          <div class="resource-grid">
            <div class="resource-orb wood"><i>🪵</i><b data-ui="wood">0</b><small>Wood</small></div>
            <div class="resource-orb stone"><i>🪨</i><b data-ui="stone">0</b><small>Stone</small></div>
            <div class="resource-orb seeds"><i>🌱</i><b data-ui="seeds">8</b><small>Seeds</small></div>
            <div class="resource-orb crops"><i>🌾</i><b data-ui="crops">0</b><small>Crops</small></div>
            <div class="resource-orb berries"><i>🍓</i><b data-ui="berries">3</b><small>Berries</small></div>
            <div class="resource-orb cores"><i>💎</i><b data-ui="cores">0</b><small>Cores</small></div>
            <div class="resource-orb water"><i>💧</i><b data-ui="water">2</b><small>Water</small></div>
          </div>
        </section>
        <section class="goal ui-surface" data-ui="goal">
          <strong><i>!</i><span data-ui="goal-title">Establish an automated farm</span></strong>
          <span data-ui="goal-progress">Wood 0/12 · Stone 0/8 · Crops 0/6 · Cores 0/2</span>
          <button data-game-action="build">Build</button>
        </section>
        <button class="help-button" data-guide-toggle aria-label="Open guide">?</button>
        <button class="fullscreen-button" data-fullscreen aria-label="Toggle fullscreen">⛶</button>
        <button class="crafting-toggle" data-crafting-toggle>Craft</button>
        <aside class="crafting-panel ui-surface" data-ui="crafting">
          <div class="sheet-handle"></div>
          <header><strong>Craft & build</strong><span data-ui="building-count">0 farm huts · 0 campfires</span>
            <button class="crafting-close" data-crafting-close aria-label="Close crafting">×</button>
          </header>
          <div class="recipe-list">${recipes}</div>
          <button class="cancel-placement" data-craft-cancel>Cancel placement</button>
        </aside>
        <div class="action-prompt ui-surface"><b>Use</b><span data-ui="prompt">Select a tool</span></div>
        <div class="hotbar">${tools}</div>
      </div>
      <div class="touch-controls">
        <div class="joystick" data-joystick aria-label="Movement joystick">
          <div class="joystick-ring"></div>
          <div class="joystick-knob" data-joystick-knob></div>
        </div>
        <div class="touch-actions">
          <button data-game-action="eat"><span>Eat</span>E</button>
          <button data-game-action="drink"><span>Drink</span>Q</button>
          <button class="primary" data-game-action="use"><span>Use</span>●</button>
        </div>
      </div>
      <div class="guide-overlay" data-ui="guide">
        <article class="guide-panel">
          <header><p>Moss & Moon</p><h1>Build a safe home in the valley</h1></header>
          <div class="guide-grid">
            <section><h2>Progression</h2><p>Build a farm hut, workshop, and sanctuary. Then construct defenses and survive raids that grow every night.</p></section>
            <section><h2>Farming</h2><ol><li>Hoe grass</li><li>Plant with Seed Pouch</li><li>Water the crop</li><li>Harvest when golden</li></ol></section>
            <section><h2>Controls</h2><p>Move: WASD / arrows<br>Use or attack: Space<br>Eat: E · Drink: Q<br>Build: C · Guide: H or Esc</p></section>
            <section><h2>Survival</h2><p>Manage health, hunger, thirst, energy, and warmth. Rain helps crops but makes you cold; campfires restore warmth.</p></section>
          </div>
          <button class="start-button" data-game-action="use">Start playing</button>
        </article>
      </div>
      <div class="status-overlay hidden" data-ui="status">
        <div class="status-panel"><h2 data-ui="status-message"></h2><button data-game-action="restart">New game</button></div>
      </div>`;
  }
}
