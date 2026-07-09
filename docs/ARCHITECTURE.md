# Architecture

## Runtime Boundaries

### Phaser game layer

`src/scenes/` owns world rendering, movement, farming, combat, enemies, and the
day/night simulation. It does not own responsive page layout.

### Browser UI layer

`src/ui/GameUi.ts` owns the HUD, onboarding, status dialogs, tool selection, and
touch controls. It uses semantic browser events to communicate with the scene:

- `game-ui-state`: immutable scene snapshot for rendering.
- `game-action`: use, eat, build, or restart command.
- `game-tool`: selected tool command.
- `game-joystick`: normalized analog touch direction and movement strength.
- `game-guide`: guide visibility state.
- `game-status`: collapse or victory state.

This keeps responsive CSS independent from Phaser world coordinates.

### Persistence layer

`src/services/SaveService.ts` is the only module that accesses `localStorage`.
Save data is versioned through `SaveData` in `src/types/game.ts`.

### Automation systems

`src/systems/FarmAutomation.ts` owns pure worker-task prioritization. The scene
supplies nearby farm candidates and applies the selected task to the world.

### Data-driven crafting

`src/config/recipes.ts` defines building names, descriptions, costs, and
affordability rules. The UI and game placement logic consume the same recipes.

### Configuration and models

- `src/config/`: balancing constants and tool definitions.
- `src/types/`: shared domain and persistence contracts.
- `src/assets/`: source artwork loaded by the boot scene.

## Data Flow

1. `GameScene` updates the simulation.
2. It publishes a typed `GameUiState`.
3. `GameUi` renders that state using DOM and CSS.
4. Keyboard or UI actions become semantic commands.
5. `SaveService` stores periodic and action-triggered snapshots.

## Production Build

`npm run build` performs TypeScript validation and emits the Vite production
bundle into `dist/`.
