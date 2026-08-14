"""Export the Lua XP Rewards art as 2048x2048 sprite sheets for React Native.

Every sheet: 4 columns x 4 rows of 512x512 cells, one animation per row.
Every cell: a 32x32 art-pixel grid at exactly 16 bitmap px per art pixel.
The avatar's feet sit on the same baseline (y = 464 in the cell) in every cell of every sheet,
so layers stack and sheets swap without any offsets.
"""
import json
import math
import os
from PIL import Image

CELL, COLS, ROWS = 512, 4, 4
PX = 16                       # bitmap pixels per art pixel
BASELINE = 464                # bottom edge of the feet, in cell pixels
OUT = os.path.join(os.path.dirname(__file__), 'out')

PAL = {
    'O': '#4d485c', 'W': '#eeebf8', 'L': '#cfcbdd', 'P': '#ac9dc7',
    'R': '#e0524a', 'r': '#a8393a', 'Y': '#f6c445', 'y': '#c9922a',
    'B': '#4f8fe0', 'N': '#f6f4fb', 'D': '#4a6fa5', 'd': '#36527f',
    'K': '#3d3756', 'S': '#9fe3ff', 'G': '#3fa45b', 'g': '#eef6ef',
}

# ---- art, identical to the web prototype (origin = top-left of the head) ----
HEAD = [".OOOOOOOOOO.", "OWWWWWWWWWWO", "OWLLLLLLLLWO", "OWWWWWWWWWWO", "OWLLLLLLLLPO",
        "OWLLLLLLLLPO", "OWLLLLLLLLPO", "OWLLLLLLLLPO", "OPPPPPPPPPPO", ".OOOOOOOOOO."]
BODY = ["..OLLLLLLO..", "...OLLLLO...", "...OLPPLO...", "...OPPPPO...", "..OPOOOOPO..", "..OOO..OOO.."]
HAND_L = ([".OL", "OLL", ".OO"], 0, 11)
HAND_R = (["LO.", "WWO", "OO."], 9, 11)
EYES = {
    'open': (["O....O", "O....O", "O....O"], 3, 4),
    'closed': (["OOO..OOO"], 2, 6),
    'happy': ([".O....O.", "O.O..O.O"], 2, 4),
}
ITEMS = [
    dict(id='sneakers', name='Sneakers', slot='feet', xp=500, x=0, y=14,
         rows=["..OBO..OBO..", ".OBBO..OBBO.", ".ONNO..ONNO.", ".OOOO..OOOO."]),
    dict(id='jeans', name='Denim Pants', slot='legs', xp=1000, x=0, y=12,
         rows=["...ODDDDO...", "...ODddDO...", "..ODOOOODO.."]),
    dict(id='shades', name='Pixel Shades', slot='face', xp=2000, x=0, y=4,
         rows=["..OOO..OOO..", "OOKSKOOKSKOO", "..OKO..OKO..", "...O....O..."]),
    dict(id='beanie', name='Cozy Beanie', slot='head', xp=3000, x=0, y=-4,
         rows=[".....OO.....", "....OWWO....", "..OOOOOOOO..", ".ORRWRRRRRO.", "ORRRRRRRRRRO",
               "ORRRRRRRRRRO", "OrrrrrrrrrrO", "OOOOOOOOOOOO"]),
    dict(id='scarf', name='Striped Scarf', slot='neck', xp=4000, x=0, y=10,
         rows=[".OGGgGGgGGO.", "..OOOOGgOO..", ".....OgGO...", ".....OOOO..."]),
    dict(id='crown', name='Gold Crown', slot='head', xp=5000, x=0, y=-5,
         rows=["..O..OO..O..", ".OYOOYYOOYO.", ".OYYYYYYYYO.", ".OYRYYYYRYO.", ".OyyyyyyyyO."]),
]
BY_ID = {it['id']: it for it in ITEMS}
HEAD_SLOTS = {'face', 'head'}


def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def art_image(rows, scale=PX, recolor=None):
    w, h = max(len(r) for r in rows), len(rows)
    im = Image.new('RGBA', (w * scale, h * scale), (0, 0, 0, 0))
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch == '.':
                continue
            col = hexrgb(PAL[ch])
            if recolor:
                col = recolor(col)
            im.paste(col, (i * scale, j * scale, (i + 1) * scale, (j + 1) * scale))
    return im


