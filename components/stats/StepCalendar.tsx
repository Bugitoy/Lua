import { Ionicons } from "@expo/vector-icons";
import { useState, type ReactNode } from "react";
import { Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import { useTranslation } from "react-i18next";

import { BarChart, type ChartBar } from "@/components/stats/BarChart";
import {
  METRICS,
  formatMetric,
  metricShade,
  metricTotal,
  metricValue,
  type MetricKey,
} from "@/components/stats/calendarMetrics";
import { DropdownMenu } from "@/components/stats/DropdownMenu";
import { MetricButtons } from "@/components/stats/MetricButtons";
import { Pixelify } from "@/constants/fonts";
import { LUA_GREEN } from "@/constants/mapAssets";
import { addDays, daysIn, monthWeeks, shiftPeriod, weekDays, type CalendarView, type Week } from "@/lib/calendarGrid";
import { startOfDay } from "@/lib/dayKey";
import type { DayHistory, DayRecord } from "@/lib/dayHistory";
import { formatAppDate, getAppLocale } from "@/lib/i18n/formatLocale";

const VIEWS: CalendarView[] = ["week", "month", "year"];

type StepCalendarProps = {
  history: DayHistory;
  /** Today's live record. */
  today: DayRecord;
  selectedDay: string;
  onSelectDay: (day: string) => void;
  /** Week view: a day in the week on screen, sent whenever it changes; null in the Month and Year views. */
  onShownWeekChange?: (dayInWeek: string | null) => void;
};

const GAP = 6;
const YEAR_COLS = 3;
const YEAR_COL_GAP = 4;
const YEAR_CELL_GAP = 1.25;
const TODAY_RING = "#f59e0b";
const SELECTED_RING = "#111827";

const CARD_SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
} as const;

/**
 * The Stats calendar: a Week / Month / Year menu, the four metric
 * buttons, then the chart or grid for that period in the metric's colours.
 */
