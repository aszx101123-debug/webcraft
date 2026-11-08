WebCraft Classic Pixels — texture credits
========================================

Based on Pixel Perfection by XSSheep and textures by VoxeLibre contributors.
Source: https://github.com/VoxeLibre/VoxeLibre
Pinned revision: 4492ce6ff8d856daa4567abe2ea689f4e7a39842
Original pack: https://www.planetminecraft.com/texture_pack/131pixel-perfection/

License: Creative Commons Attribution-ShareAlike 3.0 Unported
https://creativecommons.org/licenses/by-sa/3.0/
The license URI is included in LICENSE-CC-BY-SA-3.0.txt.
See UPSTREAM-LEGAL.md for the upstream media license and authorship notice.

The source PNGs are included in src/. pack.json maps each source file to the
WebCraft atlas. The atlas and water animation were assembled for WebCraft on
2026-11-08. Changes: biome tinting, first-frame selection, 16px nearest-neighbor
resampling where needed, ore/dirt compositing and atlas arrangement.
These adapted texture files retain the same CC BY-SA 3.0 license.

landscape.png is an offline render of WebCraft's generated terrain using these
textures and its production lighting shaders, used as the homepage background.
It is distributed under the same CC BY-SA 3.0 license.

Rebuild: python tools/build-classic-pack.py (requires Pillow).
The game's source code and its original generated item art are separate works.