LAYERS = {
    'head': art_image(HEAD), 'body': art_image(BODY),
    'handL': art_image(HAND_L[0]), 'handR': art_image(HAND_R[0]),
    'eyes': {k: art_image(v[0]) for k, v in EYES.items()},
    'items': {it['id']: art_image(it['rows']) for it in ITEMS},
}


# ---- one avatar frame ----
def compose(items, p):
    """items: list of item ids worn. p: pose dict in art-pixel units (fractions allowed)."""
    cv = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    ox = 256 - 6 * PX + round(p.get('dx', 0) * PX)
    oy = BASELINE - 16 * PX + round(p.get('y', 0) * PX)
    q = lambda v: round(v * PX)

    def put(im, gx, gy, dx=0.0, dy=0.0):
        cv.alpha_composite(im, (ox + gx * PX + q(dx), oy + gy * PX + q(dy)))

    worn = {BY_ID[i]['slot']: i for i in items}
    put(LAYERS['body'], 0, 10)
    for slot in ('legs', 'feet', 'neck'):
        if slot in worn:
            it = BY_ID[worn[slot]]
            put(LAYERS['items'][it['id']], it['x'], it['y'], p.get('itemDx', 0), 0)
    put(LAYERS['handL'], HAND_L[1], HAND_L[2], 0, p.get('handL', 0))
    put(LAYERS['handR'], HAND_R[1], HAND_R[2], 0, p.get('handR', 0))
    hdy = p.get('headDy', 0)
    put(LAYERS['head'], 0, 0, 0, hdy)
    ek = p.get('eyes', 'open')
    e = EYES[ek]
    put(LAYERS['eyes'][ek], e[1], e[2], p.get('look', 0) if ek == 'open' else 0, hdy)
    for slot in ('face', 'head'):
        if slot in worn:
            it = BY_ID[worn[slot]]
            put(LAYERS['items'][it['id']], it['x'], it['y'], 0, hdy)

    # squash & stretch anchored at the feet, nearest-neighbour so pixels stay hard-edged
    sy = p.get('sy', 1.0)
    if abs(sy - 1) > 1e-6:
        sx = 1 + (1 - sy) * 0.9
        ay = BASELINE + round(p.get('y', 0) * PX)
        big = cv.resize((round(CELL * sx), round(CELL * sy)), Image.NEAREST)
        m = CELL // 2                                   # margin so negative offsets are fine
        pad = Image.new('RGBA', (CELL + 2 * m, CELL + 2 * m), (0, 0, 0, 0))
        pad.alpha_composite(big, (m + round(256 - 256 * sx), m + round(ay - ay * sy)))
        cv = pad.crop((m, m, m + CELL, m + CELL))
    return cv


def item_layer(item_id, p):
    """Only the pixels that wearing this item changes, so body + layer == avatar wearing it."""
    base = compose([], p)
    full = compose([item_id], p)
    out = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    bp, fp, op = base.load(), full.load(), out.load()
    for y in range(CELL):
        for x in range(CELL):
            f = fp[x, y]
            if f[3] and f != bp[x, y]:
                op[x, y] = f
    return out


# ---- effects (drawn in cell pixels, crisp squares) ----
def square(im, x, y, size, col, alpha=255):
    c = hexrgb(col)[:3] + (alpha,) if isinstance(col, str) else col
    tile = Image.new('RGBA', (size, size), c)
    im.alpha_composite(tile, (int(round(x)), int(round(y))))


def snow(im, k):
    flakes = [(60, 40), (420, 70), (130, 200), (380, 250), (40, 330), (450, 380), (220, 20)]
    for i, (fx, fy) in enumerate(flakes):
        y = (fy + k * 48 + i * 7) % 470
        a = int(230 * math.sin(math.pi * y / 470))
        square(im, fx + (8 if (k + i) % 2 else 0), y, 12 if i % 2 else 8, '#ffffff', a)


def wind(im, k):
    for i, yy in enumerate((150, 230, 310)):
        x0 = 520 - ((k * 128 + i * 170) % 680)
        for s in range(0, 120, 8):
            if 0 <= x0 + s < CELL:
                square(im, x0 + s, yy, 8, (120, 105, 160, 150))


