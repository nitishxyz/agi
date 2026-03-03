import { useEffect, useState, useCallback } from "react";
import { Redirect } from "expo-router";
import { Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { Box, Text, Button } from "@/components/ui/primitives";
import { isOnboardingComplete, hasWallet, deleteWallet, resetOnboarding } from "@/services/wallet";

type AppState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; redirectPath: string };

const SPLASH_ICON_SIZE = 200;
const FINAL_ICON_SIZE = 48;

type SplashLoaderProps = {
  skipIntro?: boolean;
};

const SplashLoader = ({ skipIntro = false }: SplashLoaderProps) => {
  const rotation = useSharedValue(0);
  const iconScale = useSharedValue(skipIntro ? FINAL_ICON_SIZE / SPLASH_ICON_SIZE : 1);
  const loaderOpacity = useSharedValue(skipIntro ? 1 : 0);

  useEffect(() => {
    if (skipIntro) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      iconScale.value = withDelay(
        200,
        withTiming(FINAL_ICON_SIZE / SPLASH_ICON_SIZE, {
          duration: 500,
          easing: Easing.out(Easing.cubic)
        })
      );

      loaderOpacity.value = withDelay(
        500,
        withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) })
      );

      setTimeout(() => {
        rotation.value = withRepeat(
          withTiming(360, { duration: 1000, easing: Easing.linear }),
          -1,
          false
        );
      }, 600);
    }

    return () => {
      cancelAnimation(rotation);
      cancelAnimation(iconScale);
      cancelAnimation(loaderOpacity);
    };
  }, [skipIntro]);

  const rotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const loaderStyle = useAnimatedStyle(() => ({
    opacity: loaderOpacity.value,
  }));

  return (
    <Box center style={styles.wrapper}>
      <Animated.View style={[styles.loaderContainer, loaderStyle]}>
        <Animated.View style={[styles.spinnerRing, rotationStyle]} />
        <Box style={styles.iconCenter} center />
      </Animated.View>
      <Animated.View style={[styles.iconWrapper, iconStyle]}>
        <Box style={{ width: SPLASH_ICON_SIZE, height: SPLASH_ICON_SIZE }} center>
          <Text size="xxl" weight="bold">O</Text>
        </Box>
      </Animated.View>
    </Box>
  );
};

function DevResetButton({ onPress }: { onPress: () => void }) {
  if (!__DEV__) return null;

  return (
    <Pressable
      onPress={onPress}
      style={{
        position: "absolute",
        top: 60,
        right: 16,
        zIndex: 100,
        padding: 8,
        backgroundColor: "rgba(255, 0, 0, 0.2)",
        borderRadius: 8,
      }}
    >
      <Text size="xs" style={{ color: "#ff6666" }}>
        DEV RESET
      </Text>
    </Pressable>
  );
}

export default function Index() {
  const [appState, setAppState] = useState<AppState>({ status: "loading" });

  const checkState = useCallback(async () => {
    try {
      const [hasWal, onboarded] = await Promise.all([
        hasWallet(),
        isOnboardingComplete(),
      ]);

      if (hasWal && onboarded) {
        setAppState({ status: "ready", redirectPath: "/(app)/tabs/home" });
        return;
      }

      if (hasWal && !onboarded) {
        setAppState({ status: "ready", redirectPath: "/tutorial" });
      } else {
        setAppState({ status: "ready", redirectPath: "/welcome" });
      }
    } catch (e: any) {
      console.error("Check state error:", e);
      setAppState({ status: "error", error: e.message || "Something went wrong" });
    }
  }, []);

  useEffect(() => {
    checkState();
  }, [checkState]);

  const handleRetry = useCallback(() => {
    setAppState({ status: "loading" });
    checkState();
  }, [checkState]);

  const handleDevReset = useCallback(async () => {
    try {
      await deleteWallet();
      await resetOnboarding();
      setAppState({ status: "ready", redirectPath: "/welcome" });
    } catch (err) {
      console.error("Dev reset error:", err);
    }
  }, []);

  if (appState.status === "loading") {
    return (
      <Box flex center background="darkest">
        <SplashLoader />
      </Box>
    );
  }

  if (appState.status === "error") {
    return (
      <Box flex center background="darkest" px="lg">
        <DevResetButton onPress={handleDevReset} />
        <Text size="lg" weight="semibold" style={{ marginBottom: 8, textAlign: "center" }}>
          Connection Error
        </Text>
        <Text size="md" mode="subtle" style={{ marginBottom: 24, textAlign: "center" }}>
          {appState.error}
        </Text>
        <Button size="lg" rounded="full" onPress={handleRetry}>
          <Button.Text weight="semibold">Try Again</Button.Text>
        </Button>
      </Box>
    );
  }

  if (appState.status === "ready") {
    return <Redirect href={appState.redirectPath as any} />;
  }

  return null;
}

const styles = StyleSheet.create((theme) => ({
  wrapper: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  loaderContainer: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background.subtle,
  },
  spinnerRing: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: theme.colors.border.subtle,
    borderTopColor: theme.colors.brand[500],
  },
  iconCenter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.background.base,
  },
  iconWrapper: {
    position: "absolute",
  },
}));
