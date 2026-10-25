"""Export the Lua XP Rewards art as 2048x2048 sprite sheets for React Native (v3: 17-reward path + costume shop).

Every sheet: 4 columns x 4 rows of 512x512 cells, one animation per row.
Every cell: a 32x32 art-pixel grid at exactly 16 bitmap px per art pixel.
The avatar's feet sit on the same baseline (y = 464 in the cell) in every cell of every sheet,
so layers stack and sheets swap without any offsets.

Run:  python3 make_sheets.py      (needs Pillow)
"""
import colorsys
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


def outline_for(fill):
    """Coloured outline: a darker, slightly richer shade of the colour it outlines."""
    h, sat, v = colorsys.rgb_to_hsv(*(c / 255 for c in fill[:3]))
    r, g, b = colorsys.hsv_to_rgb(h, min(1.0, sat * 1.4 + 0.25), max(0.14, min(v * 0.38, 0.34)))
    return (round(r * 255), round(g * 255), round(b * 255), 255)


def art_image(rows, scale=PX, pal=None, recolor=None):
    """Draw a pixel grid. Every 'O' (outline) pixel takes a darker shade of the fill it touches in
    this same grid, so each part is outlined in its own colour; an 'O' with no fill next to it (eyes,
    lines on their own) keeps the plain outline colour. Each layer works this out on its own, so
    layers still stack exactly."""
    w, h = max([len(r) for r in rows] + [1]), len(rows)
    im = Image.new('RGBA', (w * scale, h * scale), (0, 0, 0, 0))
    colour = lambda ch: hexrgb((pal or {}).get(ch) or PAL[ch])
    at = lambda i, j: rows[j][i] if 0 <= j < h and 0 <= i < len(rows[j]) else '.'
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch == '.':
                continue
            col = colour(ch)
            if ch == 'O':
                for ring in (((1, 0), (-1, 0), (0, 1), (0, -1)), ((1, 1), (-1, 1), (1, -1), (-1, -1))):
                    near = [at(i + dx, j + dy) for dx, dy in ring]
                    near = [c for c in near if c not in '.O']
                    if near:
                        col = outline_for(colour(max(near, key=near.count)))   # ties: the first in ring order
                        break
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
# Drawn in Lua's style for every palette and costume skin, as four seamless loops (one per
# health level, played like the idle rows): 0 hurting, 1 cracked + dazed, 2 badly damaged, 3 broken.
# Within a row the damage stays put and only small things move, by fractions of an art pixel
# (a slow bob, a sway, circling stars, falling chips, rising smoke), so the loop never jumps.
# The hands never move away from the body.
G = 32                   # art pixels per cell side
OX, OY = 10, 13          # head top-left in art pixels (cell 256 - 6*16 = 160 -> 10; 464 - 256 = 208 -> 13)

EYES.update({                # damage eyes
    'dot': (["OO....OO", "OO....OO"], 2, 5),
    'dizzy': ([".O....O.", "OOO..OOO", ".O....O."], 2, 4),
    'hurt': (["O......O", ".O....O.", "O......O"], 2, 4),
    'x': (["O.O..O.O", ".O....O.", "O.O..O.O"], 2, 4),
})

DIRT = ((154, 98, 54, 255), (110, 66, 36, 255))
SPARK = ((240, 140, 40, 255), (224, 82, 74, 255), (246, 196, 69, 255))
SMOKE = ((168, 164, 182), (206, 203, 214))
STAR = (246, 196, 69, 255)
SWEAT = (95, 175, 235, 255)

# cracks and grime in head coordinates (12 x 10 head; 'O' crack line, a/b dirt)
CRACK_M = ["..O", "..O", ".O.", "O.."]                    # at head (5, 1)
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

    def eyes(self, k):
        return k if self.eyes_shown else 'open'

    def frame(self, **p):
        """Full pose in a 512 cell (fractional offsets allowed, like the body sheets)."""
        if self.kind == 'palette':
            return compose([], p, self.id)
        return compose_costume(COSTUME_BY_ID[self.id], p)


