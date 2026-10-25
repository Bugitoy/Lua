"""Export the Lua XP Rewards art as 2048x2048 sprite sheets for React Native (v3: 17-reward path + costume shop).

Every sheet: 4 columns x 4 rows of 512x512 cells, one animation per row.
Every cell: a 32x32 art-pixel grid at exactly 16 bitmap px per art pixel.
The avatar's feet sit on the same baseline (y = 464 in the cell) in every cell of every sheet,
so layers stack and sheets swap without any offsets.

Run:  python3 make_sheets.py      (needs Pillow)
"""
import json
import math
import os
from PIL import Image

CELL, COLS, ROWS = 512, 4, 4
PX = 16                       # bitmap pixels per art pixel
BASELINE = 464                # bottom edge of the feet, in cell pixels
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sheets')

PAL = {
    'O': '#4d485c', 'W': '#eeebf8', 'L': '#cfcbdd', 'P': '#ac9dc7',
    'R': '#e0524a', 'r': '#a8393a', 'Y': '#f6c445', 'y': '#c9922a',
    'B': '#4f8fe0', 'b': '#2f5fa8', 'N': '#f6f4fb', 'D': '#4a6fa5', 'd': '#36527f',
    'K': '#3d3756', 'S': '#9fe3ff', 'G': '#3fa45b', 'g': '#eef6ef',
    'V': '#6b4fc9', 'v': '#4a34a0', 'T': '#35a7c9', 't': '#267f9c', 'U': '#6a5fa0',
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

# Clothes: every one is earned on the unlock path (PATH below sets the XP for each)
CLOTHES = [
    dict(id='sneakers', name='Sneakers', slot='feet', x=0, y=14,
         rows=["..OBO..OBO..", ".OBBO..OBBO.", ".ONNO..ONNO.", ".OOOO..OOOO."]),
    dict(id='jeans', name='Denim Pants', slot='legs', x=0, y=12,
         rows=["...ODDDDO...", "...ODddDO...", "..ODOOOODO.."]),
    dict(id='shades', name='Pixel Shades', slot='face', x=0, y=4,
         rows=["..OOO..OOO..", "OOKSKOOKSKOO", "..OOO..OOO.."]),
    dict(id='beanie', name='Cozy Beanie', slot='head', x=0, y=-4,
         rows=[".....OO.....", "....OWWO....", "..OOOOOOOO..", ".ORRWRRRRRO.", "ORRRRRRRRRRO",
               "ORRRRRRRRRRO", "OrrrrrrrrrrO", "OOOOOOOOOOOO"]),
    dict(id='scarf', name='Striped Scarf', slot='neck', x=0, y=10,
         rows=[".OGGgGGgGGO.", "..OOOOGgOO..", ".....OgGO...", ".....OOOO..."]),
    dict(id='crown', name='Gold Crown', slot='head', x=0, y=-5,
         rows=["..O..OO..O..", ".OYOOYYOOYO.", ".OYYYYYYYYO.", ".OYRYYYYRYO.", ".OyyyyyyyyO."]),

    dict(id='cap', name='Ball Cap', slot='head', x=0, y=-2,
         rows=["...OOOOOO.....", "..OBBBBBBO....", ".OBBWBBBBBO...", "OBBBBBBBBBBO..", "ObbbbbbbbbbbbO", "OOOOOOOOOOOOOO"]),
    dict(id='headphones', name='Headphones', slot='head', x=-3, y=-3,
         rows=["....KKKKKKKKKK....", "..KKKKKKKKKKKKKK..", ".KKKK........KKKK.", ".KKK..........KKK.",
               "OOOO..........OOOO", "ORRO..........ORRO", "ORRO..........ORRO", "ORRO..........ORRO",
               "OrrO..........OrrO", ".OO............OO."]),
    dict(id='hoodie', name='Hoodie', slot='top', x=0, y=10,
         rows=["..OTTTTTTO..", "...OWTTWO...", "...OTttTO..."],
         # sleeves cover the arm next to the body (the hand tip still shows) and sway with the hands
         sleeves=dict(L=dict(x=0, y=11, rows=["..T", "..t"]), R=dict(x=9, y=11, rows=["T..", "t.."])),
         # the hood goes over the head and moves with it; hats and headphones sit on top of it
         hood=dict(x=-1, y=-1, rows=["..OOOOOOOOOO..", ".OTTTTTTTTTTO.", "OTOOOOOOOOOOTO", "OTO........OTO",
                                     "OTO........OTO", "OTO........OTO", "OTO........OTO", "OTO........OTO",
                                     "OTO........OTO", "OTOOOOOOOOOOTO", ".OttttttttttO.", "..OOOOOOOOOO.."])),
    dict(id='cape', name='Hero Cape', slot='back', x=-2, y=10,
         rows=[".ORRRRRRRRRRRRO.", ".ORRRRRRRRRRRRO.", "ORRRRRRRRRRRRRRO", "ORRRRRRRRRRRRRRO",
               "OrRRRRRRRRRRRRrO", "OOOOOOOOOOOOOOOO"],
         icon=["...OOOOOO...", "..ORRRRRRO..", "..ORRRRRRO..", ".ORRRRRRRRO.", ".ORRRRRRRRO.", "ORRRRRRRRRRO", "ORrRRrRRrRRO", "OOOOOOOOOOOO"]),   # the worn art is mostly hidden behind Lua, so the icon is drawn separately
    dict(id='boots', name='Rain Boots', slot='feet', x=0, y=14, lift=2,
         rows=["..OYO..OYO..", ".OYYO..OYYO.", ".OyyO..OyyO.", ".OOOO..OOOO."]),
    dict(id='shorts', name='Track Shorts', slot='legs', x=0, y=12,
         rows=["...OGGGGO...", "...OGggGO...", "..OGOOOOGO.."]),
    dict(id='wizard', name='Wizard Hat', slot='head', x=-2, y=-8,
         rows=["...........OO...", "..........OYYO..", ".........OVOO...", "........OVVO....", ".......OVVVO....",
               "......OVVYVO....", ".....OVVYYYVO...", "....OVVVVYVVO...", "...OVYVVVVVVVO..", "..OYYYYYYYYYYO..",
               ".OOOOOOOOOOOOOO.", "OVVVVVVVVVVVVVVO", ".OOOOOOOOOOOOOO."]),
]

# Palette skins recolour only the avatar's own pixels; clothes keep their colours.
# Classic is everyone's; the other four are earned on the unlock path.
SKINS = [
    dict(id='classic', name='Classic', pal={}),
    dict(id='mint', name='Mint', pal={'W': '#effcf5', 'L': '#c4ead6', 'P': '#7fcda6'}),
    dict(id='strawberry', name='Strawberry', pal={'W': '#fff0f3', 'L': '#f7c6d2', 'P': '#e98aa3'}),
    dict(id='midnight', name='Midnight', pal={'O': '#1f1b33', 'W': '#8f88b8', 'L': '#6a6394', 'P': '#433d6b'}),
    dict(id='gold', name='Gold', pal={'O': '#5e4416', 'W': '#fff6d6', 'L': '#f3d98a', 'P': '#d9a93c'}),
]
SKIN_BY_ID = {s['id']: s for s in SKINS}

# Costume skins (sold in the shop): complete outfits drawn over Lua. While one is on, clothes are hidden.
# Still front views on skins_costumes.png; animated sheets costume_<id>.png.
# pal: recolours for Lua's own O/W/L/P plus the costume's extra colour digits.
# eyes=None hides Lua's eyes (visor, helmet). Each layer is (z, x, y, rows), with z:
#   'back' before the body, 'body' after the body, 'hands' after the hands, 'head' after the head and eyes.
COSTUMES = [
    dict(id='soldier', name='Soldier', price='$1.99',
         pal={'1': '#6b7a3a', '2': '#4d5a2a', '3': '#8f9a55', '4': '#3b3524'},
         layers=[
             ('body', 0, 10, ['..O112211O..', '...O1131O...', '...O4444O...', '...O2112O...', '..O2OOOO2O..', '..OOO..OOO..']),
             ('hands', 0, 11, ['.O1', 'O11']),
             ('hands', 9, 11, ['1O.', '11O']),
             ('head', -1, -2, ['...OOOOOOOO...', '..O11121133O..', '.O1311121113O.', 'O112113111211O', 'OOOOOOOOOOOOOO']),
         ]),
    dict(id='samurai', name='Samurai', price='$2.99',
         pal={'1': '#b3332e', '2': '#7a2020', '3': '#2b2638'},
         layers=[
             ('body', 0, 10, ['..O1Y11Y1O..', '...O1YY1O...', '...O3333O...', '...O2YY2O...', '..O3OOOO3O..', '..OOO..OOO..']),
             ('hands', 0, 11, ['.O1', 'O11']),
             ('hands', 9, 11, ['1O.', '11O']),
             ('head', -2, -5, ['..YO........OY..', '..YYO......OYY..', '...YYO.OO.OYY...', '....OYYRRYYO....', '....OO3YY3OO....', '...O33333333O...', '..O3333333333O..', '.OO3OOOOOOOO3OO.', 'O11O........O11O', 'O12O........O21O', '.OO..........OO.']),
         ]),
    dict(id='office', name='Office Man', price='$0.99',
         pal={'1': '#3c4a63', '2': '#2a3447', '3': '#5a3a24', '4': '#7a5232'},
         layers=[
             ('body', 0, 10, ['..O1NRN1O...', '...O1RR1O...', '...O1RR1O...', '...O1111O...', '..O2OOOO2O..', '..OOO..OOO..']),
             ('hands', 0, 11, ['.O1', 'O1N']),
             ('hands', 9, 11, ['1O.', 'N1O']),
             ('head', 0, -1, ['..OOOOOOOO..', '.O33433333O.', 'O333O433333O', 'O3O......O3O']),
         ]),
    dict(id='ninja', name='Ninja', price='$2.99',
         pal={'1': '#2b2638', '2': '#1d1a27', '3': '#45405a'},
         layers=[
             ('back', 9, 1, ['...OO', '..ORO', '.ORRO', 'ORrO.', 'OOO..']),
             ('body', 0, 10, ['..O111111O..', '...O1311O...', '...ORRRRO...', '...O1111O...', '..O2OOOO2O..', '..OOO..OOO..']),
             ('hands', 0, 11, ['.O1', 'O11']),
             ('hands', 9, 11, ['1O.', '11O']),
             ('head', 0, 0, ['.OOOOOOOOOO.', 'O1111111111O', 'ORRRRRRRRRRO', 'O1111111111O', '', '', '', 'O1111111111O', 'O1111111111O', '.OOOOOOOOOO.']),
         ]),
    dict(id='spy', name='Spy', price='$2.49',
         pal={'1': '#c9a46a', '2': '#a07e48', '3': '#2b2638', '4': '#4a4458'},
         layers=[
             ('body', 0, 10, ['..O1N3N1O...', '...O1311O...', '...O2222O...', '...O1111O...', '..O3OOOO3O..', '..OOO..OOO..']),
             ('hands', 0, 11, ['.O1', 'O11']),
             ('hands', 9, 11, ['1O.', '11O']),
             ('head', -2, -3, ['....OOOOOOOO....', '...O33343333O...', '...O33333333O...', '..O4444444444O..', 'OOOOOOOOOOOOOOOO']),
             ('head', 0, 4, ['OOOOOOOOOOOO', '.O3S3OO3S3O.', '..OOO..OOO..']),
         ]),
    dict(id='student', name='Student', price='$0.99',
         pal={'1': '#4f8fe0', '2': '#2f5fa8', '3': '#5a3a24', '4': '#7a5232', '5': '#e0952a', '6': '#b06f1c'},
         layers=[
             ('back', -2, 10, ['O55O........O55O', 'O56O........O65O', 'O55O........O55O', 'OOOO........OOOO']),
             ('body', 0, 10, ['.O.NN1NNO...', '...O1111O...', '...O5115O...', '...O2222O...', '..O2OOOO2O..', '..OOO..OOO..']),
             ('hands', 0, 11, ['.O1', 'O11']),
             ('hands', 9, 11, ['1O.', '11O']),
             ('head', 0, -2, ['...O..O.O...', '..O3OO3O3O..', '.O33333333O.', 'O3343333433O', 'O33O3O33O33O']),
         ]),
    dict(id='astronaut', name='Astronaut', price='$2.99',
         pal={'1': '#f2f2f6', '2': '#c9c9d6', '3': '#e8762c', '4': '#2c3a6b', '5': '#5b7bd0'},
         eyes=None,
         layers=[
             ('back', -1, 10, ['OO..........OO', 'O2O........O2O', 'O2O........O2O', 'OOO........OOO']),
             ('body', 0, 10, ['..O111111O..', '...O3BR1O...', '...O1111O...', '...O2222O...', '..O1OOOO1O..', '..OOO..OOO..']),
             ('hands', 0, 11, ['.O1', 'O11', '.OO']),
             ('hands', 9, 11, ['1O.', '11O', 'OO.']),
             ('head', -1, -1, ['..OOOOOOOOOO..', '.O1111111111O.', 'O112222222211O', 'O12444444442OO', 'O1244S444442OO', 'O124S4444442OO', 'O124444444421O', 'O124444444421O', 'O112222222211O', '.O1111111111O.', '..O33333333O..', '...OOOOOOOO...']),
         ]),
    dict(id='knight', name='Knight', price='$2.49',
         pal={'1': '#c7ccd6', '2': '#9aa2b1', '3': '#eef0f4', '4': '#6c7383'},
         eyes=None,
         layers=[
             ('body', 0, 10, ['..O132231O..', '...O1RR1O...', '...O2RR2O...', '...O4444O...', '..O2OOOO2O..', '..OOO..OOO..']),
             ('hands', 0, 11, ['.O1', 'O12', '.OO']),
             ('hands', 9, 11, ['1O.', '21O', 'OO.']),
             ('head', 0, -4, ['....OOO.....', '...ORRrO....', '..ORRrO.....', '...OOO......']),
             ('head', 0, -1, ['.OOOOOOOOOO.', 'O3333333332O', 'O3111111112O', 'O3111111112O', 'O3111111112O', 'OOOOOOOOOOOO', 'O1KKKKKKKK2O', 'OOOOOOOOOOOO', 'O3112112112O', 'O1222222224O', '.OOOOOOOOOO.']),
         ]),
    dict(id='pirate', name='Pirate', price='$1.99',
         pal={'1': '#2b2638', '2': '#f2efe6', '3': '#7a4a2a', '4': '#5c3620'},
         layers=[
             ('body', 0, 10, ['..ORNRNRO...', '...ONRNRO...', '...O4Y44O...', '...O3333O...', '..O1OOOO1O..', '..OOO..OOO..']),
             ('hands', 0, 11, ['.OR', 'ONN']),
             ('hands', 9, 11, ['RO.', 'NNO']),
             ('head', -2, -4, ['......OOOO......', '....OO1111OO....', 'O..O11122111O..O', 'OOO1112121111OOO', 'O1111111111111YO', '.OYYYYYYYYYYYYO.', '..OOOOOOOOOOOO..']),
             ('head', 0, 3, ['OOOOOOOOOOOO', '...O1O......', '..O111O.....', '..O111O.....', '...OOO......']),
         ]),
    dict(id='chef', name='Chef', price='$0.99',
         pal={'1': '#ffffff', '2': '#dcdce6', '3': '#3d3756'},
         layers=[
             ('body', 0, 10, ['..ORRRRRRO..', '...O1RR2O...', '...O1312O...', '...O1312O...', '..O3OOOO3O..', '..OOO..OOO..']),
             ('hands', 0, 11, ['.O1', 'O12']),
             ('hands', 9, 11, ['1O.', '21O']),
             ('head', 0, -7, ['..OOO.OOO...', '.O111O111O..', 'O1111111112O', 'O1111211112O', 'O1121111112O', '.O11111112O.', '.O11211121O.', '.OOOOOOOOOO.', '.O22222222O.', '.OOOOOOOOOO.']),
         ]),
    dict(id='firefighter', name='Firefighter', price='$1.99',
         pal={'1': '#e0a630', '2': '#b07c18', '3': '#c9d23a', '4': '#d6d9e0'},
         layers=[
             ('body', 0, 10, ['..O111111O..', '...O1O11O...', '...O3333O...', '...O1111O...', '..O2OOOO2O..', '..OOO..OOO..']),
             ('hands', 0, 11, ['.O1', 'O13', '.OO']),
             ('hands', 9, 11, ['1O.', '31O', 'OO.']),
             ('head', -2, -3, ['.....OOOOOO.....', '...OORRRRRROO...', '..ORRRR44RRRRO..', '..ORRRR44RRRRO..', 'OOOOOOOOOOOOOOOO', 'OrrrrrrrrrrrrrrO', '.OOOOOOOOOOOOOO.']),
         ]),
    dict(id='doctor', name='Doctor', price='$1.49',
         pal={'1': '#ffffff', '2': '#dcdce6', '3': '#35a7c9', '4': '#267f9c', '5': '#6a6b78'},
         layers=[
             ('body', 0, 10, ['..O1533551O.', '...O1351O...', '...O1331O...', '...O1441O...', '..O4OOOO4O..', '..OOO..OOO..']),
             ('hands', 0, 11, ['.O1', 'O12']),
             ('hands', 9, 11, ['1O.', '21O']),
             ('head', 0, -2, ['....OOOO....', '...O3333O...', '..O333333O..', '.O33333333O.']),
             ('head', 0, 6, ['O.OOOOOOOO.O', 'OO33333333OO', '.O34444443O.', '..OOOOOOOO..']),
         ]),
    dict(id='cowboy', name='Cowboy', price='$1.99',
         pal={'1': '#9a6236', '2': '#6e4224', '3': '#c8894a', '4': '#4a6fa5'},
         layers=[
             ('body', 0, 10, ['..ORRRRRRO..', '...O2RR2O...', '...O2442O...', '...OyYYyO...', '..O4OOOO4O..', '..OOO..OOO..']),
             ('hands', 0, 11, ['.O4', 'O44']),
             ('hands', 9, 11, ['4O.', '44O']),
             ('head', -3, -4, ['......OO..OO......', '.....O11OO11O.....', '.....O111111O.....', '.....O111111O.....', '.....O222222O.....', 'OO..OO111111OO..OO', 'O1OO1111111111OO1O', '.O11111111111111O.', '..OOOOOOOOOOOOOO..']),
         ]),
    dict(id='robot', name='Robot', price='$2.49',
         pal={'O': '#3a3f4f', 'W': '#e3e7ee', 'L': '#b9c1cf', 'P': '#7f8a9c', '1': '#5b6475', '2': '#f2c94c'},
         eyes=None,
         layers=[
             ('body', 0, 10, ['', '', '...O1G1O...', '...OR22BO...']),
             ('head', 0, -3, ['.....OO.....', '.....RO.....', '.....OO.....']),
             ('head', 0, 4, ['..OOO..OOO..', '..OSO..OSO..', '..OOO..OOO..', '............', '...OOOOOO...']),
             ('head', 0, 1, ['', '', '', '', '', '']),
             ('head', -1, 3, ['OO..........OO', '1O..........O1', 'OO..........OO']),
         ]),
    dict(id='viking', name='Viking', price='$2.49',
         pal={'1': '#9aa2b1', '2': '#6c7383', '3': '#e0862a', '4': '#b8641a', '5': '#f2efe6', '6': '#7a5232'},
         layers=[
             ('body', 0, 10, ['..O666666O..', '...O6YY6O...', '...O6666O...', '...O2222O...', '..O6OOOO6O..', '..OOO..OOO..']),
             ('hands', 0, 11, ['.O6', 'O66']),
             ('hands', 9, 11, ['6O.', '66O']),
             ('head', -3, -4, ['O................O', 'O5O............O5O', 'O55O..OOOOOO..O55O', '.O55OO111111OO55O.', '..OO1111111111OO..', '...OYYYYYYYYYYO...', '....OOOOOOOOOO....']),
             ('head', 0, 6, ['O3333333333O', 'O3O333333O3O', 'O3343333433O', '.O33333333O.', '..O333333O..', '...OOOOOO...']),
         ]),
    dict(id='hero', name='Superhero', price='$2.99',
         pal={'1': '#3c63c9', '2': '#28449a'},
         layers=[
             ('back', -2, 10, ['.OrRRRRRRRRRRrO.', '.ORRRRRRRRRRRRO.', 'ORRRRRRRRRRRRRRO', 'OrRRRRRRRRRRRRrO', 'OOOOOOOOOOOOOOOO']),
             ('body', 0, 10, ['..O1RYR1O...', '...O1YR1O...', '...OYYYYO...', '...O1111O...', '..ORRRRRRO..', '..OOO..OOO..']),
             ('hands', 0, 11, ['.O1', 'O11', '.OO']),
             ('hands', 9, 11, ['1O.', '11O', 'OO.']),
             ('head', 0, 3, ['OOOOOOOOOOOO', 'O11.1111.11O', 'O11.1111.11O', '.OOOOOOOOOO.']),
         ]),
]
ALL_ITEMS = CLOTHES
BY_ID = {it['id']: it for it in ALL_ITEMS}
COSTUME_BY_ID = {c['id']: c for c in COSTUMES}

# The unlock path, in order. Gaps grow slowly so later rewards take longer to reach.
PATH = [
    dict(item='sneakers', xp=500), dict(item='jeans', xp=1000), dict(item='cap', xp=1500),
    dict(item='shades', xp=2000), dict(skin='mint', xp=2500), dict(item='beanie', xp=3000),
    dict(item='shorts', xp=4000), dict(item='scarf', xp=5000), dict(item='headphones', xp=6000),
    dict(skin='strawberry', xp=7000), dict(item='boots', xp=8000), dict(item='hoodie', xp=9000),
    dict(skin='midnight', xp=10000), dict(item='cape', xp=11500), dict(item='wizard', xp=13000),
    dict(skin='gold', xp=14000), dict(item='crown', xp=15000),
]
for r in PATH:
    r['id'] = r.get('item') or 'skin_' + r['skin']
    r['name'] = BY_ID[r['item']]['name'] if 'item' in r else SKIN_BY_ID[r['skin']]['name'] + ' Skin'
XP_OF = {r['id']: r['xp'] for r in PATH}

# effect colours chosen to read on the app's white background
FX = {'snow': '#a9b8dc', 'twinkle': ['#e0952a', PAL['Y']], 'burst': [PAL['P'], PAL['Y'], '#5fb8e8', PAL['G']],
      'wind': (120, 105, 160, 150), 'glint': '#ffffff', 'rain': (95, 150, 220, 200), 'notes': '#6b4fc9'}


def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def art_image(rows, scale=PX, pal=None, recolor=None):
    w, h = max(len(r) for r in rows), len(rows)
    im = Image.new('RGBA', (w * scale, h * scale), (0, 0, 0, 0))
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch == '.':
                continue
            col = hexrgb((pal or {}).get(ch) or PAL[ch])
            if recolor:
                col = recolor(col)
            im.paste(col, (i * scale, j * scale, (i + 1) * scale, (j + 1) * scale))
    return im


_layer_cache = {}


def layers_for(skin):
    if skin not in _layer_cache:
        pal = SKIN_BY_ID[skin]['pal']
        _layer_cache[skin] = {
            'head': art_image(HEAD, pal=pal), 'body': art_image(BODY, pal=pal),
            'handL': art_image(HAND_L[0], pal=pal), 'handR': art_image(HAND_R[0], pal=pal),
            'eyes': {k: art_image(v[0], pal=pal) for k, v in EYES.items()},
        }
    return _layer_cache[skin]


ITEM_IMG = {it['id']: art_image(it['rows']) for it in ALL_ITEMS}
HOOD_IMG = {it['id']: art_image(it['hood']['rows']) for it in ALL_ITEMS if 'hood' in it}
SLEEVE_IMG = {it['id']: {k: art_image(v['rows']) for k, v in it['sleeves'].items()} for it in ALL_ITEMS if 'sleeves' in it}


# ---- one avatar frame ----
def compose(items, p, skin='classic', only=None):
    """items: ids worn. p: pose dict in art-pixel units (fractions allowed).
    only: draw just this item's pixels (same positions and squash), with no avatar underneath."""
    L = layers_for(skin)
    cv = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    ox = 256 - 6 * PX + round(p.get('dx', 0) * PX)
    oy = BASELINE - 16 * PX + round(p.get('y', 0) * PX)
    q = lambda v: round(v * PX)

    def put(im, gx, gy, dx=0.0, dy=0.0, part=None):
        if only is not None and part != only:
            return
        cv.alpha_composite(im, (ox + gx * PX + q(dx), oy + gy * PX + q(dy)))

    worn = {BY_ID[i]['slot']: i for i in items}
    if 'back' in worn:                              # the cape hangs behind the body
        it = BY_ID[worn['back']]
        put(ITEM_IMG[it['id']], it['x'], it['y'], part=it['id'])
    put(L['body'], 0, 10)
    for slot in ('legs', 'top', 'feet', 'neck'):
        if slot in worn and not BY_ID[worn[slot]].get('overHands'):
            it = BY_ID[worn[slot]]
            put(ITEM_IMG[it['id']], it['x'], it['y'], p.get('itemDx', 0), 0, part=it['id'])
    put(L['handL'], HAND_L[1], HAND_L[2], 0, p.get('handL', 0))
    put(L['handR'], HAND_R[1], HAND_R[2], 0, p.get('handR', 0))
    if 'top' in worn and 'sleeves' in BY_ID[worn['top']]:   # sleeves ride on the hands
        it = BY_ID[worn['top']]
        sl = it['sleeves']
        put(SLEEVE_IMG[it['id']]['L'], sl['L']['x'], sl['L']['y'], 0, p.get('handL', 0), part=it['id'])
        put(SLEEVE_IMG[it['id']]['R'], sl['R']['x'], sl['R']['y'], 0, p.get('handR', 0), part=it['id'])
    for slot in ('legs', 'top', 'feet', 'neck'):   # items that sit across the arms
        if slot in worn and BY_ID[worn[slot]].get('overHands'):
            it = BY_ID[worn[slot]]
            put(ITEM_IMG[it['id']], it['x'], it['y'], p.get('itemDx', 0), 0, part=it['id'])
    hdy = p.get('headDy', 0)
    put(L['head'], 0, 0, 0, hdy)
    ek = p.get('eyes', 'open')
    e = EYES[ek]
    put(L['eyes'][ek], e[1], e[2], p.get('look', 0) if ek == 'open' else 0, hdy)
    if 'top' in worn and 'hood' in BY_ID[worn['top']]:   # hood over the head, under glasses and hats
        it = BY_ID[worn['top']]
        put(HOOD_IMG[it['id']], it['hood']['x'], it['hood']['y'], 0, hdy, part=it['id'])
    for slot in ('face', 'head'):
        if slot in worn:
            it = BY_ID[worn[slot]]
            put(ITEM_IMG[it['id']], it['x'], it['y'], 0, hdy, part=it['id'])

    sy = p.get('sy', 1.0)
    if abs(sy - 1) > 1e-6:                      # squash & stretch at the feet, nearest-neighbour
        sx = 1 + (1 - sy) * 0.9
        ay = BASELINE + round(p.get('y', 0) * PX)
        big = cv.resize((round(CELL * sx), round(CELL * sy)), Image.NEAREST)
        m = CELL // 2
        pad = Image.new('RGBA', (CELL + 2 * m, CELL + 2 * m), (0, 0, 0, 0))
        pad.alpha_composite(big, (m + round(256 - 256 * sx), m + round(ay - ay * sy)))
        cv = pad.crop((m, m, m + CELL, m + CELL))
    return cv


def item_layer(item_id, p):
    """Only the pixels that wearing this item changes, so body + layer == avatar wearing it.
    Item pixels never take the skin's colours, so one layer works with every skin.
    Face and head items are drawn last, over everything, so their layer is their full drawing:
    that keeps their outline where it happens to match Lua's own (and stacks correctly over the hood)."""
    if BY_ID[item_id]['slot'] in ('face', 'head'):
        return compose([item_id], p, only=item_id)
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


# ---- effects (cell pixels, crisp squares) ----
def square(im, x, y, size, col, alpha=255):
    c = hexrgb(col)[:3] + (alpha,) if isinstance(col, str) else col
    im.alpha_composite(Image.new('RGBA', (size, size), c), (int(round(x)), int(round(y))))


def snow(im, k):
    flakes = [(60, 40), (420, 70), (130, 200), (380, 250), (40, 330), (450, 380), (220, 20)]
    for i, (fx, fy) in enumerate(flakes):
        y = (fy + k * 48 + i * 7) % 470
        a = int(230 * math.sin(math.pi * y / 470))
        square(im, fx + (8 if (k + i) % 2 else 0), y, 12 if i % 2 else 8, FX['snow'], a)


def wind(im, k):
    for i, yy in enumerate((150, 230, 310)):
        x0 = 520 - ((k * 128 + i * 170) % 680)
        for s in range(0, 120, 8):
            if 0 <= x0 + s < CELL:
                square(im, x0 + s, yy, 8, FX['wind'])


def twinkle(im, k, p):
    ox = 256 - 6 * PX
    oy = BASELINE - 16 * PX + round(p.get('y', 0) * PX)
    for i, (sx, sy) in enumerate([(-1.5, -4.5), (13, -3), (-0.5, 1), (12.5, 2)]):
        a = max(0.0, math.sin(k * math.pi / 2 + i * 1.7))
        if a < 0.15:
            continue
        cx, cy = ox + sx * PX, oy + sy * PX
        r = int(PX * (0.5 + a * 0.6))
        c = hexrgb(FX['twinkle'][i % 2])[:3] + (int(255 * a),)
        im.alpha_composite(Image.new('RGBA', (2 * r, PX // 2), c), (int(cx - r), int(cy - PX // 4)))
        im.alpha_composite(Image.new('RGBA', (PX // 2, 2 * r), c), (int(cx - PX // 4), int(cy - r)))


def glint(im, step, p):
    if step < 0:
        return
    ox = 256 - 6 * PX
    oy = BASELINE - 16 * PX + round(p.get('headDy', 0) * PX)
    for lx in (2, 7):
        gx = lx + step
        square(im, ox + gx * PX, oy + 5 * PX, PX, FX['glint'])
        if step > 0:
            square(im, ox + (gx - 1) * PX, oy + 6 * PX, PX, FX['glint'])



def rain(im, k):
    """Short blue drops falling past Lua (rain boots preview)."""
    for i, (rx, ry) in enumerate([(70, 30), (150, 140), (360, 60), (440, 170), (110, 300), (400, 330), (250, 10)]):
        y = (ry + k * 60 + i * 11) % 440
        a = int(200 * math.sin(math.pi * y / 440))
        im.alpha_composite(Image.new('RGBA', (6, 26), FX['rain'][:3] + (a,)), (rx, int(y)))


def notes(im, k, p):
    """Two pixel music notes drifting up beside the head (headphones preview)."""
    ox = 256 - 6 * PX
    oy = BASELINE - 16 * PX + round(p.get('y', 0) * PX)
    c = hexrgb(FX['notes'])[:3]
    for i, (nx, ny) in enumerate([(16.0, 0.5), (-5.0, 2.5)]):
        u = ((k + 2 * i) % 4) / 4
        a = int(255 * math.sin(math.pi * (0.15 + 0.85 * u)))
        x, y = ox + nx * PX, oy + (ny - 3 * u) * PX
        col = c + (a,)
        im.alpha_composite(Image.new('RGBA', (PX, PX), col), (int(x), int(y + 2 * PX)))        # note head
        im.alpha_composite(Image.new('RGBA', (PX // 2, 2 * PX), col), (int(x + PX // 2), int(y)))  # stem
        im.alpha_composite(Image.new('RGBA', (PX, PX // 2), col), (int(x + PX // 2), int(y)))      # flag


def burst(k):
    im = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    cx, cy = 256, BASELINE - 9 * PX
    t = (0.12, 0.35, 0.62, 0.9)[k]
    for i in range(18):
        ang = i * (2 * math.pi / 18) + (0.3 if i % 2 else 0)
        dist = 40 + t * (150 + 40 * (i % 3))
        x = cx + math.cos(ang) * dist
        y = cy + math.sin(ang) * dist - 60 * t + 160 * t * t
        size = PX if i % 3 else PX // 2 + 4
        square(im, x - size / 2, y - size / 2, size, FX['burst'][i % 4], int(255 * (1 - t) ** 0.6))
    return im


# ---- animations ----
def idle_poses(eyes='open'):
    out = []
    for k in range(4):
        ph = k / 4
        b = math.sin(2 * math.pi * ph)
        out.append(dict(eyes=eyes, headDy=(1 - math.cos(2 * math.pi * ph)) * 0.12, handL=b * 0.16, handR=-b * 0.1))
    return out


BODY_ROWS = [
    ('idle', idle_poses()),
    ('blink_glance', [dict(), dict(eyes='closed'), dict(look=-1), dict(look=1)]),
    ('hop', [dict(sy=0.9, handL=0.2, handR=0.2), dict(y=-2, sy=1.06, handL=-0.3, handR=-0.3),
             dict(y=-3, eyes='happy', handL=-0.5, handR=-0.5), dict(sy=0.9, eyes='happy', handL=0.15, handR=0.15)]),
    ('happy', idle_poses('happy')),
]

POSE_SETS = {   # path reward id -> (4 poses, effect)
    'sneakers': ([dict(sy=0.9), dict(y=-1.5, sy=1.05), dict(y=-2.5, eyes='happy'), dict(y=-1)], None),
    'jeans': ([dict(), dict(dx=0.5, look=1, y=-0.3, handL=-0.2, handR=-0.2),
               dict(), dict(dx=-0.5, look=-1, y=-0.3, handL=-0.2, handR=-0.2)], None),
    'cap': ([dict(), dict(look=-1, headDy=0.15), dict(), dict(look=1, headDy=0.15)], None),
    'shades': ([dict(), dict(headDy=0.35), dict(), dict()], 'glint'),
    'beanie': ([dict(dx=-0.15, eyes='closed', handL=-0.15, handR=-0.15), dict(dx=0.15, eyes='closed', handL=-0.15, handR=-0.15),
                dict(eyes='happy'), dict(eyes='happy', headDy=0.12)], 'snow'),
    'shorts': ([dict(y=-0.6, handL=-0.3, handR=0.3), dict(), dict(y=-0.6, handL=0.3, handR=-0.3), dict()], None),
    'scarf': ([dict(eyes='closed'), dict(eyes='closed', itemDx=0.2, handL=0.1),
               dict(eyes='closed'), dict(eyes='closed', itemDx=-0.2, handL=-0.1)], 'wind'),
    'headphones': ([dict(eyes='closed', headDy=0.3), dict(eyes='closed'), dict(eyes='closed', headDy=0.3), dict(eyes='closed')], 'notes'),
    'boots': ([dict(sy=0.9), dict(y=-1), dict(sy=0.9), dict(y=-1)], 'rain'),
    'hoodie': ([dict(eyes='closed', dx=-0.15), dict(eyes='happy'), dict(eyes='closed', dx=0.15), dict(eyes='happy')], None),
    'cape': ([dict(sy=0.92, eyes='happy'), dict(y=-1.5, eyes='happy', handL=-0.4, handR=-0.4), dict(y=-1, eyes='happy'), dict(eyes='happy')], 'wind'),
    'wizard': ([dict(eyes='happy'), dict(eyes='happy', headDy=0.15), dict(eyes='happy'), dict(eyes='happy', headDy=0.15)], 'twinkle'),
    'crown': ([dict(sy=0.92, eyes='happy'), dict(y=-1.2, eyes='happy'), dict(y=-0.6, eyes='happy'), dict(eyes='happy')], 'twinkle'),
}
SKIN_REWARD_POSES = ([dict(sy=0.92), dict(y=-1.4, eyes='happy'), dict(y=-0.7, eyes='happy'), dict(eyes='happy')], 'twinkle')
PREVIEWS = [(r['id'],) + (POSE_SETS[r['item']] if 'item' in r else SKIN_REWARD_POSES) for r in PATH]


def preview_frame(reward_id, p, k, fx, skin):
    """One preview cell: Lua in the current skin wearing just this item, or Lua in the reward skin."""
    im = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    if fx == 'wind':
        wind(im, k)
    if fx == 'rain':
        rain(im, k)
    if reward_id.startswith('skin_'):
        im.alpha_composite(compose([], p, reward_id[5:]))
    else:
        im.alpha_composite(compose([reward_id], p, skin))
    if fx == 'snow':
        snow(im, k)
    if fx == 'twinkle':
        twinkle(im, k, p)
    if fx == 'glint':
        glint(im, (-1, -1, 0, 2)[k], p)
    if fx == 'notes':
        notes(im, k, p)
    return im


def new_sheet():
    return Image.new('RGBA', (CELL * COLS, CELL * ROWS), (0, 0, 0, 0))


def place(sheet, im, row, col):
    sheet.alpha_composite(im, (col * CELL, row * CELL))


def centred(im):
    cell = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    cell.alpha_composite(im, ((CELL - im.width) // 2, (CELL - im.height) // 2))
    return cell


def avatar_icon(skin, scale):
    """Static front view of the bare avatar in a skin (for skin tiles in the shop)."""
    L = {k: v for k, v in layers_for(skin).items()}
    pal = SKIN_BY_ID[skin]['pal']
    w, h = 12 * scale, 16 * scale
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for rows, gx, gy in ((BODY, 0, 10), (HAND_L[0], HAND_L[1], HAND_L[2]), (HAND_R[0], HAND_R[1], HAND_R[2]),
                         (HEAD, 0, 0), (EYES['open'][0], EYES['open'][1], EYES['open'][2])):
        im.alpha_composite(art_image(rows, scale, pal=pal), (gx * scale, gy * scale))
    return im


def compose_costume(c, p):
    """Lua wearing a costume skin in pose p (same pose keys and squash as compose)."""
    pal = c.get('pal', {})
    cv = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    ox = 256 - 6 * PX + round(p.get('dx', 0) * PX)
    oy = BASELINE - 16 * PX + round(p.get('y', 0) * PX)
    q = lambda v: round(v * PX)

    def put(rows, x, y, dx=0.0, dy=0.0):
        if any(rows):
            cv.alpha_composite(art_image(rows, pal=pal), (ox + x * PX + q(dx), oy + y * PX + q(dy)))

    def layers(z):
        return [(x, y, rows) for (lz, x, y, rows) in c['layers'] if lz == z]

    hL, hR, hdy = p.get('handL', 0), p.get('handR', 0), p.get('headDy', 0)
    for x, y, rows in layers('back'):
        put(rows, x, y)
    put(BODY, 0, 10)
    for x, y, rows in layers('body'):
        put(rows, x, y)
    put(HAND_L[0], HAND_L[1], HAND_L[2], 0, hL)
    put(HAND_R[0], HAND_R[1], HAND_R[2], 0, hR)
    for x, y, rows in layers('hands'):          # left-hand layers ride the left hand, right on the right
        put(rows, x, y, 0, hL if x < 6 else hR)
    put(HEAD, 0, 0, 0, hdy)
    if c.get('eyes', 'open'):
        ek = p.get('eyes', 'open')
        e = EYES[ek]
        put(e[0], e[1], e[2], p.get('look', 0) if ek == 'open' else 0, hdy)
    for x, y, rows in layers('head'):
        put(rows, x, y, 0, hdy)

    sy = p.get('sy', 1.0)
    if abs(sy - 1) > 1e-6:
        sx = 1 + (1 - sy) * 0.9
        ay = BASELINE + round(p.get('y', 0) * PX)
        big = cv.resize((round(CELL * sx), round(CELL * sy)), Image.NEAREST)
        m = CELL // 2
        pad = Image.new('RGBA', (CELL + 2 * m, CELL + 2 * m), (0, 0, 0, 0))
        pad.alpha_composite(big, (m + round(256 - 256 * sx), m + round(ay - ay * sy)))
        cv = pad.crop((m, m, m + CELL, m + CELL))
    return cv


def costume_frame(c):
    """Still front view of Lua wearing a costume skin, in a full 512 cell on the shared baseline."""
    return compose_costume(c, {})



# ---- damage animation ------------------------------------------------------------------------
# Drawn in Lua's style for every palette and costume skin. Each effect works on the 32 x 32
# art-pixel grid of a finished frame, then scales up x16, so it stays crisp on every skin.
# Rows: 0 hit, 1 cracked + dazed, 2 badly damaged, 3 breaking apart + knocked out.
G = 32                   # damage effects work on the 32 x 32 art-pixel grid of a frame
OX, OY = 10, 13          # head top-left in art pixels (cell 256 - 6*16 = 160 -> 10; 464 - 256 = 208 -> 13)

EYES.update({                # damage eyes
    'dot': (["OO....OO", "OO....OO"], 2, 5),
    'dizzy': ([".O....O.", "OOO..OOO", ".O....O."], 2, 4),
    'hurt': (["O......O", ".O....O.", "O......O"], 2, 4),
    'x': (["O.O..O.O", ".O....O.", "O.O..O.O"], 2, 4),
})

DIRT = ((154, 98, 54, 255), (110, 66, 36, 255))
SPARK = ((240, 140, 40, 255), (224, 82, 74, 255), (246, 196, 69, 255))
SMOKE = ((168, 164, 182, 255), (206, 203, 214, 255))
STAR = (246, 196, 69, 255)
WHITE = (255, 255, 255, 255)


def hexrgba(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


class Skin:
    def __init__(self, kind, sid):
        self.kind, self.id = kind, sid
        if kind == 'palette':
            pal = SKIN_BY_ID[sid]['pal']
            self.eyes_shown = True
        else:
            pal = COSTUME_BY_ID[sid].get('pal', {})
            self.eyes_shown = COSTUME_BY_ID[sid].get('eyes', 'open') is not None
        self.outline = hexrgba(pal.get('O', PAL['O']))

    def frame(self, **p):
        """Full pose as a 32x32 art grid."""
        if self.kind == 'palette':
            im = compose([], p, self.id)
        else:
            im = compose_costume(COSTUME_BY_ID[self.id], p)
        return im.resize((G, G), Image.NEAREST)


def up(art):
    return art.resize((CELL, CELL), Image.NEAREST)


def opaque(art, x, y):
    return 0 <= x < G and 0 <= y < G and art.getpixel((x, y))[3] > 0


def dot(art, x, y, col, only_on=False):
    if 0 <= x < G and 0 <= y < G and (not only_on or opaque(art, x, y)):
        art.putpixel((x, y), col)


def stamp(art, rows, x0, y0, colours, only_on=True):
    """Draw a small grid; letters map to colours; only over Lua's own pixels if only_on."""
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch in colours:
                dot(art, x0 + i, y0 + j, colours[ch], only_on)


def flash(art, outline, k=0.6):
    """Hit flash: Lua's fill goes almost white; the outline stays so the shape still reads on white."""
    px = art.load()
    for y in range(G):
        for x in range(G):
            r, g, b, a = px[x, y]
            if a and px[x, y] != outline:
                px[x, y] = (int(r + (255 - r) * k), int(g + (255 - g) * k), int(b + (255 - b) * k), a)


# cracks and grime, in head coordinates (12 x 10 head; 'O' crack line, a/b dirt)
CRACK_S = [".O", "O."]                                   # at head (6, 1)
CRACK_M = ["..O", "..O", ".O.", "O.."]                     # at head (5, 1)
CRACK_HEAVY = [
    "............",
    "..O..O...ab.",
    "...O.O..aa..",
    "....O.O.....",
    ".a..........",
    "ab..........",
    "............",
    "........O.a.",
    "...O...O..ab",
    "............",
]
BODY_DIRT = ["............", "...a....b...", "....b..ab...", "...ab......."]   # at body rows 10..13


def head_overlay(art, s, rows, dx=0, dy=0, x0=0, y0=0):
    stamp(art, rows, OX + dx + x0, OY + dy + y0, {'O': s.outline, 'a': DIRT[0], 'b': DIRT[1]})


def sparks(art, pts, k=0):
    for i, (x, y) in enumerate(pts):
        dot(art, x, y, SPARK[(i + k) % 3])


def smoke(art, puffs):
    for i, (x, y, size) in enumerate(puffs):
        for yy in range(size):
            for xx in range(size):
                if size == 3 and (xx, yy) in ((0, 0), (2, 0), (0, 2), (2, 2)):
                    continue
                dot(art, x + xx, y + yy, SMOKE[i % 2])


# ---- fragments: cut the frame into pieces and move them apart -------------------------------
def pieces(art, s):
    """Split a frame into head-left, head-right, body-left, body-right along jagged cuts.
    Cut edges get the skin's outline so each shard reads as its own piece."""
    head_bottom = OY + 10
    cut = lambda y: OX + (6 if y < OY + 4 or OY + 10 <= y < OY + 13 else 5)   # one step in each cut
    names = ['hl', 'hr', 'bl', 'br']
    out = {n: Image.new('RGBA', (G, G), (0, 0, 0, 0)) for n in names}
    owner = {}
    for y in range(G):
        for x in range(G):
            if not opaque(art, x, y):
                continue
            n = ('h' if y < head_bottom else 'b') + ('l' if x < cut(y) else 'r')
            owner[(x, y)] = n
            out[n].putpixel((x, y), art.getpixel((x, y)))
    for (x, y), n in owner.items():                      # outline along the cuts
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            o = owner.get((nx, ny))
            if o and o != n and o[0] == n[0]:            # only the split down the middle
                out[n].putpixel((x, y), s.outline)
                break
    return out


def place_art(dst, src, dx, dy):
    dst.alpha_composite(src, (dx, dy)) if dx >= 0 and dy >= 0 else _place_neg(dst, src, dx, dy)


def _place_neg(dst, src, dx, dy):
    big = Image.new('RGBA', (G * 3, G * 3), (0, 0, 0, 0))
    big.alpha_composite(dst, (G, G))
    big.alpha_composite(src, (G + dx, G + dy))
    dst.paste(big.crop((G, G, 2 * G, 2 * G)), (0, 0))


def shattered(s, gap, drop, spread_head, spread_body, eyes='x'):
    base = s.frame(eyes=eyes if s.eyes_shown else 'open')
    head_overlay(base, s, CRACK_HEAVY)
    stamp(base, BODY_DIRT, OX, OY + 10, {'a': DIRT[0], 'b': DIRT[1]})
    pc = pieces(base, s)
    art = Image.new('RGBA', (G, G), (0, 0, 0, 0))
    place_art(art, pc['bl'], -spread_body, drop // 2)
    place_art(art, pc['br'], spread_body, drop // 2)
    place_art(art, pc['hl'], -gap - spread_head, drop)
    place_art(art, pc['hr'], gap + spread_head, drop - 1 if drop else -1)
    return art


def collapsed(s):
    """Knocked out: the head lies on its side on the ground with X eyes, the body in chunks, smoke rising."""
    base = s.frame(eyes='x' if s.eyes_shown else 'open')
    head_overlay(base, s, CRACK_HEAVY)
    head_bottom = OY + 10
    head = base.crop((0, 0, G, head_bottom))
    bb = head.getbbox()
    head = head.crop(bb).rotate(-90, expand=True)        # exact 90 degrees: pixels stay square
    body = base.crop((0, head_bottom, G, G))
    bbb = body.getbbox()
    body = body.crop(bbb)
    art = Image.new('RGBA', (G, G), (0, 0, 0, 0))
    ground = 29
    body = body.rotate(90, expand=True)                  # the body tipped over on its side
    total = body.width + 1 + head.width
    bx = max(0, 16 - total // 2)
    hx = min(G - head.width, bx + body.width + 1)
    art.alpha_composite(body, (bx, ground - body.height))
    art.alpha_composite(head, (hx, ground - head.height))
    smoke(art, [(hx - 2, ground - head.height - 3, 3), (hx + head.width - 2, ground - head.height - 5, 2),
                (bx + 1, ground - body.height - 3, 2), (hx + head.width // 2, ground - head.height - 8, 3)])
    sparks(art, [(min(G - 1, hx + head.width), ground - 3), (max(0, bx - 1), ground - 1), (hx - 1, ground - 5)])
    return art


def impact(art, x, y):
    """A small gold-and-orange burst where the hit landed."""
    for dx, dy, c in ((1, 0, STAR), (1, -2, SPARK[0]), (1, 2, SPARK[0]), (-1, 0, SPARK[0]), (3, 0, SPARK[0]),
                      (0, -1, STAR), (2, -1, STAR), (0, 1, STAR), (2, 1, STAR)):
        dot(art, x + dx, y + dy, c)


# ---- the 16 frames ----------------------------------------------------------------------------
def damage_frames(s):
    eyes = lambda k: k if s.eyes_shown else 'open'
    rows = []

    # row 0: hit. Idle, knocked left with a flash, recover, knocked right with a flash.
    r = []
    r.append(s.frame())
    a = s.frame(dx=-1, eyes=eyes('hurt'), handL=-1, handR=-1); flash(a, s.outline)
    impact(a, OX + 13, OY + 6)
    r.append(a)
    r.append(s.frame(eyes=eyes('closed')))
    a = s.frame(dx=1, eyes=eyes('hurt'), handL=-1, handR=-1); flash(a, s.outline)
    impact(a, OX - 4, OY + 6)
    r.append(a)
    rows.append(r)

    # row 1: cracked and dazed. A crack opens at the top of the head, Lua wobbles, then sees stars.
    r = []
    a = s.frame(eyes=eyes('dot')); head_overlay(a, s, CRACK_S, x0=6, y0=1); r.append(a)
    a = s.frame(dx=-1, eyes=eyes('dot'), handL=1); head_overlay(a, s, CRACK_M, dx=-1, x0=5, y0=1); r.append(a)
    a = s.frame(dx=1, eyes=eyes('dot'), handR=1); head_overlay(a, s, CRACK_M, dx=1, x0=5, y0=1); r.append(a)
    a = s.frame(eyes=eyes('dizzy')); head_overlay(a, s, CRACK_M, x0=5, y0=1)
    for x, y in ((OX + 1, OY - 2), (OX + 6, OY - 3), (OX + 11, OY - 2)): dot(a, x, y, STAR)
    r.append(a)
    rows.append(r)

    # row 2: badly damaged. Cracks all over, grime, hands drooping, dirt chips flying off.
    r = []
    for k, (dx, e) in enumerate(((0, 'dot'), (-1, 'hurt'), (0, 'closed'), (1, 'dot'))):
        a = s.frame(dx=dx, eyes=eyes(e), handL=1, handR=1)
        head_overlay(a, s, CRACK_HEAVY, dx=dx)
        stamp(a, BODY_DIRT, OX + dx, OY + 10, {'a': DIRT[0], 'b': DIRT[1]})
        chips = [((OX - 3 - k, OY + 11 - k), DIRT[k % 2]), ((OX + 14 + k, OY + 9 - k), DIRT[(k + 1) % 2]),
                 ((OX + 13 + k // 2, OY + 13), DIRT[0])]
        for (x, y), c in chips:
            dot(a, x, y, c)
        r.append(a)
    rows.append(r)

    # row 3: breaking apart. Shards split with sparks, fall apart, then Lua lies knocked out.
    r = []
    a = shattered(s, gap=1, drop=0, spread_head=0, spread_body=0)
    sparks(a, [(OX + 6, OY - 2), (OX + 3, OY - 3), (OX + 9, OY - 1), (OX - 2, OY + 6), (OX + 13, OY + 8)])
    r.append(a)
    a = shattered(s, gap=1, drop=1, spread_head=1, spread_body=1)
    sparks(a, [(OX + 6, OY - 4), (OX + 2, OY - 3), (OX + 10, OY - 3), (OX - 3, OY + 4), (OX + 14, OY + 6)], 1)
    r.append(a)
    a = shattered(s, gap=1, drop=4, spread_head=3, spread_body=2)
    smoke(a, [(OX + 4, OY + 1, 3), (OX - 2, OY + 4, 2), (OX + 12, OY + 3, 2)])
    r.append(a)
    r.append(collapsed(s))
    rows.append(r)
    return rows


def damage_sheet(s):
    sh = new_sheet()
    for ri, r in enumerate(damage_frames(s)):
        for ci, art in enumerate(r):
            place(sh, up(art), ri, ci)
    return sh


def locked(col):
    """Greyed-out colour for locked reward icons."""
    g = int(0.3 * col[0] + 0.59 * col[1] + 0.11 * col[2])
    g = int(40 + g * 0.35)
    return (g, g, int(g * 1.08), 255)


def main():
    os.makedirs(OUT, exist_ok=True)
    for fn in os.listdir(OUT):                       # start clean so renamed sheets don't linger
        if fn.endswith('.png') or fn == 'sprites.json':
            os.remove(os.path.join(OUT, fn))
    sheets = {}
    rows_body = [n for n, _ in BODY_ROWS]
    suffix = lambda sid: '' if sid == 'classic' else '_' + sid

    # 1. a body sheet per palette skin
    for sk in SKINS:
        sh = new_sheet()
        for r, (name, poses) in enumerate(BODY_ROWS):
            for c, p in enumerate(poses):
                place(sh, compose([], p, sk['id']), r, c)
        fn = 'avatar_body%s.png' % suffix(sk['id'])
        sh.save(os.path.join(OUT, fn), optimize=True)
        sheets['avatar_body' + suffix(sk['id'])] = {'file': fn, 'rows': rows_body, 'skin': sk['id']}

    # 2. paper-doll clothes layers (same rows/frames as the body sheets; work on every palette skin)
    for it in CLOTHES:
        sh = new_sheet()
        for r, (name, poses) in enumerate(BODY_ROWS):
            for c, p in enumerate(poses):
                place(sh, item_layer(it['id'], p), r, c)
        fn = 'item_%s.png' % it['id']
        sh.save(os.path.join(OUT, fn), optimize=True)
        sheets['item_' + it['id']] = {'file': fn, 'rows': rows_body, 'layerOf': 'avatar_body (any palette skin)',
                                     'slot': it['slot'], 'name': it['name'], 'unlockXp': XP_OF[it['id']]}

    # 3. costume skins: a complete animated avatar each (no body sheet or clothes underneath)
    for c in COSTUMES:
        sh = new_sheet()
        for r, (name, poses) in enumerate(BODY_ROWS):
            for k, p in enumerate(poses):
                place(sh, compose_costume(c, p), r, k)
        fn = 'costume_%s.png' % c['id']
        sh.save(os.path.join(OUT, fn), optimize=True)
        sheets['costume_' + c['id']] = {'file': fn, 'rows': rows_body, 'name': c['name'], 'price': c['price'],
                                        'note': 'replaces avatar_body and all clothes while worn'}

    # 4. path previews, per palette skin: 17 rewards in path order, 4 per sheet, then the unlock burst
    entries = [p[0] for p in PREVIEWS] + ['unlock_burst']
    n_sheets = (len(entries) + ROWS - 1) // ROWS
    for sk in SKINS:
        for n in range(n_sheets):
            sh = new_sheet()
            names = entries[n * ROWS:(n + 1) * ROWS]
            for row, name in enumerate(names):
                if name == 'unlock_burst':
                    for c in range(4):
                        place(sh, burst(c), row, c)
                    continue
                rid, poses, fx = PREVIEWS[n * ROWS + row]
                for c, p in enumerate(poses):
                    place(sh, preview_frame(rid, p, c, fx, sk['id']), row, c)
            fn = 'preview_poses_%d%s.png' % (n + 1, suffix(sk['id']))
            sh.save(os.path.join(OUT, fn), optimize=True)
            sheets['preview_poses_%d%s' % (n + 1, suffix(sk['id']))] = {
                'file': fn, 'skin': sk['id'], 'rows': names + [None] * (ROWS - len(names))}

    # 5. icons. Clothes: unlocked and locked sheets, cells in CLOTHES order.
    for variant, rec in (('', None), ('_locked', locked)):
        sh = new_sheet()
        for i, it in enumerate(CLOTHES):
            if 'hood' in it:                               # hoodie: hood, body and sleeves drawn together
                h = it['hood']
                parts = [it.get('sleeves', {}).get('L'), it.get('sleeves', {}).get('R'), it, h]
                parts = [q for q in parts if q]
                x0, y0 = min(q['x'] for q in parts), min(q['y'] for q in parts)
                x1 = max(q['x'] + max(len(r) for r in q['rows']) for q in parts)
                y1 = max(q['y'] + len(q['rows']) for q in parts)
                im = Image.new('RGBA', ((x1 - x0) * 24, (y1 - y0) * 24), (0, 0, 0, 0))
                for q in parts:
                    im.alpha_composite(art_image(q['rows'], 24, recolor=rec), ((q['x'] - x0) * 24, (q['y'] - y0) * 24))
            else:
                art = it.get('icon', it['rows'])
                sc = min(32, 448 // max(len(r) for r in art), 448 // len(art))   # wide items (headphones) still fit the cell
                im = art_image(art, sc, recolor=rec)
            place(sh, centred(im), i // 4, i % 4)
        sh.save(os.path.join(OUT, 'item_icons%s.png' % variant), optimize=True)
        sheets['item_icons' + variant] = {'file': 'item_icons%s.png' % variant,
                                          'cells': {it['id']: [i // 4, i % 4] for i, it in enumerate(CLOTHES)}}
    # Palette skins: Classic, Mint, Strawberry, Midnight in row 0, Gold at the start of row 2;
    # row 1 holds the locked (grey) versions of the four earned skins.
    sh = new_sheet()
    cells = {}
    for i, sk in enumerate(SKINS):
        cell = [0, i] if i < 4 else [2, 0]
        place(sh, centred(avatar_icon(sk['id'], 24)), *cell)
        cells[sk['id']] = cell
    for i, sk in enumerate(SKINS[1:]):
        g = avatar_icon(sk['id'], 24)
        px = g.load()
        for yy in range(g.height):
            for xx in range(g.width):
                if px[xx, yy][3]:
                    px[xx, yy] = locked(px[xx, yy])
        place(sh, centred(g), 1, i)
        cells[sk['id'] + '_locked'] = [1, i]
    sh.save(os.path.join(OUT, 'skin_icons.png'), optimize=True)
    sheets['skin_icons'] = {'file': 'skin_icons.png', 'cells': cells}

    # 6. costume skins: one still front view per cell (shop tiles and icons)
    sh = new_sheet()
    cells = {}
    for i, c in enumerate(COSTUMES):
        place(sh, costume_frame(c), i // 4, i % 4)
        cells[c['id']] = {'name': c['name'], 'price': c['price'], 'cell': [i // 4, i % 4]}
    sh.save(os.path.join(OUT, 'skins_costumes.png'), optimize=True)
    sheets['skins_costumes'] = {'file': 'skins_costumes.png', 'cells': cells,
                                'note': 'still front view per cell, feet on baselineY like every other sheet'}

    # 7. damage animation for every skin (rows: hit, cracked + dazed, badly damaged, breaking apart)
    damage_rows = ['hit', 'cracked_dazed', 'badly_damaged', 'break_apart']
    for kind, items in (('palette', SKINS), ('costume', COSTUMES)):
        for it in items:
            sh = damage_sheet(Skin(kind, it['id']))
            fn = ('damage%s.png' % suffix(it['id'])) if kind == 'palette' else 'damage_costume_%s.png' % it['id']
            sh.save(os.path.join(OUT, fn), optimize=True)
            sheets[fn[:-4]] = {'file': fn, 'rows': damage_rows, 'skin': it['id'],
                               'note': 'whole avatar; clothes are not drawn in the damage animation'}

    manifest = {
        'sheetSize': 2048, 'cell': CELL, 'columns': COLS, 'rows': ROWS,
        'artPixel': PX, 'artGrid': 32, 'baselineY': BASELINE,
        'stackOrder': ['avatar_body[_skin]', 'back (cape)', 'legs (jeans | shorts)', 'top (hoodie)',
                       'feet (sneakers | boots)', 'neck (scarf)', 'face (shades)',
                       'head (beanie | crown | cap | wizard | headphones)'],
        'costumes': 'a costume_<id> sheet is the whole avatar: draw it instead of the body and clothes',
        'liftWhileWornCellPx': {'sneakers': 32, 'boots': 32},
        'path': [{k: v for k, v in r.items()} for r in PATH],
        'paletteSkins': [{'id': s_['id'], 'name': s_['name'], 'recolour': s_['pal'],
                          'unlockXp': XP_OF.get('skin_' + s_['id'])} for s_ in SKINS],
        'costumeSkins': [{'id': c['id'], 'name': c['name'], 'price': c['price']} for c in COSTUMES],
        'sheets': sheets,
    }
    with open(os.path.join(OUT, 'sprites.json'), 'w') as f:
        json.dump(manifest, f, indent=2)
    print('wrote', len(sheets), 'sheets to', OUT)


if __name__ == '__main__':
    main()