export function StepCalendar({ history, today, selectedDay, onSelectDay, onShownWeekChange }: StepCalendarProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<CalendarView>("week");
  const [metric, setMetric] = useState<MetricKey>("goals");
  const [anchor, setAnchor] = useState(today.day);
  const [width, setWidth] = useState(0);

  /** Moves the calendar, telling the Stats page which week is on screen. */
  const show = (nextView: CalendarView, nextAnchor: string) => {
    setView(nextView);
    setAnchor(nextAnchor);
    onShownWeekChange?.(nextView === "week" ? nextAnchor : null);
  };

  const recordFor = (day: string): DayRecord | undefined => (day === today.day ? today : history[day]);

  const nextStart = shiftPeriod(anchor, view, 1);
  const canGoForward = (view === "week" ? weekDays(nextStart)[0] : nextStart) <= today.day;

  const periodLabel = (() => {
    const d = startOfDay(anchor);
    if (view === "week") {
      const [mon, , , , , , sun] = weekDays(anchor);
      const fmt = { month: "short", day: "numeric" } as const;
      return `${formatAppDate(startOfDay(mon), fmt)} – ${formatAppDate(startOfDay(sun), fmt)}`;
    }
    if (view === "month") return formatAppDate(d, { month: "long", year: "numeric" });
    return String(d.getFullYear());
  })();

  const changeView = (next: CalendarView) => {
    show(next, today.day);
  };

  /** Year view: tapping a month opens it in the Month view, where each day can be tapped. */
  const openMonth = (firstOfMonth: string) => {
    show("month", firstOfMonth);
  };

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View className="mb-4">
      {/* Section label + view menu */}
      <View className="mb-3 ml-1 flex-row items-center gap-2">
        <Text className="text-xs uppercase tracking-widest text-neutral-400" style={{ fontFamily: Pixelify.semibold }}>
          {t("stats.calendar.title")}
        </Text>
        <DropdownMenu
          value={view}
          options={VIEWS.map((v) => ({ value: v, label: t(`stats.calendar.views.${v}`) }))}
          onChange={changeView}
          renderTrigger={(open) => (
            <View
              className="flex-row items-center gap-1.5 rounded-lg bg-white px-3 py-1.5"
              style={{ borderWidth: 1, borderColor: "#e5e5e5" }}
            >
              <Text
                className="text-xs uppercase tracking-widest"
                style={{ fontFamily: Pixelify.bold, color: LUA_GREEN }}
              >
                {t(`stats.calendar.views.${view}`)}
              </Text>
              <Ionicons name={open ? "chevron-up" : "chevron-down"} size={12} color={LUA_GREEN} />
            </View>
          )}
        />
      </View>

      <MetricButtons value={metric} onChange={setMetric} />

      <View className="rounded-2xl bg-white px-4 pt-4 pb-4" style={CARD_SHADOW}>
        {/* Period + arrows */}
        <View className="mb-4 flex-row items-center justify-between">
          <ArrowButton
            icon="chevron-back"
            label={t("stats.calendar.previous")}
            enabled
            onPress={() => show(view, shiftPeriod(anchor, view, -1))}
          />
          <Text className="text-base text-neutral-900" style={{ fontFamily: Pixelify.bold }}>
            {periodLabel}
          </Text>
          <ArrowButton
            icon="chevron-forward"
            label={t("stats.calendar.next")}
            enabled={canGoForward}
            onPress={() => show(view, nextStart)}
          />
        </View>

        <View onLayout={onLayout}>
          {view === "week" ? (
            <WeekChart
              anchor={anchor}
              metric={metric}
              todayKey={today.day}
              selectedDay={selectedDay}
              recordFor={recordFor}
              onSelectDay={onSelectDay}
            />
          ) : width > 0 && view === "year" ? (
            <YearGrid
              anchor={anchor}
              metric={metric}
              todayKey={today.day}
              selectedDay={selectedDay}
              recordFor={recordFor}
              onOpenMonth={openMonth}
              width={width}
            />
          ) : width > 0 ? (
            <MonthGrid
              weeks={monthWeeks(anchor)}
              metric={metric}
              todayKey={today.day}
              selectedDay={selectedDay}
              recordFor={recordFor}
              onSelectDay={onSelectDay}
              width={width}
            />
          ) : null}
        </View>

        {/* Month: the shade key. Year: the year's best streak and the shade key. */}
        {(view === "month" || view === "year") && (
          <View className="mt-4 flex-row items-center justify-between gap-2">
            {view === "year" ? <BestStreak anchor={anchor} todayKey={today.day} recordFor={recordFor} /> : <View />}
            <ShadeKey metric={metric} />
          </View>
        )}
      </View>
    </View>
  );
}

function ArrowButton({
  icon,
  label,
  enabled,
  onPress,
}: {
  icon: "chevron-back" | "chevron-forward";
  label: string;
  enabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityLabel={label}
      hitSlop={10}
      className="size-9 items-center justify-center rounded-full"
      style={{ backgroundColor: enabled ? "#f3f4f6" : "#f9fafb" }}
    >
      <Ionicons name={icon} size={18} color={enabled ? "#262626" : "#c4c4c4"} />
    </Pressable>
  );
}

function ShadeKey({ metric }: { metric: MetricKey }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-1">
      <Text className="mr-1 text-neutral-400" style={{ fontFamily: Pixelify.regular, fontSize: 11 }}>
        {t("stats.calendar.fewer")}
      </Text>
      {METRICS[metric].shades.map((color) => (
        <View key={color} style={{ width: 11, height: 11, borderRadius: 3, backgroundColor: color }} />
      ))}
      <Text className="ml-1 text-neutral-400" style={{ fontFamily: Pixelify.regular, fontSize: 11 }}>
        {t("stats.calendar.more")}
      </Text>
    </View>
  );
}

