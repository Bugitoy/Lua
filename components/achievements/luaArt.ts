/**
 * Lua's pixel art, ported from the lua-xp-rewards prototype: the base figure, every item of
 * clothing, palette skins and costumes, plus the coloured-outline rule shared with the sprite
 * sheets. `makeLayer` turns a part into a bitmap once; the stage and the path previews then
 * draw those bitmaps live, so they move exactly like the prototype.
 */
import { Skia, type SkImage } from "@shopify/react-native-skia";

import type { CostumeId, ItemId, PaletteSkinId, Slot } from "@/constants/luaSprites";

// ------------------------------------------------------------------ art

export type Palette = Record<string, string>;

export const PAL: Palette = {
  O: "#4d485c", W: "#eeebf8", L: "#cfcbdd", P: "#ac9dc7",
  R: "#e0524a", r: "#a8393a", Y: "#f6c445", y: "#c9922a",
  B: "#4f8fe0", N: "#f6f4fb", D: "#4a6fa5", d: "#36527f",
  K: "#3d3756", S: "#9fe3ff", G: "#3fa45b", g: "#eef6ef",
  b: "#2f5fa8", V: "#6b4fc9", v: "#4a34a0", T: "#35a7c9", t: "#267f9c", U: "#6a5fa0",
};

/** Palette skins recolour the avatar's own pixels (outline, white, lavender, purple). */
export const SKIN_PAL: Record<PaletteSkinId, Palette> = {
  classic: {},
  mint: { W: "#effcf5", L: "#c4ead6", P: "#7fcda6" },
  strawberry: { W: "#fff0f3", L: "#f7c6d2", P: "#e98aa3" },
  midnight: { O: "#1f1b33", W: "#8f88b8", L: "#6a6394", P: "#433d6b" },
  gold: { O: "#5e4416", W: "#fff6d6", L: "#f3d98a", P: "#d9a93c" },
};

export type Part = { rows: string[]; x: number; y: number };

// Grid origin = top-left of the head: head rows 0-9, body rows 10-15.
export const HEAD: Part = {
  x: 0,
  y: 0,
  rows: [
    ".OOOOOOOOOO.", "OWWWWWWWWWWO", "OWLLLLLLLLWO", "OWWWWWWWWWWO", "OWLLLLLLLLPO",
    "OWLLLLLLLLPO", "OWLLLLLLLLPO", "OWLLLLLLLLPO", "OPPPPPPPPPPO", ".OOOOOOOOOO.",
  ],
};
export const BODY: Part = {
  x: 0,
  y: 10,
  rows: ["..OLLLLLLO..", "...OLLLLO...", "...OLPPLO...", "...OPPPPO...", "..OPOOOOPO..", "..OOO..OOO.."],
};
export const HAND_L: Part = { rows: [".OL", "OLL", ".OO"], x: 0, y: 11 };
export const HAND_R: Part = { rows: ["LO.", "WWO", "OO."], x: 9, y: 11 };

export type EyeKey = "open" | "closed" | "happy";
export const EYES: Record<EyeKey, Part> = {
  open: { rows: ["O....O", "O....O", "O....O"], x: 3, y: 4 },
  closed: { rows: ["OOO..OOO"], x: 2, y: 6 },
  happy: { rows: [".O....O.", "O.O..O.O"], x: 2, y: 4 },
};

export type ItemArt = Part & { slot: Slot; lift?: number; hood?: Part; sleeves?: { L: Part; R: Part } };

