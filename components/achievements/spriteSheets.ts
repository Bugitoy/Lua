import {
  FilterMode,
  MipmapMode,
  Skia,
  type SkImage,
} from "@shopify/react-native-skia";
import { useEffect, useMemo, useState } from "react";
import { Image } from "react-native";

import {
  BODY_SHEETS,
  COSTUME_SHEETS,
  COSTUME_STILLS,
  ITEM_ICONS,
  ITEM_ICONS_LOCKED,
  ITEM_LAYERS,
  ITEMS,
  LAYER_ORDER,
  PREVIEW_SHEETS,
  SKIN_ICONS,
  type CostumeId,
  type ItemId,
  type PaletteSkinId,
} from "@/constants/luaSprites";
import type { AvatarLook } from "@/lib/avatarLook";

/** Whole-number shrink factor; anything else would break the 16 px art-pixel grid. */
type Downscale = 1 | 2 | 4 | 8;

type SheetEntry = { key: string; source: number; downscale: Downscale };

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

function useSpriteSheetMap(entries: SheetEntry[]): Record<string, SkImage | null> {
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
    setImages(seed);

    void Promise.all(
      list.map(async (e) => [e.key, await loadSheet(e.source, e.downscale)] as const),
    ).then((pairs) => {
      if (alive) setImages(Object.fromEntries(pairs));
    });

    return () => {
      alive = false;
    };
  }, [serialized]);

  return images;
}

export type AchievementSheets = {
  body: SkImage | null;
  items: Record<ItemId, SkImage | null>;
  costume: SkImage | null;
  previews: readonly (SkImage | null)[];
  icons: SkImage | null;
  iconsLocked: SkImage | null;
  skinIcons: SkImage | null;
  costumeStills: SkImage | null;
};

/**
 * Avatar, item, costume and preview sheets at half size (8 bitmap px per art pixel) and icons
 * at quarter size are still drawn larger than that on screen, so nothing visible is lost.
 */
export function useAchievementSheets(
  skin: PaletteSkinId,
  costume: CostumeId | null,
): AchievementSheets {
  const entries = useMemo<SheetEntry[]>(() => {
    const list: SheetEntry[] = [
      { key: `body:${skin}`, source: BODY_SHEETS[skin], downscale: 2 },
      ...ITEMS.map((item) => ({
        key: `item:${item.id}`,
        source: ITEM_LAYERS[item.id],
        downscale: 2 as const,
      })),
      ...PREVIEW_SHEETS[skin].map((source, i) => ({
        key: `preview:${skin}:${i}`,
        source,
        downscale: 2 as const,
      })),
      { key: "icons", source: ITEM_ICONS, downscale: 4 },
      { key: "iconsLocked", source: ITEM_ICONS_LOCKED, downscale: 4 },
      { key: "skinIcons", source: SKIN_ICONS, downscale: 4 },
      { key: "costumeStills", source: COSTUME_STILLS, downscale: 2 },
    ];
    if (costume) {
      list.push({ key: `costume:${costume}`, source: COSTUME_SHEETS[costume], downscale: 2 });
    }
    return list;
  }, [skin, costume]);

  const images = useSpriteSheetMap(entries);

  const items = {} as Record<ItemId, SkImage | null>;
  for (const item of ITEMS) items[item.id] = images[`item:${item.id}`] ?? null;

  return {
    body: images[`body:${skin}`] ?? null,
    items,
    costume: costume ? (images[`costume:${costume}`] ?? null) : null,
    previews: PREVIEW_SHEETS[skin].map((_, i) => images[`preview:${skin}:${i}`] ?? null),
    icons: images.icons ?? null,
    iconsLocked: images.iconsLocked ?? null,
    skinIcons: images.skinIcons ?? null,
    costumeStills: images.costumeStills ?? null,
  };
}

/**
 * Sheets for one look, bottom → top: the costume alone, or the body and each worn item.
 * Profile-picture sized avatars only need 2 bitmap px per art pixel, so these load at 1/8 size.
 */
export function useLookLayers(look: AvatarLook): (SkImage | null)[] {
  const entries: SheetEntry[] = look.costume
    ? [{ key: `costume:${look.costume}`, source: COSTUME_SHEETS[look.costume], downscale: 8 }]
    : [
        { key: `body:${look.skin}`, source: BODY_SHEETS[look.skin], downscale: 8 },
        ...LAYER_ORDER.flatMap((slot) => {
          const id = look.equipped[slot];
          return id ? [{ key: `item:${id}`, source: ITEM_LAYERS[id], downscale: 8 as const }] : [];
        }),
      ];
  const images = useSpriteSheetMap(entries);
  return entries.map((e) => images[e.key] ?? null);
}
