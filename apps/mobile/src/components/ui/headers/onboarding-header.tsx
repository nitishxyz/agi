import { Box, Text } from "@/components/ui/primitives";
import { StyleSheet } from "react-native-unistyles";

export type OnboardingHeaderProps = {
  title: string;
};

const OnboardingHeader = ({ title }: OnboardingHeaderProps) => {
  return (
    <Box style={styles.header}>
      <Text size="mega" weight="bold" style={styles.title}>
        {title}
      </Text>
    </Box>
  );
};

const styles = StyleSheet.create((theme, rt) => ({
  header: {},
  title: {
    textAlign: "center",
    paddingVertical: 14,
  },
}));

export { OnboardingHeader };