export const ITEM_ART: Record<ItemId, ItemArt> = {
  sneakers: { slot: "feet", x: 0, y: 14, lift: 2,
    rows: ["..OBO..OBO..", ".OBBO..OBBO.", ".ONNO..ONNO.", ".OOOO..OOOO."] },
  jeans: { slot: "legs", x: 0, y: 12,
    rows: ["...ODDDDO...", "...ODddDO...", "..ODOOOODO.."] },
  shades: { slot: "face", x: 0, y: 4,
    rows: ["..OOO..OOO..", "OOKSKOOKSKOO", "..OOO..OOO.."] },
  beanie: { slot: "head", x: 0, y: -4,
    rows: [".....OO.....", "....OWWO....", "..OOOOOOOO..", ".ORRWRRRRRO.", "ORRRRRRRRRRO", "ORRRRRRRRRRO", "OrrrrrrrrrrO", "OOOOOOOOOOOO"] },
  scarf: { slot: "neck", x: 0, y: 10,
    rows: [".OGGgGGgGGO.", "..OOOOGgOO..", ".....OgGO...", ".....OOOO..."] },
  crown: { slot: "head", x: 0, y: -5,
    rows: ["..O..OO..O..", ".OYOOYYOOYO.", ".OYYYYYYYYO.", ".OYRYYYYRYO.", ".OyyyyyyyyO."] },
  cap: { slot: "head", x: 0, y: -2,
    rows: ["...OOOOOO.....", "..OBBBBBBO....", ".OBBWBBBBBO...", "OBBBBBBBBBBO..", "ObbbbbbbbbbbbO", "OOOOOOOOOOOOOO"] },
  headphones: { slot: "head", x: -3, y: -3,
    rows: ["....KKKKKKKKKK....", "..KKKKKKKKKKKKKK..", ".KKKK........KKKK.", ".KKK..........KKK.", "OOOO..........OOOO", "ORRO..........ORRO", "ORRO..........ORRO", "ORRO..........ORRO", "OrrO..........OrrO", ".OO............OO."] },
  hoodie: { slot: "top", x: 0, y: 10,
    rows: ["..OTTTTTTO..", "...OWTTWO...", "...OTttTO..."],
    sleeves: { L: { x: 0, y: 11, rows: ["..T", "..t"] }, R: { x: 9, y: 11, rows: ["T..", "t.."] } },
    hood: { x: -1, y: -1, rows: ["..OOOOOOOOOO..", ".OTTTTTTTTTTO.", "OTOOOOOOOOOOTO", "OTO........OTO", "OTO........OTO", "OTO........OTO", "OTO........OTO", "OTO........OTO", "OTO........OTO", "OTOOOOOOOOOOTO", ".OttttttttttO.", "..OOOOOOOOOO.."] } },
  cape: { slot: "back", x: -2, y: 10,
    rows: [".ORRRRRRRRRRRRO.", ".ORRRRRRRRRRRRO.", "ORRRRRRRRRRRRRRO", "ORRRRRRRRRRRRRRO", "OrRRRRRRRRRRRRrO", "OOOOOOOOOOOOOOOO"] },
  boots: { slot: "feet", x: 0, y: 14, lift: 2,
    rows: ["..OYO..OYO..", ".OYYO..OYYO.", ".OyyO..OyyO.", ".OOOO..OOOO."] },
  shorts: { slot: "legs", x: 0, y: 12,
    rows: ["...OGGGGO...", "...OGggGO...", "..OGOOOOGO.."] },
  wizard: { slot: "head", x: -2, y: -8,
    rows: ["...........OO...", "..........OYYO..", ".........OVOO...", "........OVVO....", ".......OVVVO....",
           "......OVVYVO....", ".....OVVYYYVO...", "....OVVVVYVVO...", "...OVYVVVVVVVO..", "..OYYYYYYYYYYO..",
           ".OOOOOOOOOOOOOO.", "OVVVVVVVVVVVVVVO", ".OOOOOOOOOOOOOO."] },
};


/** Where a costume layer is drawn; "hands" layers ride the nearer hand. */
export type CostumeZ = "back" | "body" | "hands" | "head";

/** A complete outfit drawn over Lua; clothes are hidden while one is on. */
export type CostumeArt = {
  /** Recolours the costume's own digits, and Lua's own pixels for a few (the robot). */
  pal: Palette;
  /** The costume covers Lua's eyes. */
  hideEyes?: boolean;
  layers: [z: CostumeZ, x: number, y: number, rows: string[]][];
};