def twinkle(im, k, p):
    ox = 256 - 6 * PX
    oy = BASELINE - 16 * PX + round(p.get('y', 0) * PX)
    spots = [(-1.5, -4.5), (13, -3), (-0.5, 1), (12.5, 2)]
    for i, (sx, sy) in enumerate(spots):
        a = max(0.0, math.sin(k * math.pi / 2 + i * 1.7))
        if a < 0.15:
            continue
        cx, cy = ox + sx * PX, oy + sy * PX
        r = int(PX * (0.5 + a * 0.6))
        col = PAL['Y'] if i % 2 else '#ffffff'
        alpha = int(255 * a)
        im.alpha_composite(Image.new('RGBA', (2 * r, PX // 2), hexrgb(col)[:3] + (alpha,)), (int(cx - r), int(cy - PX // 4)))
        im.alpha_composite(Image.new('RGBA', (PX // 2, 2 * r), hexrgb(col)[:3] + (alpha,)), (int(cx - PX // 4), int(cy - r)))


def glint(im, step, p):
    """White shine sliding across the shades' lenses."""
    if step < 0:
        return
    ox = 256 - 6 * PX
    oy = BASELINE - 16 * PX + round(p.get('headDy', 0) * PX)
    for lx in (2, 7):
        gx = lx + step
        square(im, ox + gx * PX, oy + 5 * PX, PX, '#ffffff')
        if step > 0:
            square(im, ox + (gx - 1) * PX, oy + 6 * PX, PX, '#ffffff')


def burst(k):
    im = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    cx, cy = 256, BASELINE - 9 * PX
    t = (0.12, 0.35, 0.62, 0.9)[k]
    cols = ['#ffffff', PAL['Y'], PAL['S'], PAL['G']]
    for i in range(18):
        ang = i * (2 * math.pi / 18) + (0.3 if i % 2 else 0)
        dist = 40 + t * (150 + 40 * (i % 3))
        x = cx + math.cos(ang) * dist
        y = cy + math.sin(ang) * dist - 60 * t + 160 * t * t
        size = PX if i % 3 else PX // 2 + 4
        a = int(255 * (1 - t) ** 0.6)
        square(im, x - size / 2, y - size / 2, size, cols[i % 4], a)
    return im


# ---- animations ----
def idle_poses(eyes='open'):
    out = []
    for k in range(4):
        ph = k / 4
        b = math.sin(2 * math.pi * ph)
        out.append(dict(eyes=eyes, headDy=(1 - math.cos(2 * math.pi * ph)) * 0.12,
                        handL=b * 0.16, handR=-b * 0.1))
    return out


BODY_ROWS = [
    ('idle', idle_poses()),
    ('blink_glance', [dict(), dict(eyes='closed'), dict(look=-1), dict(look=1)]),
    ('hop', [dict(sy=0.9, eyes='open', handL=0.2, handR=0.2),
             dict(y=-2, sy=1.06, handL=-0.3, handR=-0.3),
             dict(y=-3, eyes='happy', handL=-0.5, handR=-0.5),
             dict(sy=0.9, eyes='happy', handL=0.15, handR=0.15)]),
    ('happy', idle_poses('happy')),
]

PREVIEWS = [
    ('sneakers', [dict(sy=0.9), dict(y=-1.5, sy=1.05), dict(y=-2.5, eyes='happy'), dict(y=-1)], None),
    ('jeans', [dict(), dict(dx=0.5, look=1, y=-0.3, handL=-0.2, handR=-0.2),
               dict(), dict(dx=-0.5, look=-1, y=-0.3, handL=-0.2, handR=-0.2)], None),
    ('shades', [dict(), dict(headDy=0.35), dict(), dict()], 'glint'),
    ('beanie', [dict(dx=-0.15, eyes='closed', handL=-0.15, handR=-0.15),
                dict(dx=0.15, eyes='closed', handL=-0.15, handR=-0.15),
                dict(eyes='happy'), dict(eyes='happy', headDy=0.12)], 'snow'),
    ('scarf', [dict(eyes='closed'), dict(eyes='closed', itemDx=0.2, handL=0.1),
               dict(eyes='closed'), dict(eyes='closed', itemDx=-0.2, handL=-0.1)], 'wind'),
    ('crown', [dict(sy=0.92, eyes='happy'), dict(y=-1.2, eyes='happy'),
               dict(y=-0.6, eyes='happy'), dict(eyes='happy')], 'twinkle'),
]


def preview_frame(item_id, p, k, fx):
    im = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    if fx == 'wind':
        wind(im, k)
    im.alpha_composite(compose([item_id], p))
    if fx == 'snow':
        snow(im, k)
    if fx == 'twinkle':
        twinkle(im, k, p)
    if fx == 'glint':
        glint(im, (-1, -1, 0, 2)[k], p)
    return im


# ---- sheet assembly ----
def new_sheet():
    return Image.new('RGBA', (CELL * COLS, CELL * ROWS), (0, 0, 0, 0))


def place(sheet, im, row, col):
    sheet.alpha_composite(im, (col * CELL, row * CELL))


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = {
        'sheetSize': 2048, 'cell': CELL, 'columns': COLS, 'rows': ROWS,
        'artPixel': PX, 'artGrid': 32, 'baselineY': BASELINE,
        'notes': [
            'Every cell is a 32x32 art-pixel grid at 16 bitmap px per art pixel.',
            'The avatar feet sit on y=464 in every cell of every sheet.',
            'Stack paper-doll layers in this order: avatar_body, item_jeans, item_sneakers, item_scarf, item_shades, then item_beanie or item_crown (one head item at a time).',
            'All layer sheets share the body sheet\'s rows and frames: animate them with one transform.',
            'Sneakers soles reach 2 art px (32 bitmap px) below the baseline; lift the stack by 32 cell px while they are worn if you want the feet back on the ground line.',
        ],
        'sheets': {},
    }

    # 1. body
    sh = new_sheet()
    for r, (name, poses) in enumerate(BODY_ROWS):
        for c, p in enumerate(poses):
            place(sh, compose([], p), r, c)
    sh.save(os.path.join(OUT, 'avatar_body.png'), optimize=True)
    manifest['sheets']['avatar_body'] = {'file': 'avatar_body.png', 'rows': [n for n, _ in BODY_ROWS]}

    # 2. paper-doll item layers (same rows/frames as the body sheet)
    for it in ITEMS:
        sh = new_sheet()
        for r, (name, poses) in enumerate(BODY_ROWS):
            for c, p in enumerate(poses):
                place(sh, item_layer(it['id'], p), r, c)
        fn = 'item_%s.png' % it['id']
        sh.save(os.path.join(OUT, fn), optimize=True)
        manifest['sheets']['item_' + it['id']] = {
            'file': fn, 'rows': [n for n, _ in BODY_ROWS], 'layerOf': 'avatar_body',
            'slot': it['slot'], 'unlockXp': it['xp'], 'name': it['name']}

    # 3. milestone preview poses (avatar wearing only that item), 4 per sheet + effects
    sheetA, sheetB = new_sheet(), new_sheet()
    for i, (iid, poses, fx) in enumerate(PREVIEWS):
        target, row = (sheetA, i) if i < 4 else (sheetB, i - 4)
        for c, p in enumerate(poses):
            place(target, preview_frame(iid, p, c, fx), row, c)
    for c in range(4):
        place(sheetB, burst(c), 2, c)
    sheetA.save(os.path.join(OUT, 'preview_poses_1.png'), optimize=True)
    sheetB.save(os.path.join(OUT, 'preview_poses_2.png'), optimize=True)
    manifest['sheets']['preview_poses_1'] = {'file': 'preview_poses_1.png', 'rows': [p[0] for p in PREVIEWS[:4]]}
    manifest['sheets']['preview_poses_2'] = {'file': 'preview_poses_2.png',
                                             'rows': [PREVIEWS[4][0], PREVIEWS[5][0], 'unlock_burst', None]}

    # 4. item icons: rows 0-1 unlocked, rows 2-3 locked
    def locked(col):
        g = int(0.3 * col[0] + 0.59 * col[1] + 0.11 * col[2])
        g = int(40 + g * 0.35)
        return (g, g, int(g * 1.08), 255)

    sh = new_sheet()
    icon_px = 32
    for i, it in enumerate(ITEMS):
        for variant, recolor in ((0, None), (2, locked)):
            im = art_image(it['rows'], icon_px, recolor)
            if im.width > 448:                       # keep inside the cell with a margin
                im = art_image(it['rows'], 24, recolor)
            cell = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
            cell.alpha_composite(im, ((CELL - im.width) // 2, (CELL - im.height) // 2))
            place(sh, cell, variant + i // 4, i % 4)
    sh.save(os.path.join(OUT, 'item_icons.png'), optimize=True)
    manifest['sheets']['item_icons'] = {
        'file': 'item_icons.png',
        'cells': {it['id']: {'unlocked': [i // 4, i % 4], 'locked': [2 + i // 4, i % 4]} for i, it in enumerate(ITEMS)}}

    with open(os.path.join(OUT, 'sprites.json'), 'w') as f:
        json.dump(manifest, f, indent=2)


if __name__ == '__main__':
    main()
