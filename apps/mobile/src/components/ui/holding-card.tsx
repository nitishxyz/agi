import React from "react";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  SharedValue,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { Box } from "./primitives/box";
import { Text } from "./primitives/text";
import { Body, Caption, H3 } from "./typography";

export interface HoldingData {
  tokenName: string;
  tokenSymbol: string;
  currentValue: number;
  tokenQuantity: number; // Number of tokens held (e.g., 1,234.56 JUP)
  pnlPercentage: number;
  isPositive: boolean;
  sessionPnlUsd: number; // Total P&L for the entire session in USD
  sessionPnlPercentage: number; // Total P&L percentage for the entire session
  sessionIsPositive: boolean; // Whether session P&L is positive
  image?: string; // Real token image URL
  primaryColor?: string; // Primary color extracted from image
  secondaryColor?: string; // Secondary color for gradients
}

interface HoldingCardProps {
  holding: HoldingData;
  width?: SharedValue<number>;
}

const HoldingCard: React.FC<HoldingCardProps> = ({
  holding,
  width,
}) => {
  // Determine mode based on session P&L for full-width cards
  const getCardMode = () => {
    if (width) return undefined; // No mode for animated cards
    if (Math.abs(holding.sessionPnlPercentage) === 0) return undefined; // No mode when no P&L
    return holding.sessionIsPositive ? "success" : "error";
  };
  const animatedStyle = useAnimatedStyle(() => {
    if (!width) return {};
    // Add opacity fade when width goes to 0
    const opacity = interpolate(width.value, [0, 20], [0, 1], "clamp");
    return {
      width: `${width.value}%`,
      opacity,
    };
  });

  const detailOpacityStyle = useAnimatedStyle(() => {
    if (!width) return { opacity: 1 };
    // Show detailed content when width > 80%
    const opacity = interpolate(width.value, [60, 80], [0, 1], "clamp");
    return { opacity };
  });

  const minimalOpacityStyle = useAnimatedStyle(() => {
    if (!width) return { opacity: 0 };
    // Show minimal content when width < 80%
    const opacity = interpolate(width.value, [60, 80], [1, 0], "clamp");
    return { opacity };
  });

  const CardWrapper = width ? Animated.View : Box;
  const cardProps = width ? { style: animatedStyle } : {};

  return (
    <CardWrapper {...cardProps}>
      <Box
        background="base"
        mode={getCardMode()}
        rounded="lg"
        style={{ 
          height: 140, 
          position: "relative", 
          overflow: "hidden",
          borderWidth: 1,
          borderColor: width 
            ? holding.primaryColor || '#E5E7EB' // Use token color for animated cards
            : Math.abs(holding.sessionPnlPercentage) > 0 
              ? (holding.sessionIsPositive ? '#10B981' : '#EF4444') // Use P&L color for full-width cards
              : holding.primaryColor || '#E5E7EB' // Fallback to token color if no P&L
        }}
      >
        {/* Simple token gradient for animated cards only */}
        {holding.primaryColor && holding.secondaryColor && width && (
          <LinearGradient
            colors={[holding.primaryColor, holding.secondaryColor]}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: 0.15,
            }}
          />
        )}
        {/* Full content - shown when width is large */}
        {width ? (
          <Animated.View
            style={[
              {
                position: "absolute",
                top: 12,
                left: 16,
                right: 16,
                bottom: 12,
                justifyContent: "space-between",
              },
              detailOpacityStyle,
            ]}
          >
            <Box>
              <Caption mode="subtle">Current Holding</Caption>
            </Box>

            <Box direction="row" alignItems="center" gap="md">
              {/* Token Logo */}
              <Box
                rounded="full"
                center
                style={{ width: 40, height: 40, overflow: 'hidden' }}
              >
                {holding.image ? (
                  holding.primaryColor && holding.secondaryColor ? (
                    <LinearGradient
                      colors={[holding.primaryColor, holding.secondaryColor]}
                      style={{
                        width: 40,
                        height: 40,
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderRadius: 20,
                      }}
                    >
                      <Image
                        source={{ uri: holding.image }}
                        style={{ width: 32, height: 32, borderRadius: 16 }}
                        contentFit="cover"
                      />
                    </LinearGradient>
                  ) : (
                    <Image
                      source={{ uri: holding.image }}
                      style={{ width: 40, height: 40, borderRadius: 20 }}
                      contentFit="cover"
                    />
                  )
                ) : (
                  <Box
                    background="subtle"
                    rounded="full"
                    center
                    style={{ width: 40, height: 40 }}
                  >
                    <Text size="sm" weight="bold">
                      {holding.tokenSymbol}
                    </Text>
                  </Box>
                )}
              </Box>

              {/* Token Info and Stats */}
              <Box style={{ flex: 1 }}>
                <Box direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <H3>{holding.tokenName}</H3>
                    <Caption mode="subtle">
                      {holding.tokenQuantity.toLocaleString()} {holding.tokenSymbol}
                    </Caption>
                  </Box>
                  
                  <Box alignItems="flex-end">
                    <Body weight="semibold">
                      ${holding.currentValue.toFixed(2)}
                    </Body>
                    <Body
                      weight="semibold"
                      mode={holding.isPositive ? "success" : "error"}
                    >
                      {holding.isPositive ? "+" : ""}
                      {holding.pnlPercentage.toFixed(2)}%
                    </Body>
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* Session P&L */}
            <Box direction="row" justifyContent="space-between" alignItems="center">
              <Caption mode="subtle">Session P&L</Caption>
              <Body
                weight="semibold"
                mode={holding.sessionIsPositive ? "success" : "error"}
              >
                {holding.sessionIsPositive ? "+" : ""}${Math.abs(holding.sessionPnlUsd).toFixed(2)} ({holding.sessionIsPositive ? "+" : ""}{holding.sessionPnlPercentage.toFixed(2)}%)
              </Body>
            </Box>
          </Animated.View>
        ) : (
          // Static full content when no width animation - use same positioning as animated
          <Box
            style={{
              position: "absolute",
              top: 12,
              left: 16,
              right: 16,
              bottom: 12,
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Caption mode="subtle">Current Holding</Caption>
            </Box>

            <Box direction="row" alignItems="center" gap="md">
              {/* Token Logo */}
              <Box
                rounded="full"
                center
                style={{ width: 40, height: 40, overflow: 'hidden' }}
              >
                {holding.image ? (
                  holding.primaryColor && holding.secondaryColor ? (
                    <LinearGradient
                      colors={[holding.primaryColor, holding.secondaryColor]}
                      style={{
                        width: 40,
                        height: 40,
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderRadius: 20,
                      }}
                    >
                      <Image
                        source={{ uri: holding.image }}
                        style={{ width: 32, height: 32, borderRadius: 16 }}
                        contentFit="cover"
                      />
                    </LinearGradient>
                  ) : (
                    <Image
                      source={{ uri: holding.image }}
                      style={{ width: 40, height: 40, borderRadius: 20 }}
                      contentFit="cover"
                    />
                  )
                ) : (
                  <Box
                    background="subtle"
                    rounded="full"
                    center
                    style={{ width: 40, height: 40 }}
                  >
                    <Text size="sm" weight="bold">
                      {holding.tokenSymbol}
                    </Text>
                  </Box>
                )}
              </Box>

              {/* Token Info and Stats */}
              <Box style={{ flex: 1 }}>
                <Box direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <H3>{holding.tokenName}</H3>
                    <Caption mode="subtle">
                      {holding.tokenQuantity.toLocaleString()} {holding.tokenSymbol}
                    </Caption>
                  </Box>
                  
                  <Box alignItems="flex-end">
                    <Body weight="semibold">
                      ${holding.currentValue.toFixed(2)}
                    </Body>
                    <Body
                      weight="semibold"
                      mode={holding.isPositive ? "success" : "error"}
                    >
                      {holding.isPositive ? "+" : ""}
                      {holding.pnlPercentage.toFixed(2)}%
                    </Body>
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* Session P&L */}
            <Box direction="row" justifyContent="space-between" alignItems="center">
              <Caption mode="subtle">Session P&L</Caption>
              <Body
                weight="semibold"
                mode={holding.sessionIsPositive ? "success" : "error"}
              >
                {holding.sessionIsPositive ? "+" : ""}${Math.abs(holding.sessionPnlUsd).toFixed(2)} ({holding.sessionIsPositive ? "+" : ""}{holding.sessionPnlPercentage.toFixed(2)}%)
              </Body>
            </Box>
          </Box>
        )}

        {/* Minimal content - shown when width is small */}
        {width && (
          <Animated.View
            style={[
              {
                position: "absolute",
                top: 16,
                left: 16,
                right: 16,
                bottom: 16,
                justifyContent: "center",
                alignItems: "center",
              },
              minimalOpacityStyle,
            ]}
          >
            <Box center gap="sm">
              {/* Token Logo */}
              <Box
                rounded="full"
                center
                style={{ width: 28, height: 28, overflow: 'hidden' }}
              >
                {holding.image ? (
                  holding.primaryColor && holding.secondaryColor ? (
                    <LinearGradient
                      colors={[holding.primaryColor, holding.secondaryColor]}
                      style={{
                        width: 28,
                        height: 28,
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderRadius: 14,
                      }}
                    >
                      <Image
                        source={{ uri: holding.image }}
                        style={{ width: 32, height: 32, borderRadius: 16 }}
                        contentFit="cover"
                      />
                    </LinearGradient>
                  ) : (
                    <Image
                      source={{ uri: holding.image }}
                      style={{ width: 40, height: 40, borderRadius: 20 }}
                      contentFit="cover"
                    />
                  )
                ) : (
                  <Box
                    background="subtle"
                    rounded="full"
                    center
                    style={{ width: 28, height: 28 }}
                  >
                    <Text size="xs" weight="bold">
                      {holding.tokenSymbol}
                    </Text>
                  </Box>
                )}
              </Box>

              {/* Token Info */}
              <Box center>
                <Text size="sm" weight="bold">
                  {holding.tokenName}
                </Text>
                <Caption mode="subtle">
                  {holding.tokenQuantity.toLocaleString()} {holding.tokenSymbol}
                </Caption>
              </Box>

              {/* Value */}
              <Body weight="semibold">${holding.currentValue.toFixed(2)}</Body>
            </Box>
          </Animated.View>
        )}
      </Box>
    </CardWrapper>
  );
};

export default HoldingCard;