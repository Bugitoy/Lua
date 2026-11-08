import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import makeQr from "qrcode-generator";
import { useMemo } from "react";
import { PixelRatio, View } from "react-native";

/** Light squares around the code; scanners need at least this much quiet space. */
const QUIET_MODULES = 2;

/** What a Lua QR code holds: a link that opens the add-friend screen for that code. */
export function friendQrValue(code: string): string {
  return `lua://friend/${code}`;
}

/**
 * A QR code for `value`, drawn with Skia as one path of whole-pixel squares so
 * it stays sharp for scanners at any size.
 */
export function FriendQr({ value, size }: { value: string; size: number }) {
  const { path, drawn } = useMemo(() => {
    const qr = makeQr(0, "M");
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    const total = count + QUIET_MODULES * 2;
    // Whole device pixels per square, so edges never blur between pixels.
    const cell = Math.max(1, Math.floor((size * PixelRatio.get()) / total)) / PixelRatio.get();
    const p = Skia.Path.Make();
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          p.addRect(Skia.XYWHRect((c + QUIET_MODULES) * cell, (r + QUIET_MODULES) * cell, cell, cell));
        }
      }
    }
    return { path: p, drawn: total * cell };
  }, [value, size]);

  return (
    <View
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}
      accessibilityRole="image"
    >
      <Canvas style={{ width: drawn, height: drawn }}>
        <Path path={path} color="#111" />
      </Canvas>
    </View>
  );
}
