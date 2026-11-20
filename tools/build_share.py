#!/usr/bin/env python3
"""Builds images/share.jpg, the site-wide 1200x630 link preview: badge logo + real feature covers.
Run from the repo root: python3 tools/build_share.py [slug slug slug]"""
import sys, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance
W, H = 1200, 630
# --root <dir> (or $PSR_ROOT) selects the site root; remaining args are slugs.
argv = sys.argv[1:]
if argv and argv[0] == "--root" and len(argv) >= 2:
    os.chdir(os.path.abspath(argv[1])); argv = argv[2:]
elif os.environ.get("PSR_ROOT"):
    os.chdir(os.path.abspath(os.environ["PSR_ROOT"]))
slugs = argv or ["eduardo-vazquez", "chase-doyle", "cole-corey"]
covers = [Image.open(f"images/players/{s}.jpg").convert("RGB") for s in slugs if os.path.exists(f"images/players/{s}.jpg")]
A = lambda n: ImageFont.truetype("tools/fonts/Anton.ttf", n)
B = lambda n: ImageFont.truetype("tools/fonts/Barlow.ttf", n)
peach, ink = (255, 138, 76), (7, 11, 20)
# backdrop: blurred lead cover fading into navy
bg = covers[0].copy(); s = max(W / bg.width, H / bg.height)
bg = bg.resize((int(bg.width * s) + 1, int(bg.height * s) + 1)).crop((0, 0, W, H))
bg = ImageEnhance.Brightness(bg.filter(ImageFilter.GaussianBlur(40))).enhance(.32)
shade = Image.new("RGB", (W, H), ink); mask = Image.linear_gradient("L").rotate(90).resize((W, H))
bg = Image.composite(bg, shade, mask.point(lambda v: min(255, int(v * 1.3)))).convert("RGBA")
# covers fanned on the right, lead on top
ch = 470
spots = [(860, 92, 7), (640, 70, -6), (735, 80, 0)]  # back-right, back-left, front
order = [covers[2 % len(covers)], covers[1 % len(covers)], covers[0]]
for im, (x, y, rot) in zip(order, spots):
    cw = int(im.width * ch / im.height); c = im.resize((cw, ch), Image.LANCZOS).convert("RGBA")
    card = Image.new("RGBA", (cw + 4, ch + 4), (255, 255, 255, 60)); card.paste(c, (2, 2))
    sh = Image.new("RGBA", (cw + 80, ch + 80), (0, 0, 0, 0)); ImageDraw.Draw(sh).rectangle([40, 50, cw + 40, ch + 50], fill=(0, 0, 0, 150))
    sh = sh.filter(ImageFilter.GaussianBlur(18))
    if rot: card = card.rotate(rot, Image.BICUBIC, expand=True); sh = sh.rotate(rot, Image.BICUBIC, expand=True)
    bg.alpha_composite(sh, (x - 40, y - 40)); bg.alpha_composite(card, (x, y))
d = ImageDraw.Draw(bg)
badge = Image.open("images/logo.png").convert("RGBA").resize((132, 132), Image.LANCZOS)
bg.alpha_composite(badge, (56, 44))
d.text((206, 92), "PEACH STATE", font=B(30), fill=(255, 255, 255), anchor="ls")
d.text((206, 128), "RECRUITS", font=B(30), fill=(255, 178, 125), anchor="ls")
d.text((56, 182), "YOUR FILM.", font=A(108), fill=(255, 255, 255))
d.text((56, 294), "FEATURED.", font=A(108), fill=peach)
d.text((60, 440), "Baseball player features, highlight videos", font=B(30), fill=(235, 238, 245))
d.text((60, 476), "and recruiting profiles.", font=B(30), fill=(235, 238, 245))
d.rounded_rectangle([56, 532, 470, 586], 12, fill=peach)
d.text((263, 559), "4M+ VIEWS  |  10K+ FOLLOWERS", font=B(26), fill=ink, anchor="mm")
bg.convert("RGB").save("images/share.jpg", quality=86, optimize=True, progressive=True)
print("wrote images/share.jpg from", slugs)
