"""Rebuild the checked-in classic atlas from the attributed PNG source files.

Requires Pillow. No network access or game save changes are needed.
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "img" / "classic"
pack = json.loads((ROOT / "pack.json").read_text())
atlas = Image.new("RGBA", (256, 256))


def tinted(image, rgb):
    # Source foliage uses a neutral lightness palette; preserve its pixel pattern
    # while centering it on the chosen biome color rather than muddying the green.
    pixels = []
    for r, g, b, a in image.getdata():
        lightness = (r * .2126 + g * .7152 + b * .0722) / 128
        pixels.append(tuple(min(255, round(c * lightness)) for c in rgb) + (a,))
    result = Image.new("RGBA", image.size)
    result.putdata(pixels)
    return result


def frame(name):
    image = Image.open(ROOT / "src" / name).convert("RGBA")
    return image.crop((0, 0, image.width, image.width)).resize((16, 16), Image.Resampling.NEAREST)


for tile in pack["tiles"]:
    image = frame(tile["source"])
    if "tint" in tile:
        image = tinted(image, tile["tint"])
    if "base" in tile:
        base = frame(tile["base"])
        base.alpha_composite(image)
        image = base
    if tile["source"] == "mcl_core_water_source_animation.png":
        image.putalpha(255)
    col, row = tile["at"]
    atlas.paste(image, (col * 16, row * 16))
atlas.save(ROOT / "atlas.png", optimize=True)

water = Image.open(ROOT / "src" / "mcl_core_water_source_animation.png").convert("RGBA")
frames = water.height // water.width
water = water.resize((16, frames * 16), Image.Resampling.NEAREST)
water = tinted(water, [65, 110, 215])
# Transparency belongs to the mesh so stacked water faces do not become opaque.
water.putalpha(255)
water.save(ROOT / "water.png", optimize=True)
print(f"Built {len(pack['tiles'])} classic tiles and {frames} water frames.")
