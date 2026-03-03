import { StyleSheet } from "react-native-unistyles";
import { Box, Text } from "../primitives";
import { useUser } from "@/src/services/api";
import DicebearAvatar from "../dicebear-avatar";

export const StocksHeader = () => {
  const { data: user } = useUser();
  return (
    <Box
      background="base"
      direction="row"
      alignItems="center"
      pl="md"
      pr="md"
      pb="sm"
      style={styles.blurView}
      gap="sm"
    >
      <DicebearAvatar seed={user?.id ?? ""} size={50} />
      <Box flex alignItems="flex-start">
        <Text size="md" weight="regular" mode="subtle">
          Welcome!
        </Text>
        <Text size="xxl" weight="medium">
          {user?.username}
        </Text>
      </Box>
    </Box>
  );
};

const styles = StyleSheet.create((theme, rt) => ({
  blurView: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingTop: rt.insets.top,
  },
  pfpContainer: {
    width: 50,
    height: 50,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.background.subtle,
  },
}));