export const COSTUME_ART: Record<CostumeId, CostumeArt> = {
  soldier: {
    pal: {"1":"#6b7a3a","2":"#4d5a2a","3":"#8f9a55","4":"#3b3524"},
    layers: [
      ["body", 0, 10, ["..O112211O..","...O1131O...","...O4444O...","...O2112O...","..O2OOOO2O..","..OOO..OOO.."]],
      ["hands", 0, 11, [".O1","O11"]],
      ["hands", 9, 11, ["1O.","11O"]],
      ["head", -1, -2, ["...OOOOOOOO...","..O11121133O..",".O1311121113O.","O112113111211O","OOOOOOOOOOOOOO"]],
    ],
  },
  samurai: {
    pal: {"1":"#b3332e","2":"#7a2020","3":"#2b2638"},
    layers: [
      ["body", 0, 10, ["..O1Y11Y1O..","...O1YY1O...","...O3333O...","...O2YY2O...","..O3OOOO3O..","..OOO..OOO.."]],
      ["hands", 0, 11, [".O1","O11"]],
      ["hands", 9, 11, ["1O.","11O"]],
      ["head", -2, -5, ["..YO........OY..","..YYO......OYY..","...YYO.OO.OYY...","....OYYRRYYO....","....OO3YY3OO....","...O33333333O...","..O3333333333O..",".OO3OOOOOOOO3OO.","O11O........O11O","O12O........O21O",".OO..........OO."]],
    ],
  },
  office: {
    pal: {"1":"#3c4a63","2":"#2a3447","3":"#5a3a24","4":"#7a5232"},
    layers: [
      ["body", 0, 10, ["..O1NRN1O...","...O1RR1O...","...O1RR1O...","...O1111O...","..O2OOOO2O..","..OOO..OOO.."]],
      ["hands", 0, 11, [".O1","O1N"]],
      ["hands", 9, 11, ["1O.","N1O"]],
      ["head", 0, -1, ["..OOOOOOOO..",".O33433333O.","O333O433333O","O3O......O3O"]],
    ],
  },
  ninja: {
    pal: {"1":"#2b2638","2":"#1d1a27","3":"#45405a"},
    layers: [
      ["back", 9, 1, ["...OO","..ORO",".ORRO","ORrO.","OOO.."]],
      ["body", 0, 10, ["..O111111O..","...O1311O...","...ORRRRO...","...O1111O...","..O2OOOO2O..","..OOO..OOO.."]],
      ["hands", 0, 11, [".O1","O11"]],
      ["hands", 9, 11, ["1O.","11O"]],
      ["head", 0, 0, [".OOOOOOOOOO.","O1111111111O","ORRRRRRRRRRO","O1111111111O","","","","O1111111111O","O1111111111O",".OOOOOOOOOO."]],
    ],
  },
  spy: {
    pal: {"1":"#c9a46a","2":"#a07e48","3":"#2b2638","4":"#4a4458"},
    layers: [
      ["body", 0, 10, ["..O1N3N1O...","...O1311O...","...O2222O...","...O1111O...","..O3OOOO3O..","..OOO..OOO.."]],
      ["hands", 0, 11, [".O1","O11"]],
      ["hands", 9, 11, ["1O.","11O"]],
      ["head", -2, -3, ["....OOOOOOOO....","...O33343333O...","...O33333333O...","..O4444444444O..","OOOOOOOOOOOOOOOO"]],
      ["head", 0, 4, ["OOOOOOOOOOOO",".O3S3OO3S3O.","..OOO..OOO.."]],
    ],
  },
  student: {
    pal: {"1":"#4f8fe0","2":"#2f5fa8","3":"#5a3a24","4":"#7a5232","5":"#e0952a","6":"#b06f1c"},
    layers: [
      ["back", -2, 10, ["O55O........O55O","O56O........O65O","O55O........O55O","OOOO........OOOO"]],
      ["body", 0, 10, [".O.NN1NNO...","...O1111O...","...O5115O...","...O2222O...","..O2OOOO2O..","..OOO..OOO.."]],
      ["hands", 0, 11, [".O1","O11"]],
      ["hands", 9, 11, ["1O.","11O"]],
      ["head", 0, -2, ["...O..O.O...","..O3OO3O3O..",".O33333333O.","O3343333433O","O33O3O33O33O"]],
    ],
  },
  astronaut: {
    pal: {"1":"#f2f2f6","2":"#c9c9d6","3":"#e8762c","4":"#2c3a6b","5":"#5b7bd0"},
    hideEyes: true,
    layers: [
      ["back", -1, 10, ["OO..........OO","O2O........O2O","O2O........O2O","OOO........OOO"]],
      ["body", 0, 10, ["..O111111O..","...O3BR1O...","...O1111O...","...O2222O...","..O1OOOO1O..","..OOO..OOO.."]],
      ["hands", 0, 11, [".O1","O11",".OO"]],
      ["hands", 9, 11, ["1O.","11O","OO."]],
      ["head", -1, -1, ["..OOOOOOOOOO..",".O1111111111O.","O112222222211O","O12444444442OO","O1244S444442OO","O124S4444442OO","O124444444421O","O124444444421O","O112222222211O",".O1111111111O.","..O33333333O..","...OOOOOOOO..."]],
    ],
  },
  knight: {
    pal: {"1":"#c7ccd6","2":"#9aa2b1","3":"#eef0f4","4":"#6c7383"},
    hideEyes: true,
    layers: [
      ["body", 0, 10, ["..O132231O..","...O1RR1O...","...O2RR2O...","...O4444O...","..O2OOOO2O..","..OOO..OOO.."]],
      ["hands", 0, 11, [".O1","O12",".OO"]],
      ["hands", 9, 11, ["1O.","21O","OO."]],
      ["head", 0, -4, ["....OOO.....","...ORRrO....","..ORRrO.....","...OOO......"]],
      ["head", 0, -1, [".OOOOOOOOOO.","O3333333332O","O3111111112O","O3111111112O","O3111111112O","OOOOOOOOOOOO","O1KKKKKKKK2O","OOOOOOOOOOOO","O3112112112O","O1222222224O",".OOOOOOOOOO."]],
    ],
  },
  pirate: {
    pal: {"1":"#2b2638","2":"#f2efe6","3":"#7a4a2a","4":"#5c3620"},
    layers: [
      ["body", 0, 10, ["..ORNRNRO...","...ONRNRO...","...O4Y44O...","...O3333O...","..O1OOOO1O..","..OOO..OOO.."]],
      ["hands", 0, 11, [".OR","ONN"]],
      ["hands", 9, 11, ["RO.","NNO"]],
      ["head", -2, -4, ["......OOOO......","....OO1111OO....","O..O11122111O..O","OOO1112121111OOO","O1111111111111YO",".OYYYYYYYYYYYYO.","..OOOOOOOOOOOO.."]],
      ["head", 0, 3, ["OOOOOOOOOOOO","...O1O......","..O111O.....","..O111O.....","...OOO......"]],
    ],
  },
  chef: {
    pal: {"1":"#ffffff","2":"#dcdce6","3":"#3d3756"},
    layers: [
      ["body", 0, 10, ["..ORRRRRRO..","...O1RR2O...","...O1312O...","...O1312O...","..O3OOOO3O..","..OOO..OOO.."]],
      ["hands", 0, 11, [".O1","O12"]],
      ["hands", 9, 11, ["1O.","21O"]],
      ["head", 0, -7, ["..OOO.OOO...",".O111O111O..","O1111111112O","O1111211112O","O1121111112O",".O11111112O.",".O11211121O.",".OOOOOOOOOO.",".O22222222O.",".OOOOOOOOOO."]],
    ],
  },
  firefighter: {
    pal: {"1":"#e0a630","2":"#b07c18","3":"#c9d23a","4":"#d6d9e0"},
    layers: [
      ["body", 0, 10, ["..O111111O..","...O1O11O...","...O3333O...","...O1111O...","..O2OOOO2O..","..OOO..OOO.."]],
      ["hands", 0, 11, [".O1","O13",".OO"]],
      ["hands", 9, 11, ["1O.","31O","OO."]],
      ["head", -2, -3, [".....OOOOOO.....","...OORRRRRROO...","..ORRRR44RRRRO..","..ORRRR44RRRRO..","OOOOOOOOOOOOOOOO","OrrrrrrrrrrrrrrO",".OOOOOOOOOOOOOO."]],
    ],
  },
  doctor: {
    pal: {"1":"#ffffff","2":"#dcdce6","3":"#35a7c9","4":"#267f9c","5":"#6a6b78"},
    layers: [
      ["body", 0, 10, ["..O1533551O.","...O1351O...","...O1331O...","...O1441O...","..O4OOOO4O..","..OOO..OOO.."]],
      ["hands", 0, 11, [".O1","O12"]],
      ["hands", 9, 11, ["1O.","21O"]],
      ["head", 0, -2, ["....OOOO....","...O3333O...","..O333333O..",".O33333333O."]],
      ["head", 0, 6, ["O.OOOOOOOO.O","OO33333333OO",".O34444443O.","..OOOOOOOO.."]],
    ],
  },
  cowboy: {
    pal: {"1":"#9a6236","2":"#6e4224","3":"#c8894a","4":"#4a6fa5"},
    layers: [
      ["body", 0, 10, ["..ORRRRRRO..","...O2RR2O...","...O2442O...","...OyYYyO...","..O4OOOO4O..","..OOO..OOO.."]],
      ["hands", 0, 11, [".O4","O44"]],
      ["hands", 9, 11, ["4O.","44O"]],
      ["head", -3, -4, ["......OO..OO......",".....O11OO11O.....",".....O111111O.....",".....O111111O.....",".....O222222O.....","OO..OO111111OO..OO","O1OO1111111111OO1O",".O11111111111111O.","..OOOOOOOOOOOOOO.."]],
    ],
  },
  robot: {
    pal: {"1":"#5b6475","2":"#f2c94c","O":"#3a3f4f","W":"#e3e7ee","L":"#b9c1cf","P":"#7f8a9c"},
    hideEyes: true,
    layers: [
      ["body", 0, 10, ["","","...O1G1O...","...OR22BO..."]],
      ["head", 0, -3, [".....OO.....",".....RO.....",".....OO....."]],
      ["head", 0, 4, ["..OOO..OOO..","..OSO..OSO..","..OOO..OOO..","............","...OOOOOO..."]],
      ["head", 0, 1, ["","","","","",""]],
      ["head", -1, 3, ["OO..........OO","1O..........O1","OO..........OO"]],
    ],
  },
  viking: {
    pal: {"1":"#9aa2b1","2":"#6c7383","3":"#e0862a","4":"#b8641a","5":"#f2efe6","6":"#7a5232"},
    layers: [
      ["body", 0, 10, ["..O666666O..","...O6YY6O...","...O6666O...","...O2222O...","..O6OOOO6O..","..OOO..OOO.."]],
      ["hands", 0, 11, [".O6","O66"]],
      ["hands", 9, 11, ["6O.","66O"]],
      ["head", -3, -4, ["O................O","O5O............O5O","O55O..OOOOOO..O55O",".O55OO111111OO55O.","..OO1111111111OO..","...OYYYYYYYYYYO...","....OOOOOOOOOO...."]],
      ["head", 0, 6, ["O3333333333O","O3O333333O3O","O3343333433O",".O33333333O.","..O333333O..","...OOOOOO..."]],
    ],
  },
  hero: {
    pal: {"1":"#3c63c9","2":"#28449a"},
    layers: [
      ["back", -2, 10, [".OrRRRRRRRRRRrO.",".ORRRRRRRRRRRRO.","ORRRRRRRRRRRRRRO","OrRRRRRRRRRRRRrO","OOOOOOOOOOOOOOOO"]],
      ["body", 0, 10, ["..O1RYR1O...","...O1YR1O...","...OYYYYO...","...O1111O...","..ORRRRRRO..","..OOO..OOO.."]],
      ["hands", 0, 11, [".O1","O11",".OO"]],
      ["hands", 9, 11, ["1O.","11O","OO."]],
      ["head", 0, 3, ["OOOOOOOOOOOO","O11.1111.11O","O11.1111.11O",".OOOOOOOOOO."]],
    ],
  },
};

