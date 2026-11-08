import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Keyboard,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
  type View,
} from "react-native";

/** Space left between the focused field and the top of the keyboard. */
const GAP = 16;
/** Lets the extra bottom padding lay out before scrolling, or the scroll gets cut short. */
const LAYOUT_DELAY_MS = 60;

/**
 * Keeps the field being typed in above the keyboard. The app draws edge to
 * edge on Android, so the system no longer shrinks the screen for the
 * keyboard and a field low on the page ends up hidden behind it.
 *
 * Spread `scrollProps` on the ScrollView, add `keyboardHeight` to its bottom
 * padding so there's room to scroll, and call `reveal(view)` when a field is
 * focused with the view that should stay visible.
 */
export function useKeyboardAwareScroll() {
  const scrollRef = useRef<ScrollView>(null);
  const offset = useRef(0);
  const focused = useRef<View | null>(null);
  const keyboardTop = useRef<number | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const scrollFocusedIntoView = useCallback(() => {
    const node = focused.current;
    const top = keyboardTop.current;
    if (!node || top === null) return;
    node.measureInWindow((_x, y, _w, h) => {
      const overlap = y + h + GAP - top;
      if (overlap > 0) scrollRef.current?.scrollTo({ y: offset.current + overlap, animated: true });
    });
  }, []);

  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", (e) => {
      const { height, screenY } = e.endCoordinates;
      // Android reports these slightly differently across versions; the higher top is the safe one.
      keyboardTop.current = Math.min(screenY, Dimensions.get("window").height - height);
      setKeyboardHeight(height);
      setTimeout(scrollFocusedIntoView, LAYOUT_DELAY_MS);
    });
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => {
      keyboardTop.current = null;
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [scrollFocusedIntoView]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  }, []);

  /** Call when a field is focused. Scrolls now if the keyboard is already up, or once it opens. */
  const reveal = useCallback(
    (node: View | null) => {
      focused.current = node;
      if (keyboardTop.current !== null) setTimeout(scrollFocusedIntoView, LAYOUT_DELAY_MS);
    },
    [scrollFocusedIntoView],
  );

  return {
    scrollProps: { ref: scrollRef, onScroll, scrollEventThrottle: 16 },
    keyboardHeight,
    reveal,
  };
}
