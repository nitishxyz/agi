import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import HoldingCard, { HoldingData } from "./holding-card";
import { Box } from "./primitives/box";
import { Icon } from "./primitives/icon";
import { SwipeableCard } from "./optimized-swipeable-cards";

interface SwapTransitionProps {
  currentHolding: HoldingData;
  newToken: SwipeableCard;
  isSwapping: boolean;
  onTransitionComplete: () => void;
}

const SwapTransition: React.FC<SwapTransitionProps> = ({
  currentHolding,
  newToken,
  isSwapping,
  onTransitionComplete,
}) => {
  const leftCardWidth = useSharedValue(100);
  const rightCardWidth = useSharedValue(0);
  const centerOpacity = useSharedValue(0);
  const centerScale = useSharedValue(0.8);
  const iconRotation = useSharedValue(0);
  const [showTransition, setShowTransition] = useState(false);

  // Convert SwipeableCard to HoldingData for the new token
  const newHolding: HoldingData = {
    tokenName: newToken.tokenName,
    tokenSymbol: newToken.tokenSymbol,
    currentValue: currentHolding.currentValue,
    tokenQuantity: currentHolding.currentValue / newToken.currentPrice, // Calculate new token quantity
    pnlPercentage: 0,
    isPositive: true,
    // Keep session P&L from current holding during transition
    sessionPnlUsd: currentHolding.sessionPnlUsd,
    sessionPnlPercentage: currentHolding.sessionPnlPercentage,
    sessionIsPositive: currentHolding.sessionIsPositive,
    image: newToken.image,
    primaryColor: newToken.primaryColor,
    secondaryColor: newToken.secondaryColor,
  };

  const handleTransitionComplete = () => {
    console.log("Animation completed, calling transition complete");
    setShowTransition(false);
    onTransitionComplete();
  };

  useEffect(() => {
    console.log("SwapTransition: isSwapping changed to", isSwapping);
    if (isSwapping) {
      console.log(
        "SwapTransition: Starting phase 1 - showing both cards at 50%"
      );
      setShowTransition(true);
      // Phase 1: Show both cards at adjusted width to account for 8px gap
      // Total available width = 100%, gap = 8px, so each card gets slightly less than 50%
      leftCardWidth.value = withTiming(49, { duration: 300 });
      rightCardWidth.value = withTiming(49, { duration: 300 });

      // Show center loading animation
      centerOpacity.value = withTiming(1, { duration: 300 });
      centerScale.value = withTiming(1, { duration: 300 });

      // Start rotation animation
      iconRotation.value = withRepeat(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
        -1,
        false
      );
    }
  }, [isSwapping]);

  useEffect(() => {
    console.log(
      "SwapTransition: Phase 2 check - isSwapping:",
      isSwapping,
      "showTransition:",
      showTransition
    );
    if (!isSwapping && showTransition) {
      console.log(
        "SwapTransition: Starting phase 2 - left card to 0%, right card to 100%"
      );

      // Hide center loading animation first
      centerOpacity.value = withTiming(0, { duration: 200 });
      centerScale.value = withTiming(0.8, { duration: 200 });
      iconRotation.value = 0;

      // Phase 2: Left card disappears, right card takes full width
      const timer = setTimeout(() => {
        console.log("SwapTransition: Executing phase 2 animations");
        leftCardWidth.value = withTiming(0, { duration: 400 });
        rightCardWidth.value = withTiming(
          100,
          { duration: 400 },
          (finished) => {
            console.log("SwapTransition: Animation finished:", finished);
            if (finished) {
              runOnJS(handleTransitionComplete)();
            }
          }
        );
      }, 100); // Small delay to ensure smooth transition
      return () => clearTimeout(timer);
    }
  }, [isSwapping, showTransition]);

  const containerStyle = useAnimatedStyle(() => {
    // Animate gap to 0 when left card disappears
    const gap = interpolate(leftCardWidth.value, [0, 20], [0, 8], "clamp");
    return {
      flexDirection: "row" as const,
      gap,
    };
  });

  const centerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: centerOpacity.value,
    transform: [
      { scale: centerScale.value },
      { rotate: `${iconRotation.value}deg` },
    ],
  }));

  // Show normal card when not in transition
  if (!showTransition) {
    return (
      <Box m="md" mb="sm">
        <HoldingCard holding={currentHolding} />
      </Box>
    );
  }

  // Show transition animation with two cards
  return (
    <Box m="md" mb="sm" style={{ position: "relative" }}>
      <Animated.View style={containerStyle}>
        <HoldingCard
          holding={currentHolding}
          width={leftCardWidth}
        />
        <HoldingCard
          holding={newHolding}
          width={rightCardWidth}
        />
      </Animated.View>

      {/* Center loading animation */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: "center",
            alignItems: "center",
            zIndex: 10,
          },
          centerAnimatedStyle,
        ]}
      >
        <Box
          background="base"
          rounded="full"
          center
          style={{
            width: 40,
            height: 40,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 4,
          }}
        >
          <Icon icon={Feather} name="refresh-cw" size={20} />
        </Box>
      </Animated.View>
    </Box>
  );
};

export default SwapTransition;