// ------------------------------------------------------------------ layer bitmaps

/** An "O" pixel takes a darker, richer shade of the fill it touches (same rule as the sheets). */
function outlineFor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0;
  if (mx !== mn) {
    s = (mx - mn) / mx;
    const rc = (mx - r) / (mx - mn), gc = (mx - g) / (mx - mn), bc = (mx - b) / (mx - mn);
    h = r === mx ? bc - gc : g === mx ? 2 + rc - bc : 4 + gc - rc;
    h = (((h / 6) % 1) + 1) % 1;
  }
  const s2 = Math.min(1, s * 1.4 + 0.25), v2 = Math.max(0.14, Math.min(mx * 0.38, 0.34));
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = v2 * (1 - s2), q = v2 * (1 - s2 * f), t = v2 * (1 - s2 * (1 - f));
  const rgb = [[v2, t, p], [q, v2, p], [p, v2, t], [p, q, v2], [t, p, v2], [v2, p, q]][((i % 6) + 6) % 6];
  return "#" + rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("");
}

const RINGS = [
  [[1, 0], [-1, 0], [0, 1], [0, -1]],
  [[1, 1], [-1, 1], [1, -1], [-1, -1]],
];

/** A part drawn as a bitmap; `x`, `y`, `w`, `h` are in art pixels. */
export type Layer = { image: SkImage; x: number; y: number; w: number; h: number };

