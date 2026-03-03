import { Feather } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import { Dimensions, Image } from "react-native";
import { useTheme } from "@/providers/theme-context";
import { LinearGradient } from "expo-linear-gradient";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Box } from "./primitives/box";
import { Button } from "./primitives/button";
import { Icon } from "./primitives/icon";
import { Text } from "./primitives/text";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const CARD_WIDTH = screenWidth * 0.9;
const CARD_HEIGHT = screenHeight * 0.54;
const SWIPE_THRESHOLD = screenWidth * 0.25;
const ROTATION_FACTOR = 30;

export interface SwipeableCard {
  id: string;
  tokenName: string;
  tokenSymbol: string;
  tokenLogo?: string;
  image?: string; // Real token image URL
  primaryColor?: string; // Primary color extracted from image
  secondaryColor?: string; // Secondary color for gradients
  currentPrice: number;
  marketCap: number;
  volume24h?: number;
  priceChange24h: number;
  tokenSecurity?: number; // 0-100 score (0 is best, 100 is worst)
  bondingCurve?: number; // 0-100 percentage
  description?: string;
  trendingReason?: string;
}

export interface OptimizedSwipeableCardsProps {
  cards: SwipeableCard[];
  onSwipeRight: (card: SwipeableCard) => Promise<void> | void;
  onSwipeLeft: (card: SwipeableCard) => Promise<void> | void;
  onCardRunOut?: () => void;
  onLoadMore?: () => void;
  isLoading?: boolean;
  renderCard?: (card: SwipeableCard) => React.ReactNode;
}

