# Mean brightness and saturation of the side panels vs the game picture in a
# monitor screenshot. Usage: python3 scripts/side-brightness.py shots/monitor-1920x1080.png
import sys, colorsys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB')
W, H = im.size
play_w = int(H * 204 / 320)
x0 = (W - play_w) // 2
def stats(box):
    reg = im.crop(box).resize((120, 120))
    px = list(reg.getdata())
    lum = sum(0.2126*r + 0.7152*g + 0.0722*b for r, g, b in px) / len(px)
    sat = sum(colorsys.rgb_to_hsv(r/255, g/255, b/255)[1] * max(r, g, b) / 255 for r, g, b in px) / len(px)
    return lum, sat
for name, box in [('left wall', (0, 0, x0, H)), ('right wall', (x0 + play_w, 0, W, H)), ('game', (x0, 0, x0 + play_w, H))]:
    l, s = stats(box)
    print(f'{name:10} brightness {l:5.1f}   colourfulness {s:.3f}')
