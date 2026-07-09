# Sproutstead

A responsive survival farming game built with TypeScript, Vite, and Phaser 3.

## Run

```bash
npm install
npm run dev
```

## Deploy to GitHub Pages

1. Initialize Git and push this project to a GitHub repository using the
   `main` branch.
2. In the repository, open **Settings → Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push to `main`. The `Deploy game to GitHub Pages` workflow builds and
   publishes the game automatically.

The Vite build uses relative asset paths, so it works from a repository
subdirectory such as `https://username.github.io/repository-name/`.

## Controls

- `WASD` or arrow keys: move
- `Space`: use the selected tool
- `1`: hoe
- `2`: watering can
- `3`: axe
- `4`: pickaxe
- `5`: seed pouch
- `E`: eat berries first, then crops
- `C`: build the sanctuary when the recipe is ready
- `H` or `Esc`: open the guide
- `R`: restart after collapse

## Core Loop

Gather resources and build the sanctuary with 12 wood, 8 stone, 6 crops, and
2 slime cores. Rocks require four pickaxe strikes. Slimes require three axe
strikes and drop cores. The browser automatically saves progress and restores it
after refresh.

## Building and Automation

Open the responsive **Craft** panel, select a recipe, then click or tap clear
ground:

- **Auto Farm Hut**: costs 8 wood, 4 stone, and 2 crops. Its worker creates
  emergency seeds, expands nearby farmland, plants, waters, and harvests.
- **Campfire**: costs 4 wood and 3 stone. Standing nearby restores energy
  quickly.
- **Workshop**: unlocks after the first Farm Hut and costs 12 wood, 10 stone,
  and 4 crops. It doubles farm-worker speed, improves harvests, and upgrades
  tool damage.
- **Water Collector**: unlocks after the Workshop, stores up to 20 water, and
  collects faster during rain. Press `Q` or use the mobile Drink button.

The fullscreen button is beside Help. Buildings and automated farm progress are
included in autosaves.

On mobile, use the analog thumb stick for variable-speed movement. The crafting
drawer is a compact scrollable bottom sheet and temporarily hides movement
controls while open.

Progression is staged: Auto Farm Hut, Workshop, then Sanctuary. Workers consume
real inventory seeds and return additional seeds when mature crops are
harvested.

## Project Docs

- [Game Design](docs/GAME_DESIGN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Milestones](docs/MILESTONES.md)
- [Data Model](docs/DATA_MODEL.md)
- [Product Roadmap](docs/PRODUCT_ROADMAP.md)
