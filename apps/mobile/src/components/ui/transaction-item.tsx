import USDCIcon from "@/assets/icons/usdc-icon";
import { Transaction, getRouteById, routeColors } from "@/data/dummy-data";
import { Box, Icon, Text } from "@/primitives";
import { Button } from "@/primitives/button";
import { Feather } from "@expo/vector-icons";
import React from "react";

interface TransactionItemProps {
  transaction: Transaction;
  onPress?: (transaction: Transaction) => void;
}

export const TransactionItem = ({
  transaction,
  onPress,
}: TransactionItemProps) => {
  const route = getRouteById(transaction.routeId);

  const handlePress = () => {
    onPress?.(transaction);
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) {
      return "Just now";
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    }
  };

  return (
    <Button
      variant="ghost"
      size="auto"
      onPress={handlePress}
      style={{
        paddingVertical: 12,
        paddingHorizontal: 16,
      }}
    >
      <Box direction="row" alignItems="flex-start">
        {/* Left: Route Icon with token overlay */}
        <Box style={{ marginRight: 12, position: "relative" }}>
          {/* Main route icon background */}
          <Box
            center
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: route?.color
                ? routeColors[route.color]
                : routeColors.blue,
            }}
          >
            <Icon
              icon={Feather}
              name={(route?.icon as any) || "archive"}
              size={20}
              color="white"
            />
          </Box>

          {/* Small token icon overlay (top right) */}
          <Box
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: "white",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.1)",
            }}
          >
            <USDCIcon width={14} height={14} />
          </Box>
        </Box>

        {/* Center: Transaction Details */}
        <Box style={{ flex: 1, minWidth: 0 }}>
          {/* Route name */}
          <Text
            size="md"
            weight="semibold"
            numberOfLines={1}
            style={{ marginBottom: 2 }}
          >
            {route?.name || "Unknown Route"}
          </Text>

          {/* Payment details row */}
          <Box style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text size="sm" mode="subtle">
              Paid in {transaction.originalToken}
            </Text>

            {transaction.isInvoiceTransaction && (
              <>
                <Text size="sm" mode="subtle">
                  •
                </Text>
                <Text size="sm" mode="subtle" weight="medium">
                  Invoice
                </Text>
              </>
            )}
          </Box>
        </Box>

        {/* Right: Amount and Time */}
        <Box style={{ alignItems: "flex-end", marginLeft: 12 }}>
          <Text size="md" weight="bold" mode="success">
            +${transaction.usdcAmount.toFixed(2)}
          </Text>
          <Text size="sm" mode="subtle" style={{ marginTop: 2 }}>
            {formatTimestamp(transaction.timestamp)}
          </Text>
        </Box>
      </Box>
    </Button>
  );
};