/** The longest run of full days in the year shown. */
function BestStreak({
  anchor,
  todayKey,
  recordFor,
}: {
  anchor: string;
  todayKey: string;
  recordFor: (day: string) => DayRecord | undefined;
}) {
  const { t } = useTranslation();
  const year = startOfDay(anchor).getFullYear();
  let best = 0;
  let run = 0;
  for (let day = `${year}-01-01`; day <= `${year}-12-31` && day <= todayKey; day = addDays(day, 1)) {
    run = recordFor(day)?.fullDay ? run + 1 : 0;
    best = Math.max(best, run);
  }
  if (best === 0) return <View />;
  return (
    <View className="min-w-0 shrink flex-row items-center gap-1">
      <Ionicons name="flame" size={13} color="#f97316" />
      <Text className="shrink text-neutral-500" style={{ fontFamily: Pixelify.medium, fontSize: 11 }}>
        {t("stats.calendar.bestStreak", { count: best })}
      </Text>
    </View>
  );
}

// ─── Week: one bar per day ───────────────────────────────────────────────────

function WeekChart({
  anchor,
  metric,
  todayKey,
  selectedDay,
  recordFor,
  onSelectDay,
}: Omit<GridProps, "width"> & { anchor: string }) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const bars: ChartBar[] = weekDays(anchor).map((day) => {
    const future = day > todayKey;
    const record = future ? undefined : recordFor(day);
    const date = startOfDay(day);
    const text = formatMetric(metric, record, t, locale);
    return {
      key: day,
      label: formatAppDate(date, { weekday: "short" }),
      sublabel: String(date.getDate()),
      value: metricValue(metric, record),
      total: metricTotal(metric, record) ?? undefined,
      text,
      accessibilityLabel: `${formatAppDate(date, { weekday: "long", month: "long", day: "numeric" })}: ${text}`,
      future,
      current: day === todayKey,
    };
  });
  return (
    <BarChart
      bars={bars}
      accent={METRICS[metric].accent}
      selectedKey={selectedDay}
      onSelect={onSelectDay}
      showTotals={metric === "goals"}
    />
  );
}

// ─── Month and Year grids ────────────────────────────────────────────────────

type GridProps = {
  metric: MetricKey;
  todayKey: string;
  selectedDay: string;
  recordFor: (day: string) => DayRecord | undefined;
  onSelectDay: (day: string) => void;
  width: number;
};

type CellProps = {
  day: string;
  metric: MetricKey;
  todayKey: string;
  selected: boolean;
  record: DayRecord | undefined;
  size: number;
  radius: number;
  ringWidth: number;
  /** Left out where the square isn't tappable on its own (the year view). */
  onSelectDay?: (day: string) => void;
  children?: ReactNode;
};

function DayCell({ day, metric, todayKey, selected, record, size, radius, ringWidth, onSelectDay, children }: CellProps) {
  const future = day > todayKey;
  const isToday = day === todayKey;
  const fill = METRICS[metric].shades[metricShade(metric, record)];
  const ring = selected ? SELECTED_RING : isToday ? TODAY_RING : null;
  return (
    <Pressable
      onPress={() => onSelectDay?.(day)}
      disabled={future || !onSelectDay}
      accessibilityLabel={formatAppDate(startOfDay(day), { weekday: "long", month: "long", day: "numeric" })}
      accessibilityState={{ selected }}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: future ? "transparent" : fill,
        borderWidth: future ? 1 : ring ? ringWidth : 0,
        borderStyle: future ? "dashed" : "solid",
        borderColor: future ? "#d4d4d4" : (ring ?? "transparent"),
      }}
    >
      {children}
    </Pressable>
  );
}

