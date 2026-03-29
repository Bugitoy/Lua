import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import {
  clamp,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import {
  MAP_SCALE,
  MAP_SRC_H,
  MAP_SRC_W,
  MAP_ZOOM_MAX,
  MAP_ZOOM_MIN,
  MAP_ZOOM_STEP,
} from "@/constants/mapAssets";
import { containPanBounds } from "@/lib/mapPanBounds";

function clampZoom(z: number) {
  return clamp(z, MAP_ZOOM_MIN, MAP_ZOOM_MAX);
}

export function useMapPan() {
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(MAP_ZOOM_MIN);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startPanX = useSharedValue(0);
  const startPanY = useSharedValue(0);
  const layoutW = useSharedValue(0);
  const layoutH = useSharedValue(0);
  const minPanX = useSharedValue(0);
  const maxPanX = useSharedValue(0);
  const minPanY = useSharedValue(0);
  const maxPanY = useSharedValue(0);

  const prevViewportKey = useRef<string | null>(null);

  const effectiveMapScale = MAP_SCALE * zoom;

  const onViewportLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    layoutW.value = width;
    layoutH.value = height;
    queueMicrotask(() => {
      if (mountedRef.current) {
        setViewport({ width, height });
      }
    });
  }, [layoutH, layoutW]);

  useLayoutEffect(() => {
    if (viewport.width <= 0 || viewport.height <= 0) return;

    const { minX, maxX, minY, maxY } = containPanBounds(
      viewport.width,
      viewport.height,
      effectiveMapScale,
      MAP_SRC_W,
      MAP_SRC_H,
    );
    minPanX.value = minX;
    maxPanX.value = maxX;
    minPanY.value = minY;
    maxPanY.value = maxY;

    const key = `${viewport.width}x${viewport.height}`;
    if (prevViewportKey.current !== key) {
      prevViewportKey.current = key;
      translateX.value = (minX + maxX) / 2;
      translateY.value = (minY + maxY) / 2;
    } else {
      translateX.value = clamp(translateX.value, minX, maxX);
      translateY.value = clamp(translateY.value, minY, maxY);
    }
  }, [
    viewport.width,
    viewport.height,
    effectiveMapScale,
    maxPanX,
    maxPanY,
    minPanX,
    minPanY,
    translateX,
    translateY,
  ]);

  const zoomIn = useCallback(() => {
    setZoom((z) => clampZoom(z + MAP_ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => clampZoom(z - MAP_ZOOM_STEP));
  }, []);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          startPanX.value = translateX.value;
          startPanY.value = translateY.value;
        })
        .onUpdate((e) => {
          translateX.value = clamp(
            startPanX.value + e.translationX,
            minPanX.value,
            maxPanX.value,
          );
          translateY.value = clamp(
            startPanY.value + e.translationY,
            minPanY.value,
            maxPanY.value,
          );
        }),
    [
      maxPanX,
      maxPanY,
      minPanX,
      minPanY,
      startPanX,
      startPanY,
      translateX,
      translateY,
    ],
  );

  const mapPanStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const mapW =
    viewport.width > 0 ? viewport.width * effectiveMapScale : 1;
  const mapH =
    viewport.height > 0 ? viewport.height * effectiveMapScale : 1;

  return {
    onViewportLayout,
    panGesture,
    mapPanStyle,
    mapW,
    mapH,
    mapScale: effectiveMapScale,
    zoom,
    zoomIn,
    zoomOut,
    canZoomIn: zoom < MAP_ZOOM_MAX - 0.001,
    canZoomOut: zoom > MAP_ZOOM_MIN + 0.001,
  };
}
