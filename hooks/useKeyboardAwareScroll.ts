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
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Space left between the focused field and the top of the keyboard. */
const GAP = 20;
/** Scrolls anyway if the content never reports a new size (e.g. the padding was already there). */
const FALLBACK_MS = 250;

/**
 * Keeps the field being typed in above the keyboard. The app draws edge to
 * edge on Android, so the system no longer shrinks the screen for the
 * keyboard and a field low on the page ends up hidden behind it.
 *
 * Spread `scrollProps` on the ScrollView, add `keyboardHeight` to its bottom
 * padding so there's room to scroll, and call `reveal(view)` when a field is
 * focused with the view that should stay visible.
 *
 * The scroll waits for that padding to be laid out (the content reports its
 * new size), since scrolling any earlier is capped at the old, shorter page:
 * a short page wouldn't move at all.
 */
export function useKeyboardAwareScroll() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const offset = useRef(0);
  const focused = useRef<View | null>(null);
  const keyboardTop = useRef<number | null>(null);
  const pending = useRef(false);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomInset = useRef(insets.bottom);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    bottomInset.current = insets.bottom;
  }, [insets.bottom]);

  const scrollFocusedIntoView = useCallback(() => {
    pending.current = false;
    if (fallback.current) clearTimeout(fallback.current);
    fallback.current = null;
    const node = focused.current;
    const top = keyboardTop.current;
    if (!node || top === null) return;
    node.measureInWindow((_x, y, _w, h) => {
      const overlap = y + h + GAP - top;
      if (overlap > 0) scrollRef.current?.scrollTo({ y: offset.current + overlap, animated: true });
    });
  }, []);

  /** Scrolls once the page has grown for the keyboard, or after a moment if it doesn't. */
  const queueScroll = useCallback(() => {
    pending.current = true;
    if (fallback.current) clearTimeout(fallback.current);
    fallback.current = setTimeout(scrollFocusedIntoView, FALLBACK_MS);
  }, [scrollFocusedIntoView]);

  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", (e) => {
      const { height, screenY } = e.endCoordinates;
      // Android versions disagree on whether the keyboard height includes the
      // navigation bar, so take the highest top any of them could mean.
      // Erring high only leaves a slightly bigger gap above the keyboard.
      const fromBottom = Dimensions.get("screen").height - height - (ios ? 0 : bottomInset.current);
      keyboardTop.current = Math.min(screenY, fromBottom);
      setKeyboardHeight(height);
      queueScroll();
    });
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => {
      keyboardTop.current = null;
      pending.current = false;
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
      if (fallback.current) clearTimeout(fallback.current);
    };
  }, [queueScroll]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  }, []);

  const onContentSizeChange = useCallback(() => {
    // Wait one frame so the new size is on screen before measuring.
    if (pending.current) requestAnimationFrame(scrollFocusedIntoView);
  }, [scrollFocusedIntoView]);

  /** Call when a field is focused. Scrolls now if the keyboard is already up, or once it opens. */
  const reveal = useCallback(
    (node: View | null) => {
      focused.current = node;
      if (keyboardTop.current !== null) queueScroll();
    },
    [queueScroll],
  );

  return {
    scrollProps: { ref: scrollRef, onScroll, onContentSizeChange, scrollEventThrottle: 16 },
    keyboardHeight,
    reveal,
  };
}
