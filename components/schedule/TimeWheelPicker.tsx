import { useEffect, useMemo, useRef } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";

/**
 * Themed scroll-wheel time picker. Three columns: hours (1–12), minutes (00–59),
 * and AM/PM. Designed to feel native on both iOS and Android with the same
 * Pixelify + Lua-green styling as the rest of the schedule sheet.
 */

const ROW_HEIGHT = 36;
const VISIBLE_ROWS = 5;
const CENTER_PADDING = ROW_HEIGHT * Math.floor(VISIBLE_ROWS / 2);
const WHEEL_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1) as readonly number[];
const MINUTES = Array.from({ length: 60 }, (_, i) => i) as readonly number[];
const PERIODS = ["AM", "PM"] as const;

type Period = (typeof PERIODS)[number];

type TimeWheelPickerProps = {
  value: Date;
  onChange: (next: Date) => void;
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function partsFromDate(d: Date): { h12: number; minute: number; period: Period } {
  const h24 = d.getHours();
  const period: Period = h24 >= 12 ? "PM" : "AM";
  const h12 = ((h24 + 11) % 12) + 1;
  return { h12, minute: d.getMinutes(), period };
}

function dateFromParts(h12: number, minute: number, period: Period): Date {
  const out = new Date();
  let h24 = h12 % 12;
  if (period === "PM") h24 += 12;
  out.setHours(h24, minute, 0, 0);
  return out;
}

type WheelColumnProps = {
  items: readonly (number | string)[];
  selectedIndex: number;
  width: number;
  onSelectIndex: (idx: number) => void;
  renderLabel: (item: number | string) => string;
};

function WheelColumn({
  items,
  selectedIndex,
  width,
  onSelectIndex,
  renderLabel,
}: WheelColumnProps) {
  const scrollRef = useRef<ScrollView | null>(null);
  /** Suppresses programmatic scroll-to while the user is actively dragging. */
  const userScrollingRef = useRef(false);

  useEffect(() => {
    if (userScrollingRef.current) return;
    scrollRef.current?.scrollTo({
      y: selectedIndex * ROW_HEIGHT,
      animated: false,
    });
  }, [selectedIndex]);

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    userScrollingRef.current = false;
    const y = event.nativeEvent.contentOffset.y;
    const idx = Math.max(
      0,
      Math.min(items.length - 1, Math.round(y / ROW_HEIGHT)),
    );
    if (idx !== selectedIndex) onSelectIndex(idx);
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={{ width, height: WHEEL_HEIGHT }}
      contentContainerStyle={{ paddingVertical: CENTER_PADDING }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ROW_HEIGHT}
      decelerationRate="fast"
      // Required so Android lets the inner wheel capture vertical drags when
      // nested inside the modal's outer ScrollView. No-op on iOS.
      nestedScrollEnabled
      onScrollBeginDrag={() => {
        userScrollingRef.current = true;
      }}
      onMomentumScrollEnd={handleMomentumEnd}
      onScrollEndDrag={handleMomentumEnd}
    >
      {items.map((item, idx) => {
        const distance = Math.abs(idx - selectedIndex);
        const isSelected = distance === 0;
        const opacity = isSelected ? 1 : distance === 1 ? 0.55 : 0.25;
        return (
          <View
            key={`${item}-${idx}`}
            style={{
              height: ROW_HEIGHT,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontFamily: isSelected ? Pixelify.bold : Pixelify.regular,
                fontSize: isSelected ? 22 : 18,
                color: isSelected ? LUA_GREEN : "#404040",
                opacity,
              }}
            >
              {renderLabel(item)}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

export function TimeWheelPicker({ value, onChange }: TimeWheelPickerProps) {
  const { t } = useTranslation();
  const parts = useMemo(() => partsFromDate(value), [value]);
  const periodLabels = useMemo(
    () => [t("common.am"), t("common.pm")] as const,
    [t],
  );

  const hourIndex = parts.h12 - 1;
  const minuteIndex = parts.minute;
  const periodIndex = parts.period === "AM" ? 0 : 1;

  return (
    <View className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <View
        style={{
          position: "relative",
          height: WHEEL_HEIGHT,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 12,
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 10,
            right: 10,
            top: CENTER_PADDING,
            height: ROW_HEIGHT,
            borderRadius: 10,
            backgroundColor: "rgba(22,163,74,0.10)",
            borderWidth: 1,
            borderColor: "rgba(22,163,74,0.45)",
          }}
        />
        <WheelColumn
          items={HOURS_12}
          selectedIndex={hourIndex}
          width={56}
          onSelectIndex={(idx) =>
            onChange(dateFromParts(HOURS_12[idx], parts.minute, parts.period))
          }
          renderLabel={(item) => String(item)}
        />
        <Text
          style={{
            fontFamily: Pixelify.bold,
            fontSize: 22,
            color: LUA_GREEN,
            paddingHorizontal: 4,
          }}
        >
          :
        </Text>
        <WheelColumn
          items={MINUTES}
          selectedIndex={minuteIndex}
          width={56}
          onSelectIndex={(idx) =>
            onChange(dateFromParts(parts.h12, MINUTES[idx], parts.period))
          }
          renderLabel={(item) => pad2(Number(item))}
        />
        <View style={{ width: 12 }} />
        <WheelColumn
          items={periodLabels as readonly string[]}
          selectedIndex={periodIndex}
          width={56}
          onSelectIndex={(idx) =>
            onChange(dateFromParts(parts.h12, parts.minute, PERIODS[idx]))
          }
          renderLabel={(item) => String(item)}
        />
      </View>
    </View>
  );
}
