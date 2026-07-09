  # Survival Game Product Roadmap

This document treats the requested survival systems as one connected product,
not as independent feature checkboxes.

## Release 1: Survival Foundation

Status: in progress.

- Health, hunger, thirst, energy, and warmth.
- Stored water, manual drinking, and rain-sensitive Water Collectors.
- Clear, rain, and cold-snap weather effects.
- Campfire warmth and energy recovery.
- Farming, seeds, crop growth, and automatic workers.
- Renewable trees, rocks, and berries.
- Escalating nightly raids.
- Farm Hut, Workshop, Sanctuary, Watchtower, and Greenhouse progression.
- Autosave and responsive desktop/mobile controls.

## Release 2: Primitive and Stone Ages

- Gatherable water, fiber, herbs, clay, coal, bones, hide, and feathers.
- Item stacks, weight, equipment slots, and durability.
- Craftable axe, pickaxe, torch, spear, bow, arrows, storage, bed, well,
  workbench, walls, doors, windows, roofs, and spike fences.
- Repair costs and sleeping to skip part of the night.
- Cooking, raw/cooked food, medicine, bleeding, poison, wet, dehydrated, and
  exhausted statuses.

## Release 3: Wildlife and Deeper Farming

- Wheat, corn, potato, tomato, carrot, and pumpkin.
- Growth stages, fertilizer, disease, seasons, and weather interactions.
- Rabbit, deer, chicken, boar, wolf, bear, snake, and spider behavior.
- Meat, leather, fat, fur, bones, and feathers.
- Animal AI states: idle, patrol, investigate, chase, attack, retreat, return.
- Noise and food-scent detection.

## Release 4: Metal Ages and Base Defense

- Caves and iron, copper, coal, clay, and sand deposits.
- Furnace, anvil, smithing table, cooking pot, and metal tool tiers.
- Foundations and wood-to-stone-to-metal structure upgrades.
- Base health, repair, enemy structure targeting, traps, gates, guards, and
  defensive walls.
- Skill progression for gathering, mining, farming, cooking, combat, running,
  and fishing.

## Release 5: Exploration and World Systems

- Forest, desert, swamp, snow, beach, mountain, jungle, and volcanic biomes.
- Map, compass, markers, minimap, caves, ruins, camps, houses, and shipwrecks.
- Weather events: storms, snow, wind, fog, heatwaves, lightning, and fire.
- Loot rarity, merchants, farmers, hunters, blacksmiths, healers, and quests.
- Fishing by location, weather, time, rod, and bait.

## Release 6: Industrial and Endgame

- Electricity, generators, windmills, solar panels, pumps, irrigation,
  conveyors, auto quarries, tree farms, and storage sorting.
- Chemistry and electrical crafting stations.
- Blood moons, migrations, raids, earthquakes, fires, and meteor events.
- Biome bosses and unique progression materials.
- Long-term settlement projects and repeatable endgame threats.

## Multiplayer

Trading, teams, shared storage, base claiming, PvP, clans, and voice chat are a
separate product phase. Networking cannot be safely layered onto mutable
single-player state until authoritative simulation and persistence are designed.

## Design Rule

Every release must preserve the dependency loop:

survival pressure -> gathering -> crafting -> shelter -> exploration ->
rarer materials -> stronger threats -> defenses -> automation -> new regions.