def on_sprite(im, cx, cy):
    """True when the art pixel whose top-left is (cx, cy) in cell px is part of Lua."""
    x, y = int(cx + PX // 2), int(cy + PX // 2)
    return 0 <= x < CELL and 0 <= y < CELL and im.getpixel((x, y))[3] > 0


def stamp(im, rows, gx, gy, p, colours, part='head'):
    """Draw a small art grid onto Lua's own pixels, riding the head (or body) exactly as the pose moves it."""
    ox = 256 - 6 * PX + round(p.get('dx', 0) * PX)
    oy = BASELINE - 16 * PX + round(p.get('y', 0) * PX) + (round(p.get('headDy', 0) * PX) if part == 'head' else 0)
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch in colours:
                cx, cy = ox + (gx + i) * PX, oy + (gy + j) * PX
                if on_sprite(im, cx, cy):
                    c = colours[ch]
                    if callable(c):                                # cracks: a darker shade of what they cross
                        c = c(im.getpixel((int(cx + PX // 2), int(cy + PX // 2))))
                    im.paste(c, (cx, cy, cx + PX, cy + PX))


def blob(im, cx, cy, size, col, alpha=255):
    """A crisp square (cell px), clipped to the cell."""
    c = col[:3] + (int(alpha),)
    x0, y0 = int(round(cx)), int(round(cy))
    if x0 + size <= 0 or y0 + size <= 0 or x0 >= CELL or y0 >= CELL:
        return
    im.alpha_composite(Image.new('RGBA', (size, size), c), (max(0, x0), max(0, y0)),
                       (max(0, -x0), max(0, -y0)))


def puff(im, cx, cy, k, alpha):
    """A small pixel smoke puff (3 x 3 art px, corners cut)."""
    for xx, yy in ((1, 0), (0, 1), (1, 1), (2, 1), (1, 2)):
        blob(im, cx + xx * PX // 2, cy + yy * PX // 2, PX // 2, SMOKE[(xx + yy + k) % 2], alpha)


def bob(k, amp=0.12):
    ph = 2 * math.pi * k / 4
    return (1 - math.cos(ph)) * amp, math.sin(ph)


def damage_row_hurting(s):
    """Hurting: a slow, tired bob with a wince and a sweat drop sliding down."""
    out = []
    for k in range(4):
        hd, sw = bob(k, 0.14)
        p = dict(eyes=s.eyes('hurt'), headDy=hd)
        im = s.frame(**p)
        ox, oy = 256 - 6 * PX, BASELINE - 16 * PX
        drop_y = oy + (3.5 + k * 0.75) * PX + hd * PX            # slides 3/4 px a frame, then starts again
        a = 255 if k < 3 else 140
        blob(im, ox + 12.2 * PX, drop_y, PX // 2, SWEAT, a)
        blob(im, ox + 12.2 * PX, drop_y + PX // 2, PX // 2, SWEAT, a)
        blob(im, ox + 12.2 * PX - PX // 2, drop_y + PX // 2, PX // 2, SWEAT, a * 0.8)
        out.append(im)
    return out


def damage_row_dazed(s):
    """Cracked and dazed: a crack across the top, dot eyes, a gentle sway and three stars circling."""
    out = []
    for k in range(4):
        hd, sw = bob(k, 0.12)
        p = dict(eyes=s.eyes('dot'), headDy=hd, dx=0.25 * sw)
        im = s.frame(**p)
        stamp(im, CRACK_M, 5, 1, p, {'O': outline_for})
        ox = 256 - 6 * PX + round(p['dx'] * PX)
        oy = BASELINE - 16 * PX + round(hd * PX)
        top = min(oy, s.frame().getbbox()[1] + round(hd * PX))     # above any hat or helmet
        cx, cy = ox + 6 * PX, top - 2.2 * PX
        for i in range(3):                                         # stars move a quarter turn a frame
            ang = 2 * math.pi * (k / 4 + i / 3)
            x, y = cx + math.cos(ang) * 6.5 * PX, cy + math.sin(ang) * 1.4 * PX
            r = PX // 2
            blob(im, x - r // 2, y - r * 1.5, r, STAR); blob(im, x - r // 2, y + r // 2, r, STAR)
            blob(im, x - r * 1.5, y - r // 2, r, STAR); blob(im, x + r // 2, y - r // 2, r, STAR)
        out.append(im)
    return out


def damage_row_damaged(s):
    """Badly damaged: cracks all over and grime, a heavy slow sag, and dirt chips crumbling off."""
    out = []
    for k in range(4):
        hd, sw = bob(k, 0.2)
        p = dict(eyes=s.eyes('hurt'), headDy=hd)
        im = s.frame(**p)
        stamp(im, CRACK_HEAVY, 0, 0, p, {'O': outline_for, 'a': DIRT[0], 'b': DIRT[1]})
        stamp(im, BODY_DIRT, 0, 10, p, {'a': DIRT[0], 'b': DIRT[1]}, part='body')
        ox, oy = 256 - 6 * PX, BASELINE - 16 * PX
        for i, (x0, y0, drift) in enumerate(((-1.6, 6.5, -0.4), (12.8, 9.0, 0.4), (11.6, 2.5, 0.5))):
            u = ((k + i * 1.3) % 4) / 4                            # each chip falls on its own phase
            x = ox + (x0 + drift * u * 3) * PX
            y = oy + (y0 + u * 6) * PX
            blob(im, x, y, PX, DIRT[i % 2], 255 * (1 - u * 0.7))
        out.append(im)
    return out


def shards(art, s):
    """Split an art-grid frame into head-left, head-right, body-left, body-right along stepped cuts.
    The split down the middle gets the skin's outline so each shard reads as its own piece."""
    head_bottom = OY + 10
    cut = lambda y: OX + (6 if y < OY + 4 or OY + 10 <= y < OY + 13 else 5)
    out = {n: Image.new('RGBA', (G, G), (0, 0, 0, 0)) for n in ('hl', 'hr', 'bl', 'br')}
    owner = {}
    for y in range(G):
        for x in range(G):
            if art.getpixel((x, y))[3]:
                n = ('h' if y < head_bottom else 'b') + ('l' if x < cut(y) else 'r')
                owner[(x, y)] = n
                out[n].putpixel((x, y), art.getpixel((x, y)))
    for (x, y), n in owner.items():
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            o = owner.get((nx, ny))
            if o and o != n and o[0] == n[0]:
                out[n].putpixel((x, y), outline_for(art.getpixel((x, y))))
                break
    return out


def shift(im, dx, dy):
    """Move a full cell image by whole cell pixels (fractions of an art pixel)."""
    out = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    dx, dy = int(round(dx)), int(round(dy))
    src = im.crop((max(0, -dx), max(0, -dy), CELL - max(0, dx), CELL - max(0, dy)))
    out.alpha_composite(src, (max(0, dx), max(0, dy)))
    return out


def mask_art(art, keep):
    """Copy of an art-grid frame with only the pixels where keep(x, y) is true."""
    out = Image.new('RGBA', (G, G), (0, 0, 0, 0))
    for y in range(G):
        for x in range(G):
            if keep(x, y) and art.getpixel((x, y))[3]:
                out.putpixel((x, y), art.getpixel((x, y)))
    return out


def fine(im, x, y, col, alpha=255):
    """A half-size pixel (8 cell px) for dust and smoke, so they read finer than the sprite."""
    blob(im, x, y, PX // 2, col, alpha)


SMOKE_TONES = ((208, 204, 219), (172, 168, 189), (139, 135, 158))   # light top, middle, shaded underside


def bubble(im, cx, cy, r, alpha=225):
    """One round smoke puff of radius r half-pixels, centred at (cx, cy) in cell px: lit from the
    top left, shaded underneath, drawn on the half-pixel grid so it reads soft and round."""
    h = PX // 2
    for j in range(-r, r + 1):
        for i in range(-r, r + 1):
            d = (i + 0.5) ** 2 + (j + 0.5) ** 2
            if d > (r + 0.25) ** 2:
                continue
            light = (i + j) / (2 * max(1, r))                      # -1 top-left .. +1 bottom-right
            tone = SMOKE_TONES[0] if light < -0.35 else SMOKE_TONES[2] if light > 0.45 or d > (r - 0.6) ** 2 and j > 0 else SMOKE_TONES[1]
            blob(im, cx + i * h, cy + j * h, h, tone, alpha)


SMOKE_SHADES = ((240, 238, 246), (210, 207, 222), (176, 172, 194), (144, 140, 164))   # highlight .. shadow


def plus_puff(im, x, y, col=None, alpha=235, size='sm'):
    """A small shaded plus-shaped puff: a bright centre, lit top and left, shaded right and bottom,
    so it looks rounded. size: 'sm' (3 x 3 half-pixels), 'md' (5 x 5, a fuller rounded plus),
    'lg' (3 x 3 whole art pixels). (x, y) is the top-left of a 3-unit box; bigger sizes centre on it."""
    h = PX // 2
    if size == 'sm':
        cells, u = ((1, 1, 0), (1, 0, 1), (0, 1, 1), (2, 1, 2), (1, 2, 3)), h
    elif size == 'lg':
        cells, u = ((1, 1, 0), (1, 0, 1), (0, 1, 1), (2, 1, 2), (1, 2, 3)), PX
        x, y = x - h * 3 // 2, y - h * 3 // 2
    else:
        cells = ((2, 2, 0), (2, 0, 1), (2, 1, 1), (0, 2, 1), (1, 2, 1), (1, 1, 1),
                 (3, 2, 2), (4, 2, 2), (3, 1, 2), (1, 3, 2), (2, 3, 3), (2, 4, 3), (3, 3, 3))
        u = h
        x, y = x - h, y - h
    for dx, dy, tone in cells:
        blob(im, x + dx * u, y + dy * u, u, SMOKE_SHADES[tone], alpha)


def square_puff(im, x, y, alpha=235):
    """A tiny shaded square puff (2 x 2 half-pixels): lit corner top left, shadow bottom right."""
    h = PX // 2
    for dx, dy, tone in ((0, 0, 1), (1, 0, 2), (0, 1, 2), (1, 1, 3)):
        blob(im, x + dx * h, y + dy * h, h, SMOKE_SHADES[tone], alpha)


def wisp(im, x, y, k, count=1, drift=1):
    """A few small shaded plus puffs scattered above (x, y) in cell px, at uneven heights and
    offsets (never in a line), drifting the way drift points (-1 left, +1 right) and fading."""
    spots = [(-0.4, 2.8), (2.7, 5.6), (0.8, 8.3)]               # (sideways, up) in art px
    for i, (side, up) in enumerate(spots[:count]):
        plus_puff(im, x + drift * side * PX - PX * 3 // 4, y - up * PX, alpha=240 - i * 30)


def debris(im, s_cols, ground_px, xs):
    """Little shards and grit lying on the ground."""
    for i, x in enumerate(xs):
        col = s_cols[i % len(s_cols)]
        fine(im, x, ground_px - PX // 2, col)
        if i % 3 == 0:
            fine(im, x + PX // 2, ground_px - PX // 2, outline_for(col))
        if i % 4 == 1:
            fine(im, x, ground_px - PX, col)


CRACK_KO = [            # lighter cracks for the last row, so the X eyes stay readable
    "............",
    "......O..ab.",
    ".....O...a..",
    "......O.....",
    "............",
    "............",
    "............",
    "..........a.",
    "..O......ab.",
    "...O........",
]


def tip_over(cell_im, angle, centre=16.0):
    """Tip a figure (a full 512 cell) over to the right by angle degrees about the outer edge of its
    right foot, then set it back on the ground near the middle of the cell. A right angle is exact on
    the pixel grid; in-between angles turn Lua's pixels as solid squares, which keeps every shape intact."""
    pad = Image.new('RGBA', (CELL * 3, CELL * 3), (0, 0, 0, 0))
    pad.alpha_composite(cell_im, (CELL, CELL))
    pivot = (CELL + (OX + 12) * PX, CELL + BASELINE)
    if angle % 90 == 0:
        turned = pad.rotate(-angle, center=pivot)                   # exact quarter turns
    else:
        turned = pad.rotate(-angle, resample=Image.NEAREST, center=pivot)
    bb = turned.getbbox()
    piece = turned.crop(bb)
    out = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    x = int(round(centre * PX - piece.width / 2))
    x = max(PX, min(CELL - PX - piece.width, x))
    y = BASELINE - piece.height
    out.alpha_composite(piece, (x, y))
    return out, (x, y, x + piece.width, BASELINE)


def damage_row_broken(s):
    """Broken: Lua cracks, tips over sideways in one piece (head, body, hands and feet together), and
    the last frame shows Lua lying knocked out on its side. Play it once and hold the last frame."""
    def figure(eyes):
        im = s.frame(eyes=s.eyes(eyes))
        stamp(im, CRACK_KO, 0, 0, {}, {'O': outline_for, 'a': DIRT[0], 'b': DIRT[1]})
        stamp(im, BODY_DIRT, 0, 10, {}, {'a': DIRT[0], 'b': DIRT[1]}, part='body')
        return im

    sample = figure('x')
    fills = [c for c in (sample.getpixel(((OX + 5) * PX + 8, (OY + 6) * PX + 8)),
                         sample.getpixel(((OX + 4) * PX + 8, (OY + 12) * PX + 8))) if c[3]] or [(207, 203, 221, 255)]
    out = []
    # (tilt in degrees, eyes, where the figure's middle sits): the fall speeds up toward the ground
    for k, (angle, eyes, centre) in enumerate(((0, 'hurt', 16.0), (24, 'x', 16.6), (62, 'x', 17.0), (90, 'x', 16.5))):
        art = figure(eyes)
        if angle == 0:
            im, box = shift(art, 0, -PX // 2), None                # a little lift as the hit lands
            bb = im.getbbox()
            box = bb
        else:
            im, box = tip_over(art, angle, centre=centre)
        x0, y0, x1, y1 = box
        if k < 3:                                                  # sparks fly from the head as it goes
            hx = x1 - 3 * PX if k else (OX + 6) * PX
            hy = y0 - PX if k == 0 else y0 + PX                     # above the head, never on the face
            for i in range(6):
                ang = -math.pi / 2 + (i - 2.5) * 0.55
                d = (1.6 + k * 2.0) * PX
                sx, sy = hx + math.cos(ang) * d * 1.4, hy + math.sin(ang) * d + k * k * 0.4 * PX
                if PX <= sx <= CELL - 2 * PX and sy >= PX:              # sparks stay inside the cell
                    blob(im, sx, sy, PX if k == 0 else PX // 2, SPARK[(i + k) % 3], 255 - 60 * k)
        if k == 2:                                                 # one puff as it hits the ground
            plus_puff(im, x0 + 1 * PX, y0 - 1.8 * PX, alpha=220)
        if k == 3:                                                 # resting: uneven sparkles and grit
            for x, y, a, size in ((x0 + 1.2 * PX, y0 - 2.6 * PX, 225, 'md'),
                                  (x0 + (x1 - x0) * 0.5 + 0.9 * PX, y0 - 6.6 * PX, 235, 'sm'),
                                  (x1 - 2.2 * PX, y0 - 3.9 * PX, 230, 'lg'),
                                  (x1 + 0.4 * PX, y0 - 8.0 * PX, 170, 'sm')):
                plus_puff(im, min(x, CELL - 3 * PX), max(y, PX), alpha=a, size=size)
            debris(im, fills, 29 * PX, [x0 - 2.6 * PX, x0 - 1.1 * PX, x1 + 0.6 * PX, x1 + 2.0 * PX, x0 + 4 * PX])
        out.append(im)
    return out


DAMAGE_ROWS = ['hurting', 'cracked_dazed', 'badly_damaged', 'broken_knocked_out']   # the last row plays once and holds


def damage_sheet(s):
    sh = new_sheet()
    for ri, fn in enumerate((damage_row_hurting, damage_row_dazed, damage_row_damaged, damage_row_broken)):
        for ci, im in enumerate(fn(s)):
            place(sh, im, ri, ci)
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

    # 7. damage animation for every skin: four looping rows (hurting, cracked + dazed, badly damaged, broken)
    for kind, items in (('palette', SKINS), ('costume', COSTUMES)):
        for it in items:
            sh = damage_sheet(Skin(kind, it['id']))
            fn = ('damage%s.png' % suffix(it['id'])) if kind == 'palette' else 'damage_costume_%s.png' % it['id']
            sh.save(os.path.join(OUT, fn), optimize=True)
            sheets[fn[:-4]] = {'file': fn, 'rows': DAMAGE_ROWS, 'loops': [True, True, True, False], 'skin': it['id'],
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
