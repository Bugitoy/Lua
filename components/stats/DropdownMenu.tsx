import { Ionicons } from "@expo/vector-icons";
import { useRef, useState, type ReactNode } from "react";
import { Modal, Pressable, Text, View, useWindowDimensions } from "react-native";

import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";

export type DropdownOption<T extends string> = { value: T; label: string };

type DropdownMenuProps<T extends string> = {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  /** The button; `open` is true while the menu shows. */
  renderTrigger: (open: boolean) => ReactNode;
  /** Which edge of the button the menu lines up with. */
  align?: "left" | "right";
  accessibilityLabel?: string;
};

/** Height of one option row plus the menu's padding, for deciding whether it fits below. */
const ROW_HEIGHT = 40;
const MENU_PADDING = 8;
const SCREEN_MARGIN = 12;

/**
 * A small menu that drops down from its button, above everything else on
 * screen. When there isn't room below the button, it opens upwards instead.
 */
export function DropdownMenu<T extends string>({
  value,
  options,
  onChange,
  renderTrigger,
  align = "left",
  accessibilityLabel,
}: DropdownMenuProps<T>) {
  const anchorRef = useRef<View>(null);
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [anchor, setAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const open = () => {
    anchorRef.current?.measureInWindow((x, y, w, h) => setAnchor({ x, y, w, h }));
  };
  const close = () => setAnchor(null);

  const menuHeight = options.length * ROW_HEIGHT + MENU_PADDING;
  const opensUp =
    anchor != null &&
    anchor.y + anchor.h + 6 + menuHeight > screenH - SCREEN_MARGIN &&
    anchor.y - 6 - menuHeight >= SCREEN_MARGIN;

  return (
    <>
      <View ref={anchorRef} collapsable={false}>
        <Pressable
          onPress={open}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ expanded: anchor != null }}
        >
          {renderTrigger(anchor != null)}
        </Pressable>
      </View>

      <Modal visible={anchor != null} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
        <Pressable style={{ flex: 1 }} onPress={close}>
          {anchor && (
            <View
              style={{
                position: "absolute",
                ...(opensUp ? { bottom: screenH - anchor.y + 6 } : { top: anchor.y + anchor.h + 6 }),
                ...(align === "left" ? { left: anchor.x } : { right: screenW - anchor.x - anchor.w }),
                minWidth: Math.max(140, anchor.w),
                backgroundColor: "#fff",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#e5e5e5",
                paddingVertical: 4,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.12,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
              {options.map((opt) => {
                const active = opt.value === value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      close();
                      onChange(opt.value);
                    }}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: active }}
                    className="flex-row items-center justify-between gap-4 px-3.5 py-2.5 active:bg-neutral-50"
                  >
                    <Text
                      style={{
                        fontFamily: active ? Pixelify.bold : Pixelify.regular,
                        fontSize: 13,
                        color: active ? LUA_GREEN : "#404040",
                      }}
                    >
                      {opt.label}
                    </Text>
                    {active && <Ionicons name="checkmark" size={15} color={LUA_GREEN} />}
                  </Pressable>
                );
              })}
            </View>
          )}
        </Pressable>
      </Modal>
    </>
  );
}
