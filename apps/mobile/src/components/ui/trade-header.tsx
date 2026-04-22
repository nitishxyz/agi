import React from "react";
import BlurView from "./primitives/blur-view";
import { Box } from "./primitives/box";
import { Button } from "./primitives/button";
import { Icon } from "./primitives/icon";
import { Text } from "./primitives/text";
import { Caption } from "./typography";
import { Feather } from "@expo/vector-icons";
import { StyleSheet } from "react-native-unistyles";

interface TradeHeaderProps {
  rotationCount: number;
  onClose: () => void;
  onCashOut: () => void;
}

const TradeHeader: React.FC<TradeHeaderProps> = ({
  rotationCount,
  onClose,
  onCashOut,
}) => {
  return (
    <BlurView intensity={30} style={styles.header}>
      <Button variant="ghost" size="sm" onPress={onClose}>
        <Button.Icon>
          {(props) => <Icon {...props} icon={Feather} name="x" size={24} />}
        </Button.Icon>
      </Button>

      <Box center flex>
        <Text size="xl" weight="bold">
          Trading Game
        </Text>
        <Caption mode="subtle">Rotations: {rotationCount}</Caption>
      </Box>

      <Button variant="ghost" size="sm" onPress={onCashOut}>
        <Button.Text>Cash Out</Button.Text>
      </Button>
    </BlurView>
  );
};

const styles = StyleSheet.create((theme) => ({
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
  },
}));

export default TradeHeader;