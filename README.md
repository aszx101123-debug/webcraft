# WebCraft — Free Browser Voxel Sandbox

**Mine, craft, build and explore. No download. No login required to play.**

**[▶ Play now](https://aszx101123-debug.github.io/webcraft/play.html?lang=en)** · **[English game guide](https://aszx101123-debug.github.io/webcraft/en.html)** · [한국어 문서](README.ko.md)

[![WebCraft checks](https://github.com/aszx101123-debug/webcraft/actions/workflows/webcraft-check.yml/badge.svg)](https://github.com/aszx101123-debug/webcraft/actions/workflows/webcraft-check.yml)

![WebCraft logo above a generated block island](img/og-image.png)

WebCraft is a free, Minecraft-inspired voxel sandbox game that runs in desktop and mobile browsers. Start a single-player world, gather resources, craft your first tools and build a shelter before nightfall — or fly with unlimited blocks in creative mode.

## Choose your adventure

- **Survival:** mining, crafting, farming, cooking, hostile mobs, hearts, hunger and underwater air.
- **Creative:** unlimited blocks and flight for free building.
- **Explore:** 16 biomes, caves and ores, seeded terrain, weather and a day/night cycle.
- **Desktop and mobile:** keyboard/mouse and touch controls, plus character customization.
- **Keep your world:** browser autosaves and backup export/import from the Esc menu.

Both game modes work without an account. **Guests do not receive credits.** Daily credit rewards and badge exchanges require signing in and are checked by the server. Worlds are stored in the current browser; account sign-in does not provide cloud world storage.

## Quick start

1. Open **[WebCraft](https://aszx101123-debug.github.io/webcraft/play.html?lang=en)** in a browser.
2. Pick a world and choose survival or creative.
3. Mine a log, craft planks and make a crafting table — or start building with unlimited blocks.

| Control | Action |
| --- | --- |
| `W A S D` | Move |
| `Space` | Jump / swim up / fly up |
| `Shift` | Sneak / fly down |
| `Ctrl` + `W` | Sprint |
| Left click / right click | Mine or attack / place or use |
| `E` | Inventory and crafting |
| `1`–`9` / mouse wheel | Select hotbar slot |
| `Esc` | Pause, settings and world backups |
| `F5` | Change camera view |

On mobile, use the joystick to move, drag to look around, tap to use/place and hold to mine. Hold the jump button to swim up.

## What's new in v1.8.7

- Underwater effects stay active between vertically connected water blocks.
- Full air bubbles appear immediately when the player's head enters the water.
- Water geometry and submersion checks agree, including shallow flowing water.
- A static English game guide includes English search metadata and social share previews.

The release also includes guest play, account-only credit rewards, and the improved cactus, pixel hearts and hunger icons from v1.8.5–1.8.6. See the [Korean development history](README.ko.md#버전-히스토리) for earlier changes.

## Feedback and sharing

Found a bug? [Open an issue](https://github.com/aszx101123-debug/webcraft/issues) with your browser/device, what happened and the steps to reproduce it. Feature suggestions and builds are welcome too.

If you enjoy WebCraft, a GitHub star and a link shared with friends help others discover it. The [English introduction](https://aszx101123-debug.github.io/webcraft/en.html) has a readable overview and a direct play link. [Promotion copy](PROMOTION.md) is available in English and Korean.

## Run locally

The game uses JavaScript, Three.js and WebGL. The Three.js library is included in the repository. From a local checkout:

```sh
python -m http.server 8000
```

Open `http://localhost:8000/play.html?lang=en`. No build step is required for the static game. Account credit features use the configured Supabase backend.

```sh
npm test
```

Tests cover terrain, game-loop behavior, inventory, crafting, saves, collisions, water detection, underwater HUD and guest/account credit controls. See [README.ko.md](README.ko.md) for the full module layout and technical notes.

## Credits

WebCraft is an independent, unofficial fan project inspired by Minecraft. It is not affiliated with Mojang Studios or Microsoft.

The classic texture pack includes work by XSSheep (Pixel Perfection) and VoxeLibre contributors under CC BY-SA 3.0. See [texture attribution](img/classic/README.txt) and the [license](img/classic/LICENSE-CC-BY-SA-3.0.txt).
