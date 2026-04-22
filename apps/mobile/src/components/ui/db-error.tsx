import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Text } from "./primitives/text";

export const DbError = () => {
  return (
    <View style={styles.container}>
      <Text size="xl" weight="bold" mode="error" style={styles.title}>
        Database Error
      </Text>
      <Text size="md" mode="error" style={styles.message}>
        There was an error initializing the database. Please restart the
        application or contact support if the issue persists.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.background.default,
  },
  title: {
    marginBottom: theme.spacing.md,
  },
  message: {
    textAlign: "center",
  },
}));
