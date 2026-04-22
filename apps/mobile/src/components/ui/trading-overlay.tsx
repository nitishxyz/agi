import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { Image } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useUnistyles } from "react-native-unistyles";
import { Box } from "./primitives/box";
import { Icon } from "./primitives/icon";
import { Text } from "./primitives/text";
import { Caption } from "./typography";

interface TokenData {
  symbol: string;
  name: string;
  image?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

interface TradingOverlayProps {
  isVisible: boolean;
  fromToken: TokenData;
  toToken: TokenData;
}

const TradingOverlay: React.FC<TradingOverlayProps> = ({
  isVisible,
  fromToken,
  toToken,
}) => {
  const { theme } = useUnistyles();

  // Animation values
  const overlayOpacity = useSharedValue(0);
  const overlayScale = useSharedValue(0.8);
  const pulseScale = useSharedValue(1);
  const swapRotation = useSharedValue(0);

  // Animate overlay when visibility changes
  useEffect(() => {
    if (isVisible) {
      // Show overlay with smooth entrance
      overlayOpacity.value = withTiming(1, { duration: 300 });
      overlayScale.value = withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.back(1.2)),
      });

      // Start pulsing animation
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        true
      );

      // Start swap rotation animation
      swapRotation.value = withRepeat(
        withTiming(360, { duration: 2000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      // Hide overlay
      overlayOpacity.value = withTiming(0, { duration: 200 });
      overlayScale.value = withTiming(0.8, { duration: 200 });
      pulseScale.value = 1;
    }
  }, [isVisible]);

  // Animated styles
  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: overlayScale.value }],
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const swapAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${swapRotation.value}deg` }],
  }));

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10,
        },
        overlayAnimatedStyle,
      ]}
    >
      <LinearGradient
        colors={["transparent", `${theme.colors.brand[500]}CC`]}
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Animated.View style={cardAnimatedStyle}>
          <Box
            background="base"
            rounded="lg"
            p="lg"
            center
            gap="md"
            style={{ minWidth: 200 }}
          >
            <Animated.View style={pulseAnimatedStyle}>
              <Box center gap="md">
                {/* Token Swap Animation */}
                <Box direction="row" alignItems="center" gap="md">
                  {/* From Token */}
                  <Box
                    rounded="full"
                    center
                    style={{ width: 48, height: 48, overflow: 'hidden' }}
                  >
                    {fromToken.image ? (
                      fromToken.primaryColor && fromToken.secondaryColor ? (
                        <LinearGradient
                          colors={[fromToken.primaryColor, fromToken.secondaryColor]}
                          style={{
                            width: 48,
                            height: 48,
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderRadius: 24,
                          }}
                        >
                          <Image
                            source={{ uri: fromToken.image }}
                            style={{ width: 38, height: 38, borderRadius: 19 }}
                            resizeMode="cover"
                          />
                        </LinearGradient>
                      ) : (
                        <Image
                          source={{ uri: fromToken.image }}
                          style={{ width: 48, height: 48, borderRadius: 24 }}
                          resizeMode="cover"
                        />
                      )
                    ) : (
                      <Box
                        background="subtle"
                        rounded="full"
                        center
                        style={{ width: 48, height: 48 }}
                      >
                        <Text size="sm" weight="bold">
                          {fromToken.symbol}
                        </Text>
                      </Box>
                    )}
                  </Box>

                  {/* Animated Swap Icon - same as swap-transition */}
                  <Animated.View style={swapAnimatedStyle}>
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

                  {/* To Token */}
                  <Box
                    rounded="full"
                    center
                    style={{ width: 48, height: 48, overflow: 'hidden' }}
                  >
                    {toToken.image ? (
                      toToken.primaryColor && toToken.secondaryColor ? (
                        <LinearGradient
                          colors={[toToken.primaryColor, toToken.secondaryColor]}
                          style={{
                            width: 48,
                            height: 48,
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderRadius: 24,
                          }}
                        >
                          <Image
                            source={{ uri: toToken.image }}
                            style={{ width: 38, height: 38, borderRadius: 19 }}
                            resizeMode="cover"
                          />
                        </LinearGradient>
                      ) : (
                        <Image
                          source={{ uri: toToken.image }}
                          style={{ width: 48, height: 48, borderRadius: 24 }}
                          resizeMode="cover"
                        />
                      )
                    ) : (
                      <Box
                        background="subtle"
                        rounded="full"
                        center
                        style={{ width: 48, height: 48 }}
                      >
                        <Text size="sm" weight="bold">
                          {toToken.symbol}
                        </Text>
                      </Box>
                    )}
                  </Box>
                </Box>

                <Text size="lg" weight="bold">
                  Trading in Progress
                </Text>
              </Box>
            </Animated.View>

            <Box center>
              <Caption mode="subtle">
                Swapping {fromToken.symbol} → {toToken.symbol}
              </Caption>
            </Box>
          </Box>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
};

export default TradingOverlay;
