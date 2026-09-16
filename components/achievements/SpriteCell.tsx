import { Canvas, Group, Image, Oval, type SkImage } from "@shopify/react-native-skia";
import { PixelRatio } from "react-native";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import {
  ACH,
  AVATAR_GRID,
  BASELINE_ART_Y,
  ICON_GRID,
  NEAREST,
  snapToDevicePixels,
} from "@/components/achievements/theme";
import type { ArtBounds } from "@/constants/luaSprites";

/** Window inside one sheet cell, as fractions of the cell. */
type CellCrop = { x: number; y: number; w: number; h: number };

/** Fits the clothing icons, including the taller hats and wide headphones. */
const ICON_CROP: CellCrop = { x: 0.04, y: 0.1, w: 0.92, h: 0.8 };
/** Bare Lua in a skin-icon cell (12×16 art at 24 px, centred). */
export const SKIN_ICON_CROP: CellCrop = { x: 0.18, y: 0.08, w: 0.64, h: 0.84 };
/** Avatar from wizard-hat twinkles down to sneaker soles, mid-hop included. */
const PREVIEW_CROP: CellCrop = { x: 3.5 / 32, y: 3.5 / 32, w: 25 / 32, h: 27 / 32 };

type CellLayout = {
  width: number;
  height: number;
  /** dp per art pixel, whole device pixels. */
  unit: number;
  /** dp per sheet cell. */
  cell: number;
  /** Top-left of the cell in canvas coordinates. */
  x: number;
  y: number;
};

function layoutCell(width: number, crop: CellCrop, grid: number): CellLayout {
  const unit = snapToDevicePixels(width / (crop.w * grid));
  const cell = unit * grid;
  const height = Math.round((width * crop.h) / crop.w);
  return {
    width,
    height,
    unit,
    cell,
    x: PixelRatio.roundToNearestPixel(width / 2 - (crop.x + crop.w / 2) * cell),
    y: PixelRatio.roundToNearestPixel(height / 2 - (crop.y + crop.h / 2) * cell),
  };
}

export function iconHeight(width: number): number {
  return layoutCell(width, ICON_CROP, ICON_GRID).height;
}

type SpriteIconProps = {
  image: SkImage | null;
  cell: [row: number, col: number];
  width: number;
  opacity?: number;
  crop?: CellCrop;
};

export function SpriteIcon({
  image,
  cell: [row, col],
  width,
  opacity = 1,
  crop = ICON_CROP,
}: SpriteIconProps) {
  const l = layoutCell(width, crop, ICON_GRID);
  return (
    <Canvas style={{ width: l.width, height: l.height }} pointerEvents="none">
      <Group clip={{ x: l.x, y: l.y, width: l.cell, height: l.cell }} opacity={opacity}>
        <Image
          image={image}
          x={l.x - col * l.cell}
          y={l.y - row * l.cell}
          width={4 * l.cell}
          height={4 * l.cell}
          fit="fill"
          sampling={NEAREST}
        />
      </Group>
    </Canvas>
  );
}

type FittedIconProps = {
  image: SkImage | null;
  cell: [row: number, col: number];
  bounds: ArtBounds;
  boxWidth: number;
  boxHeight: number;
  /** Cap on dp per art pixel, so small items don't balloon past the big ones. */
  maxUnit: number;
  opacity?: number;
};

/** Scales one icon's opaque art to fit a fixed box, centred, like the prototype's wardrobe tiles. */
export function FittedIcon({
  image,
  cell: [row, col],
  bounds,
  boxWidth,
  boxHeight,
  maxUnit,
  opacity = 1,
}: FittedIconProps) {
  const unit = snapToDevicePixels(Math.min(maxUnit, boxWidth / bounds.w, boxHeight / bounds.h));
  const cell = unit * ICON_GRID;
  const artX = PixelRatio.roundToNearestPixel((boxWidth - bounds.w * unit) / 2);
  const artY = PixelRatio.roundToNearestPixel((boxHeight - bounds.h * unit) / 2);
  const cellX = artX - bounds.x * unit;
  const cellY = artY - bounds.y * unit;
  return (
    <Canvas style={{ width: boxWidth, height: boxHeight }} pointerEvents="none">
      <Group clip={{ x: artX, y: artY, width: bounds.w * unit, height: bounds.h * unit }} opacity={opacity}>
        <Image
          image={image}
          x={cellX - col * cell}
          y={cellY - row * cell}
          width={4 * cell}
          height={4 * cell}
          fit="fill"
          sampling={NEAREST}
        />
      </Group>
    </Canvas>
  );
}

type SpritePreviewProps = {
  image: SkImage | null;
  row: number;
  /** Column 0–3 of the row to show, stepped on the UI thread. */
  frame: SharedValue<number>;
  size: number;
};

export function SpritePreview({ image, row, frame, size }: SpritePreviewProps) {
  const { x: cellX, y: cellY, cell, unit, height } = layoutCell(size, PREVIEW_CROP, AVATAR_GRID);
  const sheetX = useDerivedValue(() => cellX - frame.value * cell);
  const baselineY = cellY + BASELINE_ART_Y * unit;

  return (
    <Canvas style={{ width: size, height }} pointerEvents="none">
      <Oval
        x={size / 2 - 5.5 * unit}
        y={baselineY - 0.8 * unit}
        width={11 * unit}
        height={1.6 * unit}
        color={ACH.shadow}
      />
      <Group clip={{ x: cellX, y: cellY, width: cell, height: cell }}>
        <Image
          image={image}
          x={sheetX}
          y={cellY - row * cell}
          width={4 * cell}
          height={4 * cell}
          fit="fill"
          sampling={NEAREST}
        />
      </Group>
    </Canvas>
  );
}

type SpriteStillProps = {
  image: SkImage | null;
  cell: [row: number, col: number];
  size: number;
};

/** One still cell from an avatar-sized sheet (costume shop tiles). */
export function SpriteStill({ image, cell: [row, col], size }: SpriteStillProps) {
  const { x: cellX, y: cellY, cell, unit, height } = layoutCell(size, PREVIEW_CROP, AVATAR_GRID);
  const baselineY = cellY + BASELINE_ART_Y * unit;

  return (
    <Canvas style={{ width: size, height }} pointerEvents="none">
      <Oval
        x={size / 2 - 5.5 * unit}
        y={baselineY - 0.8 * unit}
        width={11 * unit}
        height={1.6 * unit}
        color={ACH.shadow}
      />
      <Group clip={{ x: cellX, y: cellY, width: cell, height: cell }}>
        <Image
          image={image}
          x={cellX - col * cell}
          y={cellY - row * cell}
          width={4 * cell}
          height={4 * cell}
          fit="fill"
          sampling={NEAREST}
        />
      </Group>
    </Canvas>
  );
}
