"""The source images @capacitor/assets turns into every native icon and
splash size (see README, Native apps), made from brand/app-icon-1024.png:

  assets/icon-only.png        the icon as it is (iOS, older Android)
  assets/icon-foreground.png  the icon, smaller, on transparency, and
  assets/icon-background.png  the icon's orange: Android's adaptive icon,
                              which phones crop to a circle or squircle
  assets/splash.png           the wordmark on the app's cream, and
  assets/splash-dark.png      on its dark background, as in styles/base.css

The wordmark is lifted off the icon's orange by unmixing each pixel's
color, so its anti-aliased edges stay smooth, then recolored per theme.

  python3 tools/make-native-assets.py
  npx @capacitor/assets generate --iosProject ios/App --androidProject android \\
    --iconBackgroundColor '#ef7149' --splashBackgroundColor '#f5f5f3' \\
    --splashBackgroundColorDark '#111111'
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets"
ORANGE = (239, 113, 73)  # the icon's background
W_ON_ICON = (252, 217, 198)  # the lighter "w"
INK_ON_ICON = (36, 23, 16)  # "xpn" and "88.5"
# Per theme: page, the lighter "w", and the ink (styles/base.css).
THEMES = {
    "splash": ((250, 248, 243), (242, 178, 143), (33, 31, 28)),
    "splash-dark": ((32, 34, 36), (191, 145, 124), (238, 237, 232)),
}


def unmix(icon):
    """The wordmark as two masks (the "w", and the ink), each pixel's share
    of that color over the orange, from 0 to 1."""
    w_mask = Image.new("L", icon.size)
    ink_mask = Image.new("L", icon.size)
    wp, ip = w_mask.load(), ink_mask.load()
    px = icon.load()

    def share(p, target):
        d = [t - o for t, o in zip(target, ORANGE)]
        v = [c - o for c, o in zip(p, ORANGE)]
        a = sum(x * y for x, y in zip(v, d)) / sum(x * x for x in d)
        return max(0.0, min(1.0, a))

    for y in range(icon.height):
        for x in range(icon.width):
            p = px[x, y]
            a_w, a_ink = share(p, W_ON_ICON), share(p, INK_ON_ICON)
            # Each pixel belongs to whichever color it leans toward.
            if a_w >= a_ink:
                wp[x, y] = round(a_w * 255)
            else:
                ip[x, y] = round(a_ink * 255)
    return w_mask, ink_mask


def wordmark(w_mask, ink_mask, w_color, ink_color):
    """The wordmark in two colors on transparency, cropped to itself."""
    mark = Image.new("RGBA", w_mask.size, (0, 0, 0, 0))
    mark.paste(Image.new("RGBA", w_mask.size, w_color + (255,)), mask=w_mask)
    mark.paste(Image.new("RGBA", w_mask.size, ink_color + (255,)), mask=ink_mask)
    return mark.crop(mark.getbbox())


def main():
    OUT.mkdir(exist_ok=True)
    icon = Image.open(ROOT / "brand/app-icon-1024.png").convert("RGB")
    icon.save(OUT / "icon-only.png")

    # Adaptive icon: the whole icon at 62.5% on transparency, so the
    # wordmark sits well inside the circle every launcher keeps visible;
    # the background layer is the same orange, so no edge shows.
    size = icon.width
    foreground = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    small = icon.resize((round(size * 0.625),) * 2, Image.LANCZOS)
    offset = (size - small.width) // 2
    foreground.paste(small, (offset, offset))
    foreground.save(OUT / "icon-foreground.png")
    Image.new("RGB", (size, size), ORANGE).save(OUT / "icon-background.png")

    # Splash: the wordmark, 1000px wide (about a third of a phone's
    # width), in the middle of a 2732px square.
    w_mask, ink_mask = unmix(icon)
    for name, (page, w_color, ink_color) in THEMES.items():
        mark = wordmark(w_mask, ink_mask, w_color, ink_color)
        mark = mark.resize((1000, round(mark.height * 1000 / mark.width)), Image.LANCZOS)
        canvas = Image.new("RGBA", (2732, 2732), page + (255,))
        canvas.alpha_composite(mark, ((2732 - mark.width) // 2, (2732 - mark.height) // 2))
        canvas.convert("RGB").save(OUT / f"{name}.png")


if __name__ == "__main__":
    main()
