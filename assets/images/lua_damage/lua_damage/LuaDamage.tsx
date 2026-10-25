/**
 * <LuaDamage health={30} look={{ costume: 'cowboy' }} width={320} height={300} />
 *
 * Draws Lua live with React Native Skia and animates damage with Reanimated: no sprite sheets.
 * Change `health` and Lua reacts on its own:
 *  - any drop: white flash, shake, squash and sparks, then the damage tweens to the new level
 *  - any rise: a hop, happy eyes and green sparkles
 *  - reaching 0: Lua tips over, lands with a puff, X eyes, smoke and bits on the ground
 *  - rising above 0 again: Lua gets back up
 *
 * Damage by health (all blended smoothly, nothing snaps):
 *   70-100 healthy   blinks, light bob
 *   50-70  hurting   wincing eyes, sweat drop, heavier bob
 *   30-50  dazed     a crack grows down the head, dot eyes, sway, stars circling
 *    1-30  damaged   cracks spread, grime, chips crumble off, smoke below ~18, greyer colours
 *      0   knocked out
 *
 * Needs @shopify/react-native-skia and react-native-reanimated (with its Babel plugin).
 */
import React, { useEffect, useMemo, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Canvas, Picture, Skia, type SkCanvas, type SkPaint } from '@shopify/react-native-skia';
import {
  Easing, useDerivedValue, useFrameCallback, useSharedValue, withTiming,
} from 'react-native-reanimated';
import {
  buildLua, damageStage, drawLua, KO_DELAY_S, type LuaLook, type Painter,
} from './luaDamageCore';

export interface LuaDamageProps {
  /** 0..100 */
  health: number;
  look?: LuaLook;
  width: number;
  height: number;
  /** how long the damage takes to catch up with a new health value (ms) */
  tweenMs?: number;
  /** stop the frame loop (e.g. when the screen is not focused) */
  paused?: boolean;
  style?: StyleProp<ViewStyle>;
}

function skiaPainter(canvas: SkCanvas, paint: SkPaint): Painter {
  'worklet';
  return {
    save: () => { canvas.save(); },
    restore: () => { canvas.restore(); },
    translate: (x, y) => { canvas.translate(x, y); },
    rotate: (rad) => { canvas.rotate((rad * 180) / Math.PI, 0, 0); },
    scale: (sx, sy) => { canvas.scale(sx, sy); },
    rect: (x, y, w, h, r, g, b, a) => {
      paint.setColor(Float32Array.of(r / 255, g / 255, b / 255, a));
      canvas.drawRect(Skia.XYWHRect(x, y, w, h), paint);
    },
  };
}

export function LuaDamage({ health, look, width, height, tweenMs = 650, paused = false, style }: LuaDamageProps) {
  const lookKey = `${look?.costume ?? ''}|${look?.skin ?? ''}|${(look?.items ?? []).join(',')}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const model = useMemo(() => buildLua(look), [lookKey]);

  // Fit Lua's whole reach (stars above, lying down sideways) into the canvas, so hats never
  // poke out over the health bar. Whole-number scales keep the pixels crisp.
  const [vx, vy, vw, vh] = model.view;
  const fit = Math.min(width / vw, height / vh);
  const scale = fit >= 2 ? Math.floor(fit) : fit;
  const ox = (width - vw * scale) / 2 - vx * scale;
  const oy = (height - vh * scale) / 2 - vy * scale;

  const start = Math.max(0, Math.min(100, health));
  const t = useSharedValue(0);
  const phase = useSharedValue(0);
  const hp = useSharedValue(start);
  const target = useSharedValue(start);
  const hitT = useSharedValue(-10);
  const hitAmt = useSharedValue(0);
  const healT = useSharedValue(-10);
  const koT = useSharedValue(start <= 0 ? -100 : -1);   // mounted at 0: already lying down
  const riseT = useSharedValue(-1);
  const eyeSwapT = useSharedValue(-10);

  const loop = useFrameCallback((f) => {
    'worklet';
    const dt = Math.min(f.timeSincePreviousFrame ?? 16, 64) / 1000;
    t.value += dt;
    // integrate the idle cycle so its speed can follow health without jumping
    phase.value = (phase.value + dt / (2.4 + 1.4 * (1 - hp.value / 100))) % 2;
  });
  useEffect(() => { loop.setActive(!paused); }, [paused, loop]);

  const prev = useRef(start);
  useEffect(() => {
    const next = Math.max(0, Math.min(100, health));
    const was = prev.current;
    prev.current = next;
    if (next === was) return;
    const now = t.value;
    if (next < was) {
      hitT.value = now;
      hitAmt.value = Math.min(1, (was - next) / 40);
      if (next <= 0) { koT.value = now + KO_DELAY_S; riseT.value = -1; }
    } else {
      healT.value = now;
      if (was <= 0) { riseT.value = now; koT.value = -1; }
    }
    if (damageStage(next) !== damageStage(was)) eyeSwapT.value = now;
    target.value = next;
    hp.value = withTiming(next, { duration: tweenMs, easing: Easing.out(Easing.cubic) });
  }, [health, tweenMs]);

  const picture = useDerivedValue(() => {
    const rec = Skia.PictureRecorder();
    const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
    const paint = Skia.Paint();
    paint.setAntiAlias(false);
    drawLua(skiaPainter(canvas, paint), model, {
      t: t.value, phase: phase.value, health: hp.value, target: target.value,
      hitT: hitT.value, hitAmt: hitAmt.value, healT: healT.value,
      koT: koT.value, riseT: riseT.value, eyeSwapT: eyeSwapT.value,
    }, scale, ox, oy);
    return rec.finishRecordingAsPicture();
  }, [model, width, height, scale, ox, oy]);

  return (
    <Canvas style={[{ width, height }, style]}>
      <Picture picture={picture} />
    </Canvas>
  );
}

export { damageStage } from './luaDamageCore';
export default LuaDamage;
