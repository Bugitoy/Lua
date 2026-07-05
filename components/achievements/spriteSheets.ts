import {
  FilterMode,
  MipmapMode,
  Skia,
  type SkImage,
} from "@shopify/react-native-skia";
import { useEffect, useState } from "react";
import { Image } from "react-native";

import {
  AVATAR_BODY,
  ITEM_ICONS,
  ITEM_LAYERS,
  PREVIEW_SHEETS,
  type ItemId,
} from "@/constants/luaSprites";

/** Whole-number shrink factor; anything else would break the 16 px art-pixel grid. */
type Downscale = 1 | 2 | 4;

/**
 * Sheets are 2048×2048 (about 16 MB each once decoded). Each one is decoded once per app
 * session, shrunk with nearest-neighbour sampling, and shared by every component that draws it.
 */
const pending = new Map<string, Promise<SkImage | null>>();
const loaded = new Map<string, SkImage | null>();

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
    promise = decodeSheet(source, downscale).then(
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

export function useSpriteSheet(source: number, downscale: Downscale): SkImage | null {
  const [image, setImage] = useState(() => loaded.get(`${source}@${downscale}`) ?? null);

  useEffect(() => {
    let alive = true;
    void loadSheet(source, downscale).then((next) => {
      if (alive) setImage(next);
    });
    return () => {
      alive = false;
    };
  }, [source, downscale]);

  return image;
}

export type AchievementSheets = {
  body: SkImage | null;
  items: Record<ItemId, SkImage | null>;
  poses1: SkImage | null;
  poses2: SkImage | null;
  icons: SkImage | null;
};

/**
 * Avatar and preview sheets at half size (8 bitmap px per art pixel) and icons at quarter size
 * are still drawn larger than that on screen, so nothing visible is lost.
 */
export function useAchievementSheets(): AchievementSheets {
  const body = useSpriteSheet(AVATAR_BODY, 2);
  const sneakers = useSpriteSheet(ITEM_LAYERS.sneakers, 2);
  const jeans = useSpriteSheet(ITEM_LAYERS.jeans, 2);
  const shades = useSpriteSheet(ITEM_LAYERS.shades, 2);
  const beanie = useSpriteSheet(ITEM_LAYERS.beanie, 2);
  const scarf = useSpriteSheet(ITEM_LAYERS.scarf, 2);
  const crown = useSpriteSheet(ITEM_LAYERS.crown, 2);
  const poses1 = useSpriteSheet(PREVIEW_SHEETS.poses1, 2);
  const poses2 = useSpriteSheet(PREVIEW_SHEETS.poses2, 2);
  const icons = useSpriteSheet(ITEM_ICONS, 4);

  return {
    body,
    items: { sneakers, jeans, shades, beanie, scarf, crown },
    poses1,
    poses2,
    icons,
  };
}
