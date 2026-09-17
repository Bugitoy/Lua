import { Canvas, Group, Image, Oval, type SkImage } from "@shopify/react-native-skia";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { PixelRatio, Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  runOnUI,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { SKIN_ICON_CROP, SpriteIcon, SpriteStill } from "@/components/achievements/SpriteCell";
import type { AchievementSheets } from "@/components/achievements/spriteSheets";
import {
  ACH,
  AVATAR_GRID,
  BASELINE_ART_Y,
  NEAREST,
  snapToDevicePixels,
} from "@/components/achievements/theme";
import { Pixelify } from "@/constants/fonts";
import {
  AVATAR_ROWS,
  COSTUME_CELLS,
  ICON_CELLS,
  ITEMS,
  LAYER_ORDER,
  SHOE_ITEMS,
  SKIN_ICON_CELLS,
  UNLOCK_BURST,
  type CostumeId,
  type ItemId,
  type PaletteSkinId,
} from "@/constants/luaSprites";
import { ITEM_BY_ID, type Equipped } from "@/lib/achievementsStore";

/** Item sheets bottom → top; several items share a slot, only the worn one is visible. */
const DRAW_ORDER: ItemId[] = LAYER_ORDER.flatMap((slot) =>
  ITEMS.filter((item) => item.slot === slot).map((item) => item.id),
);

/** Vertical centre of each item in its cell, in art px. Pops scale around it, sparkles burst from it. */
const ITEM_CENTER_Y: Record<ItemId, number> = {
  sneakers: 29,
  jeans: 26.5,
  cap: 14,
  shades: 18.5,
  beanie: 13,
  shorts: 26.5,
  scarf: 25,
  headphones: 15,
  boots: 29,
  hoodie: 18,
  cape: 26,
  wizard: 11.5,
  crown: 10.5,
};
const BURST_CENTER_Y = BASELINE_ART_Y - 9;

/** Frames are encoded as row * 4 + col. */
const FRAME_BLINK = AVATAR_ROWS.blinkGlance * 4 + 1;
const FRAME_LOOK_LEFT = AVATAR_ROWS.blinkGlance * 4 + 2;
const FRAME_LOOK_RIGHT = AVATAR_ROWS.blinkGlance * 4 + 3;
const FRAME_HOP_RISE = AVATAR_ROWS.hop * 4 + 1;
const FRAME_HOP_APEX = AVATAR_ROWS.hop * 4 + 2;

const IDLE_CYCLE_MS = 2600;
const BLINK_MS = 130;
const BLINK_GAP_MS = [2200, 5400] as const;
const GLANCE_MS = 700;
const GLANCE_GAP_MS = [4000, 8000] as const;
/** Squash, rise, apex with happy eyes, land squash, settle — [end ms, frame]. */
const HOP_STEPS = [
  [140, AVATAR_ROWS.hop * 4],
  [320, FRAME_HOP_RISE],
  [520, FRAME_HOP_APEX],
  [680, AVATAR_ROWS.hop * 4 + 3],
  [850, AVATAR_ROWS.happy * 4],
] as const;
const HOP_MS = HOP_STEPS[HOP_STEPS.length - 1][0];
const BURST_FRAME_MS = 110;

const ITEM_ANIM_MS = 350;
const DROP_MS = 900;
const DROP_FROM_ART_PX = 9;
const TOAST_MS = 2600;

function randomBetween([min, max]: readonly [number, number]): number {
  "worklet";
  return min + Math.random() * (max - min);
}

type ItemLayerHandle = { prepareDrop: () => void };

type ItemLayerProps = {
  ref: Ref<ItemLayerHandle>;
  image: SkImage | null;
  worn: boolean;
  centerY: number;
  cell: number;
  unit: number;
  sheetX: SharedValue<number>;
  sheetY: SharedValue<number>;
  reduceMotion: boolean;
};

function ItemLayer({
  ref,
  image,
  worn,
  centerY,
  cell,
  unit,
  sheetX,
  sheetY,
  reduceMotion,
}: ItemLayerProps) {
  const opacity = useSharedValue(worn ? 1 : 0);
  /** Art px; negative is up. */
  const offsetY = useSharedValue(0);
  const scale = useSharedValue(1);
  /** What the layer currently shows, which can run ahead of `worn` during an unlock drop. */
  const shown = useRef(worn);
  const pendingDrop = useRef(false);

  const playDrop = () => {
    shown.current = true;
    scale.value = 1;
    if (reduceMotion) {
      offsetY.value = 0;
      opacity.value = withTiming(1, { duration: ITEM_ANIM_MS });
      return;
    }
    opacity.value = 1;
    offsetY.value = -DROP_FROM_ART_PX;
    offsetY.value = withTiming(0, { duration: DROP_MS, easing: Easing.bounce });
  };

  useImperativeHandle(ref, () => ({
    prepareDrop() {
      pendingDrop.current = true;
    },
  }));

  useEffect(() => {
    if (worn === shown.current) return;
    if (worn && pendingDrop.current) {
      pendingDrop.current = false;
      playDrop();
      return;
    }
    shown.current = worn;
    if (worn) {
      offsetY.value = 0;
      if (reduceMotion) {
        scale.value = 1;
        opacity.value = withTiming(1, { duration: ITEM_ANIM_MS });
        return;
      }
      opacity.value = withTiming(1, { duration: 120 });
      scale.value = 1.35;
      scale.value = withTiming(1, { duration: ITEM_ANIM_MS, easing: Easing.out(Easing.cubic) });
    } else {
      pendingDrop.current = false;
      scale.value = 1;
      opacity.value = withTiming(0, { duration: ITEM_ANIM_MS });
      if (!reduceMotion) {
        offsetY.value = withTiming(-1.6, { duration: ITEM_ANIM_MS, easing: Easing.out(Easing.quad) });
      }
    }
  }, [worn, reduceMotion, opacity, offsetY, scale]);

  const transform = useDerivedValue(() => [
    { translateY: offsetY.value * unit },
    { scale: scale.value },
  ]);

  return (
    <Group transform={transform} origin={{ x: cell / 2, y: centerY }} opacity={opacity}>
      <Group clip={{ x: 0, y: 0, width: cell, height: cell }}>
        <Image
          image={image}
          x={sheetX}
          y={sheetY}
          width={4 * cell}
          height={4 * cell}
          fit="fill"
          sampling={NEAREST}
        />
      </Group>
    </Group>
  );
}

export type ToastIcon =
  | { type: "item"; id: ItemId; locked?: boolean }
  | { type: "skin"; id: PaletteSkinId; locked?: boolean }
  | { type: "costume"; id: CostumeId };

export type LuaAvatarHandle = {
  /** Hop, drop the item on from above with a sparkle burst, and toast. Call before equipping it. */
  celebrateItem: (itemId: ItemId, toastText: string) => void;
  /** Hop, sparkles, pop the new look in, and toast. Call after applying the skin or costume. */
  celebrateLook: (icon: ToastIcon, toastText: string) => void;
  showToast: (icon: ToastIcon, text: string) => void;
};

type ToastState = { icon: ToastIcon; text: string };

type LuaAvatarStageProps = {
  ref: Ref<LuaAvatarHandle>;
  width: number;
  sheets: AchievementSheets;
  /** Only items the player owns. */
  equipped: Equipped;
  costume: CostumeId | null;
  active: boolean;
  reduceMotion: boolean;
  accessibilityLabel: string;
  accessibilityHint: string;
};

export function LuaAvatarStage({
  ref,
  width,
  sheets,
  equipped,
  costume,
  active,
  reduceMotion,
  accessibilityLabel,
  accessibilityHint,
}: LuaAvatarStageProps) {
  const height = Math.round(width * 0.92);
  const unit = snapToDevicePixels(width / AVATAR_GRID);
  const cell = unit * AVATAR_GRID;
  const cellX = PixelRatio.roundToNearestPixel((width - cell) / 2);
  const baselineY = PixelRatio.roundToNearestPixel(height * 0.88);
  const cellY = baselineY - BASELINE_ART_Y * unit;
  const costumeOn = costume !== null && sheets.costume !== null;

  const frame = useSharedValue(0);
  const hopT = useSharedValue(-1);
  const blinkT = useSharedValue(-1);
  const glanceT = useSharedValue(-1);
  const glanceDir = useSharedValue(1);
  const idleT = useSharedValue(0);
  const untilBlink = useSharedValue(randomBetween(BLINK_GAP_MS));
  const untilGlance = useSharedValue(randomBetween(GLANCE_GAP_MS));
  const burstT = useSharedValue(-1);
  const burstFrame = useSharedValue(-1);
  const burstY = useSharedValue(0);
  const lookPop = useSharedValue(1);
  const reduceMotionSV = useSharedValue(reduceMotion);

  useEffect(() => {
    reduceMotionSV.value = reduceMotion;
  }, [reduceMotion, reduceMotionSV]);

  const frameCallback = useFrameCallback((info) => {
    "worklet";
    const dt = Math.min(info.timeSincePreviousFrame ?? 16, 64);
    const show = (next: number) => {
      if (frame.value !== next) frame.value = next;
    };

    if (burstT.value >= 0) {
      burstT.value += dt;
      const col = Math.floor(burstT.value / BURST_FRAME_MS);
      const next = col < 4 ? col : -1;
      if (next < 0) burstT.value = -1;
      if (burstFrame.value !== next) burstFrame.value = next;
    }

    if (hopT.value >= 0) {
      hopT.value += dt;
      if (hopT.value < HOP_MS) {
        let step = 0;
        while (hopT.value >= HOP_STEPS[step][0]) step++;
        show(HOP_STEPS[step][1]);
        return;
      }
      hopT.value = -1;
    }

    // Blinks and glances start on the idle loop's rest frame and pause it, so the head never jumps.
    if (blinkT.value >= 0) {
      blinkT.value += dt;
      if (blinkT.value < BLINK_MS) return show(FRAME_BLINK);
      blinkT.value = -1;
      untilBlink.value = randomBetween(BLINK_GAP_MS);
    }
    if (glanceT.value >= 0) {
      glanceT.value += dt;
      if (glanceT.value < GLANCE_MS) {
        return show(glanceDir.value < 0 ? FRAME_LOOK_LEFT : FRAME_LOOK_RIGHT);
      }
      glanceT.value = -1;
      untilGlance.value = randomBetween(GLANCE_GAP_MS);
    }

    untilBlink.value -= dt;
    untilGlance.value -= dt;
    const idleCol = reduceMotionSV.value
      ? 0
      : Math.floor((idleT.value % IDLE_CYCLE_MS) / (IDLE_CYCLE_MS / 4));
    if (idleCol === 0 && untilBlink.value <= 0) {
      blinkT.value = 0;
      return show(FRAME_BLINK);
    }
    if (idleCol === 0 && untilGlance.value <= 0) {
      glanceT.value = 0;
      glanceDir.value = Math.random() < 0.5 ? -1 : 1;
      return show(glanceDir.value < 0 ? FRAME_LOOK_LEFT : FRAME_LOOK_RIGHT);
    }
    if (!reduceMotionSV.value) idleT.value += dt;
    show(AVATAR_ROWS.idle * 4 + idleCol);
  }, false);

  useEffect(() => {
    frameCallback.setActive(active);
  }, [active, frameCallback]);

  const shoesWorn = !costumeOn && SHOE_ITEMS.some((id) => equipped.feet === id);
  const stackLift = useSharedValue(shoesWorn ? 1 : 0);
  useEffect(() => {
    const target = shoesWorn ? 1 : 0;
    stackLift.value = reduceMotion
      ? target
      : withTiming(target, { duration: 300, easing: Easing.inOut(Easing.quad) });
  }, [shoesWorn, reduceMotion, stackLift]);

  const sheetX = useDerivedValue(() => -(frame.value % 4) * cell);
  const sheetY = useDerivedValue(() => -Math.floor(frame.value / 4) * cell);
  const stackTransform = useDerivedValue(() => [
    { translateX: cellX },
    { translateY: cellY - stackLift.value * 2 * unit },
  ]);
  const lookTransform = useDerivedValue(() => [{ scale: lookPop.value }]);
  const shadowTransform = useDerivedValue(() => {
    const f = frame.value;
    return [{ scaleX: f === FRAME_HOP_APEX ? 0.78 : f === FRAME_HOP_RISE ? 0.86 : 1 }];
  });
  const burstX = useDerivedValue(() => -Math.max(0, burstFrame.value) * cell);
  const burstOpacity = useDerivedValue(() => (burstFrame.value < 0 ? 0 : 1));
  const burstTransform = useDerivedValue(() => [{ translateY: burstY.value }]);
  const clothesOpacity = costumeOn ? 0 : 1;
  const costumeOpacity = costumeOn ? 1 : 0;

  const layers = useRef<Partial<Record<ItemId, ItemLayerHandle | null>>>({});

  const [toast, setToast] = useState<ToastState | null>(null);
  const toastProgress = useSharedValue(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const showToast = (icon: ToastIcon, text: string) => {
    setToast({ icon, text });
    toastProgress.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      toastProgress.value = withTiming(0, { duration: 220 });
    }, TOAST_MS);
  };

  const hopAndBurst = (offsetArtY: number) => {
    if (reduceMotion) return;
    const offset = (offsetArtY - BURST_CENTER_Y) * unit;
    runOnUI(() => {
      "worklet";
      hopT.value = 0;
      burstT.value = 0;
      burstY.value = offset;
    })();
  };

  const popLook = () => {
    if (reduceMotion) {
      lookPop.value = 1;
      return;
    }
    lookPop.value = 1.35;
    lookPop.value = withTiming(1, { duration: ITEM_ANIM_MS, easing: Easing.out(Easing.cubic) });
  };

  useImperativeHandle(ref, () => ({
    celebrateItem(itemId, toastText) {
      layers.current[itemId]?.prepareDrop();
      showToast({ type: "item", id: itemId }, toastText);
      hopAndBurst(ITEM_CENTER_Y[itemId]);
    },
    celebrateLook(icon, toastText) {
      showToast(icon, toastText);
      hopAndBurst(BURST_CENTER_Y);
      popLook();
    },
    showToast,
  }));

  const onPress = () => {
    if (reduceMotion) return;
    runOnUI(() => {
      "worklet";
      if (hopT.value < 0) hopT.value = 0;
    })();
  };

  const toastStyle = useAnimatedStyle(() => ({
    opacity: toastProgress.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - toastProgress.value) * -16 }],
  }));

  const shadowW = 13 * unit;
  const shadowH = 1.8 * unit;
  const burstSheet = sheets.previews[UNLOCK_BURST.sheet] ?? null;

  return (
    <View style={{ width, height }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="imagebutton"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
      >
        <Canvas style={{ width, height }}>
          <Group transform={shadowTransform} origin={{ x: width / 2, y: baselineY }}>
            <Oval
              x={width / 2 - shadowW / 2}
              y={baselineY - shadowH / 2}
              width={shadowW}
              height={shadowH}
              color={ACH.shadow}
            />
          </Group>
          <Group transform={stackTransform}>
            <Group
              transform={lookTransform}
              origin={{ x: cell / 2, y: BASELINE_ART_Y * unit }}
            >
            <Group opacity={clothesOpacity}>
              <Group clip={{ x: 0, y: 0, width: cell, height: cell }}>
                <Image
                  image={sheets.body}
                  x={sheetX}
                  y={sheetY}
                  width={4 * cell}
                  height={4 * cell}
                  fit="fill"
                  sampling={NEAREST}
                />
              </Group>
              {DRAW_ORDER.map((id) => (
                <ItemLayer
                  key={id}
                  ref={(handle) => {
                    layers.current[id] = handle;
                  }}
                  image={sheets.items[id]}
                  worn={equipped[ITEM_BY_ID[id].slot] === id}
                  centerY={ITEM_CENTER_Y[id] * unit}
                  cell={cell}
                  unit={unit}
                  sheetX={sheetX}
                  sheetY={sheetY}
                  reduceMotion={reduceMotion}
                />
              ))}
            </Group>
            <Group opacity={costumeOpacity}>
              <Group clip={{ x: 0, y: 0, width: cell, height: cell }}>
                <Image
                  image={sheets.costume}
                  x={sheetX}
                  y={sheetY}
                  width={4 * cell}
                  height={4 * cell}
                  fit="fill"
                  sampling={NEAREST}
                />
              </Group>
            </Group>
            <Group transform={burstTransform} opacity={burstOpacity}>
              <Group clip={{ x: 0, y: 0, width: cell, height: cell }}>
                <Image
                  image={burstSheet}
                  x={burstX}
                  y={-UNLOCK_BURST.row * cell}
                  width={4 * cell}
                  height={4 * cell}
                  fit="fill"
                  sampling={NEAREST}
                />
              </Group>
            </Group>
            </Group>
          </Group>
        </Canvas>
      </Pressable>

      <Animated.View
        pointerEvents="none"
        className="absolute left-0 right-0 top-2 items-center"
        style={toastStyle}
        accessibilityLiveRegion="polite"
      >
        {toast ? (
          <View
            className="flex-row items-center gap-2 rounded-full py-2 pl-3 pr-4"
            style={{ backgroundColor: ACH.text }}
          >
            <View
              className="h-6 w-8 items-center justify-center rounded-md"
              style={{ backgroundColor: "#ffffff" }}
            >
              <ToastGlyph sheets={sheets} icon={toast.icon} />
            </View>
            <Text className="text-sm text-white" style={{ fontFamily: Pixelify.semibold }}>
              {toast.text}
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

function ToastGlyph({ sheets, icon }: { sheets: AchievementSheets; icon: ToastIcon }) {
  if (icon.type === "item") {
    return (
      <SpriteIcon
        image={icon.locked ? sheets.iconsLocked : sheets.icons}
        cell={ICON_CELLS[icon.id]}
        width={24}
      />
    );
  }
  if (icon.type === "skin") {
    const cells = SKIN_ICON_CELLS[icon.id];
    return (
      <SpriteIcon
        image={sheets.skinIcons}
        cell={icon.locked ? cells.locked : cells.unlocked}
        width={22}
        crop={SKIN_ICON_CROP}
      />
    );
  }
  return <SpriteStill image={sheets.costumeStills} cell={COSTUME_CELLS[icon.id]} size={28} />;
}
