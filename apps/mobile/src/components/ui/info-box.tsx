import { Box, Icon } from "@/primitives";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet } from "react-native-unistyles";

export const InfoBox = ({ children }: { children?: React.ReactNode }) => {
  return (
    <Box
      direction="row"
      rounded="xl"
      background="subtle"
      p="md"
      gap="sm"
      m="sm"
      style={styles.container}
    >
      <Box background="emphasis" rounded="full" p="sm">
        <Icon icon={Ionicons} name="information-circle" size={20} />
      </Box>

      <Box flex>{children}</Box>
    </Box>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    alignItems: "flex-start",
  },
}));