const layerCache = new Map<string, Layer | null>();

/** One resolved pixel of a part, in art px from the part's top-left. */
type PartPixel = { i: number; j: number; color: string };

/** A part's pixels with colours resolved, outlines taking a shade of the fill they touch. */
function partPixels(part: Part, pal: Palette | null): PartPixel[] {
  const { rows } = part;
  const h = rows.length;
  const colour = (ch: string) => (pal && pal[ch]) || PAL[ch];
  const at = (i: number, j: number) => (j >= 0 && j < h && i >= 0 && i < rows[j].length ? rows[j][i] : ".");
  const out: PartPixel[] = [];
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === ".") continue;
      let fill = colour(ch);
      if (ch === "O") {
        for (const ring of RINGS) {
          const near = ring.map(([dx, dy]) => at(i + dx, j + dy)).filter((q) => q !== "." && q !== "O");
          if (near.length) {
            const counts: Record<string, number> = {};
            near.forEach((q) => { counts[q] = (counts[q] || 0) + 1; });
            const best = Object.keys(counts).sort(
              (a, b) => counts[b] - counts[a] || near.indexOf(a) - near.indexOf(b),
            )[0];
            fill = outlineFor(colour(best));
            break;
          }
        }
      }
      out.push({ i, j, color: fill });
    }
  });
  return out;
}

