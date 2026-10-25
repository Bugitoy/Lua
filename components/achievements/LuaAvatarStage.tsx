import { Canvas, createPicture, Picture } from "@shopify/react-native-skia";
import { memo, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import { PixelRatio, Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  runOnUI,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { SKIN_ICON_CROP, SpriteIcon, SpriteStill } from "@/components/achievements/SpriteCell";
import type { AchievementSheets } from "@/components/achievements/spriteSheets";
import {
  drawStage,
  makeStageModel,
  makeStageSim,
  stageBurst,
  stageHop,
  stagePopLook,
  stageSetEquipped,
  stepStage,
  type StageSim,
} from "@/components/achievements/stageArt";
import { ACH } from "@/components/achievements/theme";
import { Pixelify } from "@/constants/fonts";
import {
  COSTUME_CELLS,
  ICON_CELLS,
  SKIN_ICON_CELLS,
  type CostumeId,
  type ItemId,
  type PaletteSkinId,
} from "@/constants/luaSprites";
import type { Equipped } from "@/lib/achievementsStore";

const TOAST_MS = 2600;
/** The prototype's frame-to-frame cap on elapsed time, in seconds. */
const MAX_FRAME_STEP_S = 0.05;
/** Confetti counts and hop heights (art px) from the prototype. */
const UNLOCK_CONFETTI = 26;
const LOOK_CONFETTI = 30;
const UNLOCK_HOP_ART_PX = 3;
const LOOK_HOP_ART_PX = 2.6;

export type ToastIcon =
  | { type: "item"; id: ItemId; locked?: boolean }
  | { type: "skin"; id: PaletteSkinId; locked?: boolean }
  | { type: "costume"; id: CostumeId };

export type LuaAvatarHandle = {
  /** Hop, drop the item on from above with a confetti burst, and toast. Call before equipping it. */
  celebrateItem: (itemId: ItemId, toastText: string) => void;
  /** Hop, confetti, pop the new look in, and toast. Call after applying the skin or costume. */
  celebrateLook: (icon: ToastIcon, toastText: string) => void;
  showToast: (icon: ToastIcon, text: string) => void;
};

type ToastState = { icon: ToastIcon; text: string };

type LuaAvatarStageProps = {
  ref: Ref<LuaAvatarHandle>;
  width: number;
  /** Icon sheets for the toast. */
  sheets: AchievementSheets;
  skin: PaletteSkinId;
  /** Only items the player owns. */
  equipped: Equipped;
  costume: CostumeId | null;
  active: boolean;
  reduceMotion: boolean;
  accessibilityLabel: string;
  accessibilityHint: string;
};

/** Lua on the customize screen, drawn live each frame like the prototype (see stageArt.ts). */
function LuaAvatarStageImpl({
  ref,
  width,
  sheets,
  skin,
  equipped,
  costume,
  active,
  reduceMotion,
  accessibilityLabel,
  accessibilityHint,
}: LuaAvatarStageProps) {
  const height = Math.round(width * 0.92);
  const dpr = PixelRatio.get();
  const model = useMemo(
    () => makeStageModel(width, height, skin, costume, dpr),
    [width, height, skin, costume, dpr],
  );
  const { P } = model;

  const [initialSim] = useState(() => makeStageSim(equipped, costume !== null, reduceMotion));
  const sim = useSharedValue<StageSim>(initialSim);

  const frameCallback = useFrameCallback((info) => {
    "worklet";
    const dt = Math.min(MAX_FRAME_STEP_S, (info.timeSincePreviousFrame ?? 0) / 1000);
    sim.modify((s) => {
      "worklet";
      stepStage(s, model, dt);
      return s;
    });
  }, false);

  useEffect(() => {
    frameCallback.setActive(active);
  }, [active, frameCallback]);

  const picture = useDerivedValue(() =>
    createPicture((canvas) => drawStage(canvas, model, sim.value), { width, height }),
  );

  useEffect(() => {
    runOnUI((reduced: boolean) => {
      "worklet";
      sim.modify((s) => {
        "worklet";
        s.reduced = reduced;
        return s;
      });
    })(reduceMotion);
  }, [reduceMotion, sim]);

  /** The item `celebrateItem` announced; it bounces down instead of popping when it goes on. */
  const pendingDrop = useRef<ItemId | null>(null);
  const firstLook = useRef(true);

  useEffect(() => {
    const dropId = pendingDrop.current;
    pendingDrop.current = null;
    runOnUI((next: Equipped, costumeOn: boolean, drop: ItemId | null) => {
      "worklet";
      sim.modify((s) => {
        "worklet";
        stageSetEquipped(s, next, costumeOn, drop);
        return s;
      });
    })(equipped, costume !== null, dropId);
  }, [equipped, costume, sim]);

  // A new skin or costume pops in, as in the prototype.
  useEffect(() => {
    if (firstLook.current) {
      firstLook.current = false;
      return;
    }
    runOnUI(() => {
      "worklet";
      sim.modify((s) => {
        "worklet";
        stagePopLook(s);
        return s;
      });
    })();
  }, [skin, costume, sim]);

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

  const celebrate = (hopArtPx: number, happyFor: number, burstFrom: ItemId | null, confetti: number) => {
    const hopH = hopArtPx * P;
    runOnUI(() => {
      "worklet";
      sim.modify((s) => {
        "worklet";
        stageHop(s, hopH, happyFor);
        stageBurst(s, burstFrom, confetti);
        return s;
      });
    })();
  };

  useImperativeHandle(ref, () => ({
    celebrateItem(itemId, toastText) {
      pendingDrop.current = itemId;
      showToast({ type: "item", id: itemId }, toastText);
      celebrate(UNLOCK_HOP_ART_PX, 1.6, itemId, UNLOCK_CONFETTI);
    },
    celebrateLook(icon, toastText) {
      showToast(icon, toastText);
      celebrate(LOOK_HOP_ART_PX, 1.2, null, LOOK_CONFETTI);
    },
    showToast,
  }));

  const onPress = () => {
    const hopH = LOOK_HOP_ART_PX * P;
    runOnUI(() => {
      "worklet";
      sim.modify((s) => {
        "worklet";
        if (s.hopDur <= 0) stageHop(s, hopH, 0.9);
        return s;
      });
    })();
  };

  const toastStyle = useAnimatedStyle(() => ({
    opacity: toastProgress.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - toastProgress.value) * -16 }],
  }));

  return (
    <View style={{ width, height }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="imagebutton"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
      >
        <Canvas style={{ width, height }}>
          <Picture picture={picture} />
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

/** Skips re-rendering the avatar when the screen re-renders for unrelated state. */
export const LuaAvatarStage = memo(LuaAvatarStageImpl);
