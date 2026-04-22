import { Box, Text, Icon, Button } from "@/primitives";
import { AntDesign } from "@expo/vector-icons";
import { Animated } from "react-native";
import { Image } from "expo-image";
import type { TokenData } from "@/db/schema/tokens";
import { router } from "expo-router";
import React, { useEffect, useRef, memo, useCallback } from "react";

type StockItemProps = {
  item: TokenData;
};

const StockItemComponent = ({ item }: StockItemProps) => {
  const isPositive = (item.priceChange24h || 0) >= 0;
  const price = item.price || 0;
  const priceChange = item.priceChange24h || 0;

  // Animation values for entrance animation
  const entranceOpacity = useRef(new Animated.Value(0)).current;
  const entranceTranslateY = useRef(new Animated.Value(20)).current;
  const entranceScale = useRef(new Animated.Value(0.95)).current;

  // Track if entrance animation has been triggered
  const hasAnimatedEntrance = useRef(false);

  // Entrance animation effect
  useEffect(() => {
    if (!hasAnimatedEntrance.current) {
      hasAnimatedEntrance.current = true;

      // Start entrance animation
      Animated.parallel([
        Animated.timing(entranceOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(entranceTranslateY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(entranceScale, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [entranceOpacity, entranceTranslateY, entranceScale]);

  const navigateToStockDetailsPage = useCallback(() => {
    // Navigate to the token details page
    router.push(`/token/${item.address}`);
  }, [item.address]);

  return (
    <Animated.View
      style={{
        opacity: entranceOpacity,
        transform: [
          { translateY: entranceTranslateY },
          { scale: entranceScale },
        ],
      }}
    >
      <Button
        variant="ghost"
        style={{ paddingHorizontal: 0, marginVertical: 8 }}
        onPress={navigateToStockDetailsPage}
      >
        {/* Left: Image */}
        {item.token.image ? (
          <Box
            rounded="md"
            background="base"
            center
            style={{
              width: 40,
              height: 40,
              shadowColor: "#fff",
              shadowOffset: {
                width: 0,
                height: 0,
              },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              overflow: "hidden",
            }}
          >
            <Image
              source={{ uri: item.token.image }}
              style={{ width: 40, height: 40, borderRadius: 20 }}
              contentFit="cover"
            />
          </Box>
        ) : (
          <Box
            rounded="md"
            background="subtle"
            center
            style={{ width: 40, height: 40 }}
          >
            <Text size="sm" weight="bold">
              {item.symbol.slice(0, 2)}
            </Text>
          </Box>
        )}

        {/* Middle: Symbol and Name */}
        <Box flex>
          <Text size="lg" weight="bold">
            {item.symbol}
          </Text>
          <Text size="sm" mode="subtle" numberOfLines={1}>
            {item.name}
          </Text>
        </Box>

        {/* Right: Value and PnL */}
        <Box alignItems="flex-end">
          <Box direction="row" alignItems="flex-end">
            <Text size="lg" weight="medium">
              ${Math.floor(price)}
            </Text>
            <Text size="md" weight="medium" mode="subtle">
              .{(price % 1).toFixed(2).slice(2)}
            </Text>
          </Box>
          <Box direction="row" alignItems="center" gap="xs" mt="xs">
            {isPositive ? (
              <Icon icon={AntDesign} name="arrowup" size={12} mode="success" />
            ) : (
              <Icon icon={AntDesign} name="arrowdown" size={12} mode="error" />
            )}
            <Text
              size="sm"
              weight="semibold"
              mode={isPositive ? "success" : "error"}
            >
              {priceChange.toFixed(2)}%
            </Text>
          </Box>
        </Box>
      </Button>
    </Animated.View>
  );
};

export const StockItem = memo(StockItemComponent, (prevProps, nextProps) => {
  return (
    prevProps.item.address === nextProps.item.address &&
    prevProps.item.price === nextProps.item.price &&
    prevProps.item.priceChange24h === nextProps.item.priceChange24h
  );
});
