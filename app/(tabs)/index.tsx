import { ImageBackground, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MapCharacter } from "@/components/map/MapCharacter";
import { MapHealthBarCard } from "@/components/map/MapHealthBarCard";
import { MapStatsCard } from "@/components/map/MapStatsCard";
import { MapStops } from "@/components/map/MapStops";
import { MapTopBar } from "@/components/map/MapTopBar";
import { MapZoomControls } from "@/components/map/MapZoomControls";
import { CAMPUS_MAP } from "@/constants/mapAssets";
import { useMapPan } from "@/hooks/useMapPan";
import { useGameStats } from "@/lib/gameStats";

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { stats } = useGameStats();
  const {
    onViewportLayout,
    panGesture,
    mapPanStyle,
    mapW,
    mapH,
    mapScale,
    zoomIn,
    zoomOut,
    canZoomIn,
    canZoomOut,
  } = useMapPan();

  return (
    <View className="flex-1 bg-neutral-900">
      <View className="flex-1 overflow-hidden" onLayout={onViewportLayout}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={mapPanStyle}>
            <ImageBackground
              source={CAMPUS_MAP}
              style={{ width: mapW, height: mapH }}
              resizeMode="contain"
            >
              <MapStops mapScale={mapScale} />
              <MapCharacter />
            </ImageBackground>
          </Animated.View>
        </GestureDetector>
      </View>

      <View className="absolute inset-0 z-10" pointerEvents="box-none">
        <MapTopBar topInset={insets.top} />
        <MapHealthBarCard healthRatio={stats.healthRatio} />
        <MapStatsCard
          goalsDone={stats.goalsDone}
          goalsTotal={stats.goalsTotal}
          goalDayPercent={stats.goalDayPercent}
          distanceMiles={stats.distanceMiles}
          bottomInset={insets.bottom}
        />
        <MapZoomControls
          bottomInset={insets.bottom}
          canZoomIn={canZoomIn}
          canZoomOut={canZoomOut}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
        />
      </View>
    </View>
  );
}
