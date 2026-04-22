import { Box, Icon, Text } from "@/primitives";
import { Button } from "@/primitives/button";
import { Feather } from "@expo/vector-icons";
import React, { useMemo, useRef, useEffect } from "react";
import { Animated } from "react-native";
import type { Transaction as DbTransaction } from "@/db/types";

interface TokenChange {
  mint: string;
  change: number;
  decimals: number;
}

function parseTokenChanges(json: string | null): TokenChange[] {
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

interface TransactionItemV2Props {
  transaction: DbTransaction;
  onPress?: (transaction: DbTransaction) => void;
}

export const TransactionItemV2 = ({
  transaction,
  onPress,
}: TransactionItemV2Props) => {
  const entranceOpacity = useRef(new Animated.Value(0)).current;
  const entranceTranslateY = useRef(new Animated.Value(20)).current;
  const hasAnimatedEntrance = useRef(false);

  useEffect(() => {
    if (!hasAnimatedEntrance.current) {
      hasAnimatedEntrance.current = true;
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
      ]).start();
    }
  }, [entranceOpacity, entranceTranslateY]);

  const handlePress = () => {
    onPress?.(transaction);
  };

  const formatTimestamp = (blockTime: number | null) => {
    if (!blockTime) return "Pending";
    const date = new Date(blockTime * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMinutes < 1) {
      return "Just now";
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    }
  };

  const tokenChanges = useMemo(
    () => parseTokenChanges(transaction.tokenChangesJson),
    [transaction.tokenChangesJson]
  );

  const transactionInfo = useMemo(() => {
    const solChange = transaction.solChange;
    const hasTokenChanges = tokenChanges.length > 0;

    if (hasTokenChanges && tokenChanges.length >= 2) {
      return {
        type: "swap",
        title: "Swap",
        icon: "repeat" as const,
        backgroundColor: "#8B5CF6",
        isOutgoing: false,
        showAmount: false,
        amount: 0,
      };
    }

    if (hasTokenChanges) {
      const primaryChange = tokenChanges[0];
      const isReceive = primaryChange.change > 0;
      return {
        type: isReceive ? "receive" : "send",
        title: isReceive ? "Received" : "Sent",
        icon: isReceive
          ? ("arrow-down-left" as const)
          : ("arrow-up-right" as const),
        backgroundColor: isReceive ? "#059669" : "#DC2626",
        isOutgoing: !isReceive,
        showAmount: true,
        amount: Math.abs(primaryChange.change),
      };
    }

    if (Math.abs(solChange) > 0.000005) {
      const isReceive = solChange > 0;
      return {
        type: isReceive ? "receive" : "send",
        title: isReceive ? "Received" : "Sent",
        icon: isReceive
          ? ("arrow-down-left" as const)
          : ("arrow-up-right" as const),
        backgroundColor: isReceive ? "#059669" : "#DC2626",
        isOutgoing: !isReceive,
        showAmount: true,
        amount: Math.abs(solChange),
      };
    }

    return {
      type: "other",
      title: "Transaction",
      icon: "activity" as const,
      backgroundColor: "#6B7280",
      isOutgoing: false,
      showAmount: false,
      amount: 0,
    };
  }, [transaction.solChange, tokenChanges]);

  const formatAmount = (amount: number): string => {
    if (amount === 0) return "0";
    let formatted: string;
    if (amount < 0.01) {
      formatted = amount.toFixed(6);
    } else if (amount < 1) {
      formatted = amount.toFixed(4);
    } else {
      formatted = amount.toFixed(2);
    }
    // Remove trailing zeros after decimal point
    return formatted.replace(/\.?0+$/, "");
  };

  const formatAddress = (address: string | null): string => {
    if (!address) return "";
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <Animated.View
      style={{
        opacity: entranceOpacity,
        transform: [{ translateY: entranceTranslateY }],
      }}
    >
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
          <Box style={{ marginRight: 12, position: "relative" }}>
            <Box
              center
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: transactionInfo.backgroundColor,
              }}
            >
              <Icon
                icon={Feather}
                name={transactionInfo.icon}
                size={20}
                color="white"
              />
            </Box>
          </Box>

          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text
              size="md"
              weight="semibold"
              numberOfLines={1}
              style={{ marginBottom: 2 }}
            >
              {transactionInfo.title}
            </Text>

            <Box style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {transaction.counterparty && (
                <Text size="sm" mode="subtle">
                  {transactionInfo.isOutgoing ? "To" : "From"}{" "}
                  {formatAddress(transaction.counterparty)}
                </Text>
              )}
              {!transaction.success && (
                <>
                  <Text size="sm" mode="subtle">
                    •
                  </Text>
                  <Text size="sm" mode="error" weight="medium">
                    Failed
                  </Text>
                </>
              )}
            </Box>
          </Box>

          <Box style={{ alignItems: "flex-end", marginLeft: 12 }}>
            {transactionInfo.showAmount && (
              <Text
                size="md"
                weight="bold"
                mode={transactionInfo.isOutgoing ? "error" : "success"}
              >
                {transactionInfo.isOutgoing ? "-" : "+"}
                {formatAmount(transactionInfo.amount)}
              </Text>
            )}
            <Text size="sm" mode="subtle" style={{ marginTop: 2 }}>
              {formatTimestamp(transaction.blockTime)}
            </Text>
          </Box>
        </Box>
      </Button>
    </Animated.View>
  );
};