const OptimizedSwipeableCards: React.FC<OptimizedSwipeableCardsProps> = ({
  cards,
  onSwipeRight,
  onSwipeLeft,
  onCardRunOut,
  onLoadMore,
  isLoading = false,
  renderCard,
}) => {
  const { currentTheme } = useTheme();
  const isDark = currentTheme === "dark";
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Animation values for the top card
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  // Animation values for the second card (scale effect)
  const secondCardScale = useSharedValue(0.95);
  const secondCardOpacity = useSharedValue(0.8);

  const resetCardPosition = useCallback(() => {
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    scale.value = withSpring(1);
    secondCardScale.value = withSpring(0.95);
    secondCardOpacity.value = withSpring(0.8);
  }, [translateX, translateY, scale, secondCardScale, secondCardOpacity]);

  const removeTopCard = useCallback(() => {
    // Reset position for next card immediately without animation
    translateX.value = 0;
    translateY.value = 0;
    scale.value = 1;
    secondCardScale.value = 1;
    secondCardOpacity.value = 1;

    setCurrentIndex((prev) => {
      const newIndex = prev + 1;

      // Defer callback execution to avoid setState during render
      setTimeout(() => {
        // Trigger load more when approaching end
        if (newIndex >= cards.length - 5 && onLoadMore) {
          onLoadMore();
        }

        if (newIndex >= cards.length && onCardRunOut) {
          onCardRunOut();
        }
      }, 0);

      return newIndex;
    });
  }, [
    cards.length,
    onCardRunOut,
    onLoadMore,
    translateX,
    translateY,
    scale,
    secondCardScale,
    secondCardOpacity,
  ]);

  const handleSwipe = useCallback(
    async (direction: "left" | "right", card: SwipeableCard) => {
      try {
        if (direction === "right") {
          await onSwipeRight(card);
        } else {
          await onSwipeLeft(card);
        }
      } catch (error) {
        console.error("Swipe action failed:", error);
        // Reset card position on error
        resetCardPosition();
        setIsProcessing(false);
      }
    },
    [onSwipeRight, onSwipeLeft, resetCardPosition],
  );

  const animateCardExit = useCallback(
    (direction: "left" | "right", card: SwipeableCard) => {
      if (isProcessing) return;

      const targetX = direction === "right" ? screenWidth : -screenWidth;

      // Set processing state before starting animation
      setIsProcessing(true);

      // Animate the card exit
      const animationDuration = 400;

      translateX.value = withTiming(
        targetX,
        {
          duration: animationDuration,
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (finished) {
            runOnJS(removeTopCard)();
            runOnJS(setIsProcessing)(false);
          }
        },
      );

      translateY.value = withTiming(0, {
        duration: animationDuration,
        easing: Easing.out(Easing.cubic),
      });

      scale.value = withTiming(0.8, {
        duration: animationDuration,
        easing: Easing.out(Easing.cubic),
      });

      // Animate second card to front
      secondCardScale.value = withTiming(1, {
        duration: animationDuration,
        easing: Easing.out(Easing.cubic),
      });

      secondCardOpacity.value = withTiming(1, {
        duration: animationDuration,
        easing: Easing.out(Easing.cubic),
      });

      // Execute the swipe action
      runOnJS(handleSwipe)(direction, card);
    },
    [
      isProcessing,
      translateX,
      translateY,
      scale,
      secondCardScale,
      secondCardOpacity,
      removeTopCard,
      handleSwipe,
    ],
  );

  const panGesture = Gesture.Pan()
    .onStart(() => {
      scale.value = withSpring(1.05);
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;

      // Scale second card based on swipe progress
      const progress = Math.abs(event.translationX) / SWIPE_THRESHOLD;
      secondCardScale.value = interpolate(progress, [0, 1], [0.95, 1], "clamp");
      secondCardOpacity.value = interpolate(
        progress,
        [0, 1],
        [0.8, 1],
        "clamp",
      );
    })
    .onEnd((event) => {
      const shouldSwipe = Math.abs(translateX.value) > SWIPE_THRESHOLD;

      if (shouldSwipe && !isProcessing) {
        const direction = translateX.value > 0 ? "right" : "left";
        const targetX = direction === "right" ? screenWidth : -screenWidth;

        // Set processing state before starting animation
        runOnJS(setIsProcessing)(true);

        // Use timing animation for smoother, more linear exit
        const animationDuration = Math.max(
          250,
          Math.min(400, 400 - Math.abs(event.velocityX) * 0.1),
        );

        translateX.value = withTiming(
          targetX,
          {
            duration: animationDuration,
            easing: Easing.out(Easing.cubic),
          },
          (finished) => {
            if (finished) {
              runOnJS(removeTopCard)();
              runOnJS(setIsProcessing)(false);
            }
          },
        );
        translateY.value = withTiming(
          translateY.value + event.velocityY * 0.05,
          {
            duration: animationDuration,
            easing: Easing.out(Easing.cubic),
          },
        );
        scale.value = withTiming(0.8, {
          duration: animationDuration,
          easing: Easing.out(Easing.cubic),
        });

        const currentCard = cards[currentIndex];
        if (currentCard) {
          runOnJS(handleSwipe)(direction, currentCard);
        }
      } else {
        runOnJS(resetCardPosition)();
      }
    })
    .enabled(!isLoading && !isProcessing);

  // Animated styles for the top card
  const topCardStyle = useAnimatedStyle(() => {
    const rotation = interpolate(
      translateX.value,
      [-screenWidth, 0, screenWidth],
      [-ROTATION_FACTOR, 0, ROTATION_FACTOR],
      "clamp",
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
        { rotate: `${rotation}deg` },
      ],
      opacity: isProcessing ? 0 : 1,
    };
  });

  // Animated styles for the second card
  const secondCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: secondCardScale.value }],
    opacity: secondCardOpacity.value,
  }));

  // Skip indicator (left swipe) - positioned on the left side
  const skipIndicatorStyle = useAnimatedStyle(() => {
    const progress = Math.abs(translateX.value) / SWIPE_THRESHOLD;
    const isLeftSwipe = translateX.value < 0;

    return {
      opacity: isProcessing
        ? 0
        : isLeftSwipe
          ? interpolate(
              Math.abs(translateX.value),
              [0, SWIPE_THRESHOLD * 0.5],
              [0, 1],
              "clamp",
            )
          : 0,
      transform: [
        {
          scale: isLeftSwipe
            ? interpolate(
                Math.abs(translateX.value),
                [0, SWIPE_THRESHOLD],
                [0.8, 1.2],
                "clamp",
              )
            : 0.8,
        },
      ],
    };
  });

  // Buy indicator (right swipe) - positioned on the right side
  const buyIndicatorStyle = useAnimatedStyle(() => {
    const progress = Math.abs(translateX.value) / SWIPE_THRESHOLD;
    const isRightSwipe = translateX.value > 0;

    return {
      opacity: isProcessing
        ? 0
        : isRightSwipe
          ? interpolate(
              translateX.value,
              [0, SWIPE_THRESHOLD * 0.5],
              [0, 1],
              "clamp",
            )
          : 0,
      transform: [
        {
          scale: isRightSwipe
            ? interpolate(
                translateX.value,
                [0, SWIPE_THRESHOLD],
                [0.8, 1.2],
                "clamp",
              )
            : 0.8,
        },
      ],
    };
  });

  const formatNumber = (num: number) => {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(2);
  };

  const getSecurityColor = (score?: number) => {
    if (score === undefined) return "subtle";
    if (score <= 20) return "success";
    if (score <= 40) return "warning";
    return "error";
  };

  const getChangeIndicator = (change: number) => {
    const absChange = Math.abs(change);
    if (absChange >= 20)
      return {
        icon: change > 0 ? "trending-up" : "trending-down",
        color: change > 0 ? "success" : "error",
        size: 20,
      };
    if (absChange >= 10)
      return {
        icon: change > 0 ? "arrow-up-right" : "arrow-down-right",
        color: change > 0 ? "success" : "error",
        size: 18,
      };
    if (absChange >= 5)
      return {
        icon: change > 0 ? "arrow-up" : "arrow-down",
        color: change > 0 ? "success" : "error",
        size: 16,
      };
    return {
      icon: change > 0 ? "chevron-up" : "chevron-down",
      color: change > 0 ? "success" : "error",
      size: 14,
    };
  };

  const defaultCardRenderer = (card: SwipeableCard) => (
    <Box
      background="base"
      rounded="xl"
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        // Token-based border
        borderWidth: 1,
        borderColor: card.primaryColor || '#E5E7EB',
      }}
    >
      {/* Gradient overlay for 3D raised effect */}
      {card.primaryColor && card.secondaryColor && (
        <>
          <LinearGradient
            colors={[
              `${card.primaryColor}30`, // 30% opacity at top
              `${card.primaryColor}20`, // 20% opacity
              `${card.secondaryColor}20`, // 20% opacity
              `${card.secondaryColor}25`, // 25% opacity at bottom
            ]}
            locations={[0, 0.4, 0.7, 1]}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1,
            }}
          />
        </>
      )}

      {/* Content container */}
      <Box
        p="lg"
        style={{
          position: "relative",
          zIndex: 3,
          width: "100%",
          height: "100%",
        }}
      >
        <Box direction="row" alignItems="center" mb="lg" gap="md">
          <Box
            rounded="full"
            center
            style={{ width: 50, height: 50, overflow: "hidden" }}
          >
            {card.image ? (
              card.primaryColor && card.secondaryColor ? (
                <LinearGradient
                  colors={[card.primaryColor, card.secondaryColor]}
                  style={{
                    width: 50,
                    height: 50,
                    justifyContent: "center",
                    alignItems: "center",
                    borderRadius: 25,
                  }}
                >
                  <Image
                    source={{ uri: card.image }}
                    style={{ width: 40, height: 40, borderRadius: 20 }}
                    resizeMode="cover"
                  />
                </LinearGradient>
              ) : (
                <Image
                  source={{ uri: card.image }}
                  style={{ width: 50, height: 50, borderRadius: 25 }}
                  resizeMode="cover"
                />
              )
            ) : (
              <Box
                background="subtle"
                rounded="full"
                center
                style={{ width: 50, height: 50 }}
              >
                <Text size="md" weight="bold">
                  {card.tokenSymbol}
                </Text>
              </Box>
            )}
          </Box>
          <Box flex>
            <Text size="lg" weight="bold">
              {card.tokenName}
            </Text>
            <Text size="sm" mode="subtle">
              {card.tokenSymbol}
            </Text>
          </Box>
        </Box>

        <Box
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          mb="lg"
        >
          <Box>
            <Text size="xl" weight="bold">
              ${card.currentPrice.toFixed(6)}
            </Text>
          </Box>
          <Box direction="row" alignItems="center" gap="sm">
            {(() => {
              const indicator = getChangeIndicator(card.priceChange24h);
              return (
                <Icon
                  icon={Feather}
                  name={indicator.icon as any}
                  size={indicator.size}
                  color={indicator.color as any}
                />
              );
            })()}
            <Text
              size="md"
              weight="semibold"
              mode={card.priceChange24h >= 0 ? "success" : "error"}
            >
              {card.priceChange24h >= 0 ? "+" : ""}
              {card.priceChange24h.toFixed(2)}%
            </Text>
          </Box>
        </Box>

        <Box gap="md" mb="lg">
          <Box direction="row" justifyContent="space-between">
            <Box>
              <Text size="sm" mode="subtle">
                Market Cap
              </Text>
              <Text size="md" weight="semibold">
                ${formatNumber(card.marketCap)}
              </Text>
            </Box>
            {card.volume24h && (
              <Box alignItems="flex-end">
                <Text size="sm" mode="subtle">
                  24h Volume
                </Text>
                <Text size="md" weight="semibold">
                  ${formatNumber(card.volume24h)}
                </Text>
              </Box>
            )}
          </Box>

          <Box direction="row" justifyContent="space-between">
            {card.bondingCurve !== undefined && (
              <Box>
                <Text size="sm" mode="subtle">
                  Bonding Curve
                </Text>
                <Box
                  direction="row"
                  alignItems="center"
                  gap="sm"
                  style={{ marginTop: 4 }}
                >
                  <Box
                    style={{
                      width: 80,
                      height: 6,
                      backgroundColor: isDark ? "#333" : "#e5e5e5",
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <Box
                      style={{
                        width: `${card.bondingCurve}%`,
                        height: "100%",
                        backgroundColor:
                          card.bondingCurve >= 70 ? "#fbbf24" : "#3b82f6",
                      }}
                    />
                  </Box>
                  <Text size="sm" weight="semibold">
                    {card.bondingCurve}%
                  </Text>
                </Box>
              </Box>
            )}
            {card.tokenSecurity !== undefined && (
              <Box alignItems="flex-end">
                <Text size="sm" mode="subtle">
                  Token Security
                </Text>
                <Text
                  size="md"
                  weight="semibold"
                  mode={getSecurityColor(card.tokenSecurity)}
                  style={{ marginTop: 4 }}
                >
                  {card.tokenSecurity}/100
                </Text>
              </Box>
            )}
          </Box>
        </Box>

        {card.description && (
          <Box mb="md">
            <Text
              size="sm"
              mode="subtle"
              style={{ textAlign: "center", lineHeight: 20 }}
            >
              {card.description}
            </Text>
          </Box>
        )}

        {card.trendingReason && (
          <Box
            background="subtle"
            rounded="md"
            p="sm"
            style={{ marginTop: "auto", paddingLeft: 16, paddingRight: 16 }}
          >
            <Box
              direction="row"
              alignItems="center"
              justifyContent="center"
              gap="sm"
            >
              <Icon icon={Feather} name="zap" size={14} color="warning" />
              <Text size="sm" mode="subtle" style={{ textAlign: "center" }}>
                {card.trendingReason}
              </Text>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );

  if (currentIndex >= cards.length) {
    return (
      <Box flex center style={{ paddingHorizontal: 20 }}>
        <Text size="lg" mode="subtle" style={{ textAlign: "center" }}>
          No more cards to swipe!
        </Text>
      </Box>
    );
  }

  const currentCard = cards[currentIndex];
  const nextCard = cards[currentIndex + 1];

  return (
    <Box style={{ paddingHorizontal: 20, paddingVertical: 5 }}>
      {/* Cards Container */}
      <Box
        center
        style={{
          height: CARD_HEIGHT,
          width: "100%",
          position: "relative",
        }}
      >
        {/* Next Card (underneath) */}
        {nextCard && (
          <Animated.View
            style={[
              {
                position: "absolute",
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
              },
              secondCardStyle,
            ]}
          >
            {renderCard ? renderCard(nextCard) : defaultCardRenderer(nextCard)}
          </Animated.View>
        )}

        {/* Current Card (top) */}
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              {
                position: "absolute",
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
              },
              topCardStyle,
            ]}
          >
            {renderCard
              ? renderCard(currentCard)
              : defaultCardRenderer(currentCard)}
          </Animated.View>
        </GestureDetector>

        {/* Skip Indicator - Left Side */}
        <Animated.View
          style={[
            {
              position: "absolute",
              top: "50%",
              left: 30,
              zIndex: 1001,
              transform: [{ translateY: -50 }],
            },
            skipIndicatorStyle,
          ]}
        >
          <Box
            background="base"
            rounded="full"
            p="lg"
            center
            shadow="lg"
            style={{
              borderWidth: 3,
              borderColor: "rgba(239, 68, 68, 0.9)",
              width: 100,
              height: 100,
            }}
          >
            <Icon icon={Feather} name="x" size={32} color="error" />
            <Text size="sm" weight="bold" mode="error" style={{ marginTop: 6 }}>
              SKIP
            </Text>
          </Box>
        </Animated.View>

        {/* Buy Indicator - Right Side */}
        <Animated.View
          style={[
            {
              position: "absolute",
              top: "50%",
              right: 30,
              zIndex: 1001,
              transform: [{ translateY: -50 }],
            },
            buyIndicatorStyle,
          ]}
        >
          <Box
            background="base"
            rounded="full"
            p="lg"
            center
            shadow="lg"
            style={{
              borderWidth: 3,
              borderColor: "rgba(34, 197, 94, 0.9)",
              width: 100,
              height: 100,
            }}
          >
            <Icon icon={Feather} name="check" size={32} color="success" />
            <Text
              size="sm"
              weight="bold"
              mode="success"
              style={{ marginTop: 6 }}
            >
              BUY
            </Text>
          </Box>
        </Animated.View>
      </Box>

      {/* Action Buttons */}
      <Box direction="row" gap="lg" center mt="md" style={{ paddingHorizontal: 50 }}>
        {/* Skip Button with Gradient */}
        <Box
          style={{
            borderRadius: 30,
            shadowColor: "#EF4444",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.25,
            shadowRadius: 12,
            elevation: 10,
          }}
        >
          <LinearGradient
            colors={["#EF4444", "#DC2626", "#B91C1C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              justifyContent: "center",
              alignItems: "center",
              opacity: (isLoading || isProcessing) ? 0.5 : 1,
            }}
          >
            <Button
              size="md"
              rounded="full"
              onPress={() => {
                const currentCard = cards[currentIndex];
                if (currentCard && !isProcessing) {
                  animateCardExit("left", currentCard);
                }
              }}
              disabled={isLoading || isProcessing}
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: "transparent",
                borderWidth: 0,
              }}
            >
              <Icon icon={Feather} name="x" size={22} color="white" />
            </Button>
          </LinearGradient>
        </Box>

        {/* Buy Button with Gradient */}
        <Box
          style={{
            borderRadius: 30,
            shadowColor: "#22C55E",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.25,
            shadowRadius: 12,
            elevation: 10,
          }}
        >
          <LinearGradient
            colors={["#22C55E", "#16A34A", "#15803D"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              justifyContent: "center",
              alignItems: "center",
              opacity: (isLoading || isProcessing) ? 0.5 : 1,
            }}
          >
            <Button
              size="md"
              rounded="full"
              onPress={() => {
                const currentCard = cards[currentIndex];
                if (currentCard && !isProcessing) {
                  animateCardExit("right", currentCard);
                }
              }}
              disabled={isLoading || isProcessing}
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: "transparent",
                borderWidth: 0,
              }}
            >
              <Icon icon={Feather} name="check" size={22} color="white" />
            </Button>
          </LinearGradient>
        </Box>
      </Box>
    </Box>
  );
};

export default OptimizedSwipeableCards;
