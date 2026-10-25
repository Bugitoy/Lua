import {
  FilterMode,
  MipmapMode,
  Skia,
  type SkImage,
} from "@shopify/react-native-skia";
import { useEffect, useMemo, useState } from "react";
import { Image } from "react-native";

import { COSTUME_STILLS, ITEM_ICONS, ITEM_ICONS_LOCKED, SKIN_ICONS } from "@/constants/luaSprites";

/** Whole-number shrink factor; anything else would break the 16 px art-pixel grid. */
type Downscale = 1 | 2 | 4 | 8;

type SheetEntry = { key: string; source: number; downscale: Downscale };

/**
 * Sheets are 1024×1024 (512 for icons), about 4 MB each once decoded. Each one is decoded once
 * per app session, shrunk with nearest-neighbour sampling if asked, and shared by every
 * component that draws it.
 */
const pending = new Map<string, Promise<SkImage | null>>();
const loaded = new Map<string, SkImage | null>();

/**
 * Decoding runs on the JS thread, so sheets decode one at a time with a macrotask between
 * them: taps and frames get handled in the gaps instead of the screen freezing for the batch.
 */
let decodeQueue: Promise<unknown> = Promise.resolve();

function queueDecode(source: number, downscale: Downscale): Promise<SkImage | null> {
  const run = decodeQueue
    .then(() => new Promise<void>((resolve) => setTimeout(resolve, 0)))
    .then(() => decodeSheet(source, downscale));
  decodeQueue = run.catch(() => undefined);
  return run;
}

async function decodeSheet(source: number, downscale: Downscale): Promise<SkImage | null> {
  const data = await Skia.Data.fromURI(Image.resolveAssetSource(source).uri);
  const full = Skia.Image.MakeImageFromEncoded(data);
  data.dispose();
  if (!full || downscale === 1) return full;

  const w = full.width() / downscale;
  const h = full.height() / downscale;
  const surface = Skia.Surface.Make(w, h);
  if (!surface) return full;
  surface
    .getCanvas()
    .drawImageRectOptions(
      full,
      Skia.XYWHRect(0, 0, full.width(), full.height()),
      Skia.XYWHRect(0, 0, w, h),
      FilterMode.Nearest,
      MipmapMode.None,
    );
  const small = surface.makeImageSnapshot();
  surface.dispose();
  full.dispose();
  return small;
}

function loadSheet(source: number, downscale: Downscale): Promise<SkImage | null> {
  const key = `${source}@${downscale}`;
  let promise = pending.get(key);
  if (!promise) {
    promise = queueDecode(source, downscale).then(
      (image) => {
        loaded.set(key, image);
        return image;
      },
      (error: unknown) => {
        pending.delete(key);
        if (__DEV__) console.warn("Could not load sprite sheet", error);
        return null;
      },
    );
    pending.set(key, promise);
  }
  return promise;
}

type SheetMap = Record<string, SkImage | null>;

function sameSheets(a: SheetMap, b: SheetMap): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}

function useSpriteSheetMap(entries: SheetEntry[]): SheetMap {
  const serialized = JSON.stringify(entries);
  const [images, setImages] = useState<Record<string, SkImage | null>>(() => {
    const seed: Record<string, SkImage | null> = {};
    for (const e of entries) {
      const cached = loaded.get(`${e.source}@${e.downscale}`);
      if (cached !== undefined) seed[e.key] = cached;
    }
    return seed;
  });

  useEffect(() => {
    let alive = true;
    const list = JSON.parse(serialized) as SheetEntry[];

    const seed: Record<string, SkImage | null> = {};
    for (const e of list) {
      const cached = loaded.get(`${e.source}@${e.downscale}`);
      if (cached !== undefined) seed[e.key] = cached;
    }
    // Keep the same object when nothing changed, so the screen doesn't re-render for it.
    setImages((prev) => (sameSheets(prev, seed) ? prev : seed));

    void Promise.all(
      list.map(async (e) => [e.key, await loadSheet(e.source, e.downscale)] as const),
    ).then((pairs) => {
      if (!alive) return;
      const next: SheetMap = Object.fromEntries(pairs);
      setImages((prev) => (sameSheets(prev, next) ? prev : next));
    });

    return () => {
      alive = false;
    };
  }, [serialized]);

  return images;
}

export type AchievementSheets = {
  icons: SkImage | null;
  iconsLocked: SkImage | null;
  skinIcons: SkImage | null;
  costumeStills: SkImage | null;
};

const ACHIEVEMENT_ENTRIES: SheetEntry[] = [
  { key: "icons", source: ITEM_ICONS, downscale: 1 },
  { key: "iconsLocked", source: ITEM_ICONS_LOCKED, downscale: 1 },
  { key: "skinIcons", source: SKIN_ICONS, downscale: 1 },
  { key: "costumeStills", source: COSTUME_STILLS, downscale: 1 },
];

/**
 * Icon and still sheets for the wardrobe, path badges, shop and toasts. The avatar and the
 * path previews are drawn live from pixel art (stageArt.ts, previewArt.ts), so need none.
 */
export function useAchievementSheets(): AchievementSheets {
  const images = useSpriteSheetMap(ACHIEVEMENT_ENTRIES);

  // One object per change in loaded sheets, so memoized children can skip re-renders.
  return useMemo(
    () => ({
      icons: images.icons ?? null,
      iconsLocked: images.iconsLocked ?? null,
      skinIcons: images.skinIcons ?? null,
      costumeStills: images.costumeStills ?? null,
    }),
    [images],
  );
}
