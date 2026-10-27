#!/usr/bin/env python3
"""Generate the site's static brand assets (logo, favicons, OG image).

Usage: python3 scripts/make_assets.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "docs" / "public"
PUBLIC.mkdir(parents=True, exist_ok=True)

CARDINAL = (140, 21, 21)
CARDINAL_DARK = (98, 12, 12)
CREAM = (250, 249, 246)
WHITE = (255, 255, 255)

LATIN_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
LATIN = "/System/Library/Fonts/Supplemental/Arial.ttf"
CJK_BOLD = "/System/Library/Fonts/STHeiti Medium.ttc"
CJK_BOLD_INDEX = 1


def font(path: str, size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size, index=index)
    except OSError:
        return ImageFont.load_default()


def rounded_tile(size: int, radius_ratio: float = 0.22) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    r = int(size * radius_ratio)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=r, fill=CARDINAL)

    # subtle darker wedge for depth, clipped to the rounded tile
    wedge = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    wdraw = ImageDraw.Draw(wedge)
    wdraw.pieslice(
        (int(-size * 0.15), int(size * 0.55), int(size * 1.15), int(size * 2.1)),
        start=180,
        end=360,
        fill=CARDINAL_DARK,
    )
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=r, fill=255)
    img.alpha_composite(Image.composite(wedge, Image.new("RGBA", (size, size), (0, 0, 0, 0)), mask))
    return img


def draw_tile_mark(img: Image.Image) -> Image.Image:
    size = img.width
    draw = ImageDraw.Draw(img)
    # orbit ring
    cx = cy = size / 2
    ring_r = size * 0.30
    draw.ellipse((cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r),
                 outline=(255, 255, 255, 90), width=max(2, int(size * 0.012)))
    # Z monogram
    f = font(LATIN_BOLD, int(size * 0.52))
    text = "Z"
    box = draw.textbbox((0, 0), text, font=f)
    tw, th = box[2] - box[0], box[3] - box[1]
    draw.text((cx - tw / 2 - box[0], cy - th / 2 - box[1] - size * 0.01), text, font=f, fill=WHITE)
    # orbit dot
    dot = size * 0.045
    ang_x, ang_y = cx + ring_r * 0.92, cy - ring_r * 0.62
    draw.ellipse((ang_x - dot, ang_y - dot, ang_x + dot, ang_y + dot), fill=CREAM)
    return img


def make_logo() -> None:
    size = 512
    tile = draw_tile_mark(rounded_tile(size))
    tile.save(PUBLIC / "logo.png")
    tile.save(PUBLIC / "logo.webp", "WEBP", quality=92, method=6)
    tile.resize((64, 64), Image.LANCZOS).save(PUBLIC / "favicon.png")
    tile.resize((180, 180), Image.LANCZOS).save(PUBLIC / "apple-touch-icon.png")
    # Nav logo: transparent background, readable at 24px
    nav = Image.new("RGBA", (192, 192), (0, 0, 0, 0))
    nav_tile = draw_tile_mark(rounded_tile(192, 0.2))
    nav.alpha_composite(nav_tile, (0, 0))
    nav.save(PUBLIC / "logo-nav.png")


def make_og() -> None:
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), CREAM)
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, W, 18), fill=CARDINAL)

    title_font = font(LATIN_BOLD, 86)
    sub_font = font(CJK_BOLD, 42, index=CJK_BOLD_INDEX)
    small_font = font(LATIN, 28)
    label_font = font(LATIN_BOLD, 26)

    draw.text((92, 96), "STANFORD CS329Z", font=label_font, fill=CARDINAL)
    draw.text((92, 158), "Engineering", font=title_font, fill=(26, 26, 26))
    draw.text((92, 258), "AI Agents", font=title_font, fill=CARDINAL)
    draw.text((92, 392), "中文讲义 · 10 讲 slides 精读", font=sub_font, fill=(60, 60, 60))
    draw.text((92, 470), "cs329z.stanford.edu · Fall 2026", font=small_font, fill=(110, 110, 110))
    draw.line((92, 520, 420, 520), fill=(200, 196, 190), width=2)

    tile = draw_tile_mark(rounded_tile(300, 0.24))
    img.paste(tile, (820, 165), tile)
    img.save(PUBLIC / "og-image.png")
    print("assets written to", PUBLIC)


if __name__ == "__main__":
    make_logo()
    make_og()