function MonthGrid({ weeks, metric, todayKey, selectedDay, recordFor, onSelectDay, width }: GridProps & { weeks: Week[] }) {
  const size = Math.floor((width - GAP * 6) / 7);
  // Any week works for weekday names; use the first real day shown.
  const firstWeek = weekDays(weeks.flat().find((d): d is string => d != null)!);

  return (
    <View style={{ gap: GAP }}>
      <View style={{ flexDirection: "row", gap: GAP }}>
        {firstWeek.map((day) => (
          <Text
            key={day}
            style={{ width: size, textAlign: "center", fontFamily: Pixelify.medium, fontSize: 11, color: "#a3a3a3" }}
          >
            {formatAppDate(startOfDay(day), { weekday: "narrow" })}
          </Text>
        ))}
      </View>
      {weeks.map((week, w) => (
        <View key={w} style={{ flexDirection: "row", gap: GAP }}>
          {week.map((day, i) => {
            if (!day) return <View key={i} style={{ width: size, height: size }} />;
            const record = recordFor(day);
            const future = day > todayKey;
            const color = future ? "#a3a3a3" : metricShade(metric, record) >= 3 ? "#ffffff" : "#404040";
            return (
              <DayCell
                key={day}
                day={day}
                metric={metric}
                todayKey={todayKey}
                selected={day === selectedDay}
                record={record}
                size={size}
                radius={10}
                ringWidth={2}
                onSelectDay={onSelectDay}
              >
                <Text style={{ fontFamily: Pixelify.bold, fontSize: 13, color }}>{startOfDay(day).getDate()}</Text>
              </DayCell>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Twelve small months, three to a row, each with how many of its days had any activity. */
function YearGrid({
  anchor,
  metric,
  todayKey,
  selectedDay,
  recordFor,
  onOpenMonth,
  width,
}: Omit<GridProps, "onSelectDay"> & { anchor: string; onOpenMonth: (firstOfMonth: string) => void }) {
  const year = startOfDay(anchor).getFullYear();
  const { accent } = METRICS[metric];
  const tileW = (width - YEAR_COL_GAP * (YEAR_COLS - 1)) / YEAR_COLS;
  const pad = 3;
  // Not rounded down, so the squares use all of the tile's width.
  const cell = (tileW - pad * 2 - YEAR_CELL_GAP * 6) / 7;
  const todayMonth = todayKey.slice(0, 7);

  const months = Array.from({ length: 12 }, (_, m) => {
    const first = `${year}-${String(m + 1).padStart(2, "0")}-01`;
    const weeks = monthWeeks(first);
    const days = daysIn(weeks).filter((d) => d <= todayKey);
    const active = days.filter((d) => metricShade(metric, recordFor(d)) > 0).length;
    return { m, first, weeks, elapsed: days.length, active };
  });

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: YEAR_COL_GAP, rowGap: 10 }}>
      {months.map(({ m, first, weeks, elapsed, active }) => {
        const isNow = first.slice(0, 7) === todayMonth;
        const future = first > todayKey;
        return (
          <Pressable
            key={m}
            onPress={() => onOpenMonth(first)}
            disabled={future}
            accessibilityRole="button"
            accessibilityLabel={formatAppDate(startOfDay(first), { month: "long", year: "numeric" })}
            style={({ pressed }) => ({
              width: tileW,
              padding: pad,
              borderRadius: 10,
              opacity: pressed ? 0.55 : 1,
            })}
          >
            <View className="mb-1.5 flex-row items-baseline justify-between">
              <Text style={{ fontFamily: Pixelify.bold, fontSize: 11, color: isNow ? accent : "#262626" }}>
                {formatAppDate(startOfDay(first), { month: "short" })}
              </Text>
              {elapsed > 0 && (
                <Text style={{ fontFamily: Pixelify.regular, fontSize: 9, color: "#a3a3a3" }}>
                  {active}/{elapsed}
                </Text>
              )}
            </View>
            {/* The whole month is one button; its squares don't take taps. */}
            <View style={{ gap: YEAR_CELL_GAP }} pointerEvents="none">
              {weeks.map((week, w) => (
                <View key={w} style={{ flexDirection: "row", gap: YEAR_CELL_GAP }}>
                  {week.map((day, i) =>
                    day ? (
                      <DayCell
                        key={day}
                        day={day}
                        metric={metric}
                        todayKey={todayKey}
                        selected={day === selectedDay}
                        record={recordFor(day)}
                        size={cell}
                        radius={3}
                        ringWidth={1.5}
                      />
                    ) : (
                      <View key={i} style={{ width: cell, height: cell }} />
                    ),
                  )}
                </View>
              ))}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