function bitmap(pixels: PartPixel[], w: number, h: number, scale: number): SkImage | null {
  const surface = Skia.Surface.Make(w * scale, h * scale);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  for (const { i, j, color } of pixels) {
    paint.setColor(Skia.Color(color));
    canvas.drawRect(Skia.XYWHRect(i * scale, j * scale, scale, scale), paint);
  }
  const image = surface.makeImageSnapshot();
  surface.dispose();
  return image;
}

/**
 * Renders `part` at `scale` bitmap px per art pixel. `pal` overrides PAL colours (a palette
 * skin or a costume); `palKey` names it for the cache. Empty parts give null.
 */
export function makeLayer(
  part: Part,
  scale: number,
  pal: Palette | null = null,
  palKey = "",
): Layer | null {
  const key = `${part.rows.join("/")}@${part.x},${part.y}@${scale}@${palKey}`;
  const cached = layerCache.get(key);
  if (cached !== undefined) return cached;

  const { rows } = part;
  let layer: Layer | null = null;
  if (rows.some((r) => r.length)) {
    const w = Math.max(1, ...rows.map((r) => r.length));
    const image = bitmap(partPixels(part, pal), w, rows.length, scale);
    if (image) layer = { image, x: part.x, y: part.y, w, h: rows.length };
  }
  layerCache.set(key, layer);
  return layer;
}

