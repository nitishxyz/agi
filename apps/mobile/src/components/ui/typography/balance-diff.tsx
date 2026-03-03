import { StyleSheet } from "react-native-unistyles";
import { Text } from "../primitives/text";
import { Box } from "../primitives/box";
import { Feather } from "@expo/vector-icons";
import { Icon } from "../primitives/icon";

const balanceDiff = {
  value: 83.12,
  isPositive: true,
};

const BalanceDiff = () => {
  return (
    <Box direction="row" border="thin" rounded="md" style={styles.container}>
      <Icon
        icon={Feather}
        name={balanceDiff.isPositive ? "arrow-up-right" : "arrow-down-right"}
        size={14}
        color={balanceDiff.isPositive ? "success" : "error"}
      />
      <Text weight="medium" mode={balanceDiff.isPositive ? "success" : "error"}>
        {balanceDiff.value.toFixed(2)}%
      </Text>
    </Box>
  );
};

export default BalanceDiff;

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    height: 25,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.sm,
  },
}));
