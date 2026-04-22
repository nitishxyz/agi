import { Box, Button, Icon, Text } from "../primitives";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import BlurView from "../primitives/blur-view";
import { StyleSheet } from "react-native-unistyles";

export const PageHeader = ({ title }: { title: string }) => {
  return (
    <BlurView intensity={30} style={styles.header}>
      <Button variant="ghost" size="md" onPress={() => router.back()}>
        <Button.Text>back</Button.Text>
      </Button>
      <Box center flex>
        <Text size="xxl" weight="bold">
          {title}
        </Text>
      </Box>

      <Button variant="ghost" size="md" style={{ opacity: 0 }}>
        <Button.Text>close</Button.Text>
      </Button>
    </BlurView>
  );
};

const styles = StyleSheet.create((theme, rt) => ({
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingTop: rt.insets.top,
    flexDirection: "row",
    gap: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
}));