// ------------------------------------------------------------------ still looks

/** Drawn with the body, under the hands. */
const BODY_SLOTS: Slot[] = ["legs", "top", "feet", "neck"];
/** Drawn on the head, over the eyes. */
const HEAD_SLOTS: Slot[] = ["face", "head"];

/** What a Lua avatar wears; matches `AvatarLook` in lib/avatarLook. */
type Look = {
  skin: PaletteSkinId;
  costume: CostumeId | null;
  equipped: Partial<Record<Slot, ItemId>>;
};

/**
 * Lua standing still in `look`, as bitmaps bottom → top at `scale` bitmap px per art pixel,
 * plus how many art px the figure stands raised on shoe soles. Same stacking as the stage.
 */
export function lookLayers(look: Look, scale: number): { layers: Layer[]; lift: number } {
  const art = look.costume ? COSTUME_ART[look.costume] : null;
  const pal = art ? art.pal : SKIN_PAL[look.skin];
  const palKey = art ? `costume:${look.costume}` : look.skin;
  const out: (Layer | null)[] = [];
  const base = (part: Part) => out.push(makeLayer(part, scale, pal, palKey));

  if (art) {
    const z = (want: CostumeZ, hand?: "L" | "R") => {
      for (const [lz, x, y, rows] of art.layers) {
        if (lz !== want || (hand && (x < 6 ? "L" : "R") !== hand)) continue;
        out.push(makeLayer({ rows, x, y }, scale, art.pal, palKey));
      }
    };
    z("back");
    base(BODY);
    z("body");
    base(HAND_L);
    base(HAND_R);
    z("hands", "L");
    z("hands", "R");
    base(HEAD);
    if (!art.hideEyes) base(EYES.open);
    z("head");
    return { layers: out.filter((l): l is Layer => l !== null), lift: 0 };
  }

  const worn = (slot: Slot) => {
    const id = look.equipped[slot];
    return id ? ITEM_ART[id] : null;
  };
  const back = worn("back");
  if (back) out.push(makeLayer(back, scale));
  base(BODY);
  for (const slot of BODY_SLOTS) {
    const it = worn(slot);
    if (it) out.push(makeLayer(it, scale));
  }
  base(HAND_L);
  base(HAND_R);
  const top = worn("top");
  if (top?.sleeves) {
    out.push(makeLayer(top.sleeves.L, scale), makeLayer(top.sleeves.R, scale));
  }
  base(HEAD);
  base(EYES.open);
  if (top?.hood) out.push(makeLayer(top.hood, scale));
  for (const slot of HEAD_SLOTS) {
    const it = worn(slot);
    if (it) out.push(makeLayer(it, scale));
  }
  return {
    layers: out.filter((l): l is Layer => l !== null),
    lift: worn("feet")?.lift ?? 0,
  };
}
