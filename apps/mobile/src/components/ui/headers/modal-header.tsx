import { useCallback } from "react";
import { Box, Button, Text } from "../primitives";
import { router } from "expo-router";
import BlurView from "../primitives/blur-view";
import { StyleSheet } from "react-native-unistyles";
import Avatar from "../avatar";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

interface ModalHeaderProps {
  title: string;
  /** Show back button on left (for sub-pages). When false/undefined, shows close button on right (for root pages) */
  backEnabled?: boolean;
  /** Custom back handler. If not provided, uses router.back() */
  onBack?: () => void;
  avatar?: string | null;
  showAvatar?: boolean;
}

export const ModalHeader = ({
  title,
  backEnabled,
  onBack,
  avatar,
  showAvatar = false,
}: ModalHeaderProps) => {
  const handleBack = useCallback(() => {
    if (!backEnabled) return;
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  }, [backEnabled, onBack]);

  const handleClose = useCallback(() => {
    if (backEnabled) return;
    router.back();
  }, [backEnabled]);

  return (
    <BlurView intensity={30} style={styles.header}>
      <Button
        variant="ghost"
        size="md"
        style={{ opacity: backEnabled ? 1 : 0 }}
        onPress={handleBack}
      >
        <Button.Text>back</Button.Text>
      </Button>
      <Box center flex direction="row" gap="sm">
        {showAvatar && avatar && (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
            <Avatar source={{ uri: avatar }} size={28} />
          </Animated.View>
        )}
        <Text size="xl" weight="bold">
          {title}
        </Text>
      </Box>

      <Button
        variant="ghost"
        size="md"
        style={{
          opacity: backEnabled ? 0 : 1,
        }}
        onPress={handleClose}
      >
        <Button.Text>close</Button.Text>
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
    gap: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
}));
