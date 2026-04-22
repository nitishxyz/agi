import React, { useEffect } from "react";
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  useAnimatedStyle,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { Box } from "./primitives/box";
import { Text } from "./primitives/text";

interface CoinFlipAnimationProps {
  isAnimating: boolean;
  size?: number;
}

const CoinFlipAnimation: React.FC<CoinFlipAnimationProps> = ({
  isAnimating,
  size = 48,
}) => {
  const coinRotation = useSharedValue(0);

  useEffect(() => {
    if (isAnimating) {
      // Start coin flip animation
      coinRotation.value = withRepeat(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      coinRotation.value = 0;
    }
  }, [isAnimating]);

  const coinAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(
      coinRotation.value % 360,
      [0, 180, 360],
      [0, 180, 360]
    );

    return {
      transform: [
        { rotateY: `${rotateY}deg` },
        { rotateX: "15deg" }, // Slight 3D tilt
      ],
    };
  });

  return (
    <Animated.View style={coinAnimatedStyle}>
      <Box
        rounded="full"
        center
        style={{
          width: size,
          height: size,
          backgroundColor: "#FFD700", // Gold color for coin
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Text size="lg" weight="bold" style={{ color: "#8B4513" }}>
          $
        </Text>
      </Box>
    </Animated.View>
  );
};

export default CoinFlipAnimation;