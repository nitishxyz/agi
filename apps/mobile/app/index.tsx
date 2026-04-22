import { useEffect, useState, useCallback } from "react";
import { Redirect } from "expo-router";
import { Pressable } from "react-native";
import { authClient, useSession } from "@/lib/auth-client";
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
import { syncUserWithBackend } from "@/hooks/use-auth";
import { authStorage } from "@/services/auth-storage";
import AppIcon from "@/assets/icons/app-icon";

type AppState = 
  | { status: "loading" }
  | { status: "syncing" }
  | { status: "sync_error"; error: string }
  | { status: "ready"; redirectPath: string };

const SPLASH_ICON_SIZE = 200;
const FINAL_ICON_SIZE = 48;

type SplashLoaderProps = {
  /** Skip the intro scale animation, just show the spinning loader */
  skipIntro?: boolean;
};

const SplashLoader = ({ skipIntro = false }: SplashLoaderProps) => {
  const rotation = useSharedValue(0);
  const iconScale = useSharedValue(skipIntro ? FINAL_ICON_SIZE / SPLASH_ICON_SIZE : 1);
  const loaderOpacity = useSharedValue(skipIntro ? 1 : 0);

  useEffect(() => {
    if (skipIntro) {
      // Start spinning immediately
      rotation.value = withRepeat(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
        -1,
        false
      );
        <AppIcon width={SPLASH_ICON_SIZE} height={SPLASH_ICON_SIZE} />
    } else {
      // Scale down the icon from splash size to final size
      iconScale.value = withDelay(
        200,
        withTiming(FINAL_ICON_SIZE / SPLASH_ICON_SIZE, { 
          duration: 500, 
          easing: Easing.out(Easing.cubic) 
        })
      );

      // Fade in the loader container and ring
      loaderOpacity.value = withDelay(
        500,
        withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) })
      );

      // Start rotation after loader fades in
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
      {/* Loader container with ring - fades in */}
      <Animated.View style={[styles.loaderContainer, loaderStyle]}>
        <Animated.View style={[styles.spinnerRing, rotationStyle]} />
        <Box style={styles.iconCenter} center />
      </Animated.View>
      {/* Icon - scales down independently, positioned on top */}
      <Animated.View style={[styles.iconWrapper, iconStyle]}>
        <AppIcon width={SPLASH_ICON_SIZE} height={SPLASH_ICON_SIZE} />
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
  const { data: session, isPending: sessionPending } = useSession();

  const isAuthenticated = !!session?.session && !!session?.user;

  const checkAndSync = useCallback(async () => {
    try {
      // Check local state first
      const [hasWal, onboarded] = await Promise.all([
        hasWallet(),
        isOnboardingComplete(),
      ]);

      // If local state is complete, go to home
      if (hasWal && onboarded) {
        setAppState({ status: "ready", redirectPath: "/(app)/tabs/home" });
        return;
      }

      if (isAuthenticated) {
        setAppState({ status: "syncing" });

        const result = await syncUserWithBackend();

        if (result.success) {
          setAppState({ status: "ready", redirectPath: "/(app)/tabs/home" });
        } else {
          setAppState({ status: "sync_error", error: result.error || "Failed to sync" });
        }
        return;
      }

      // Not authenticated and no local state - go to welcome
      if (hasWal && !onboarded) {
        setAppState({ status: "ready", redirectPath: "/tutorial" });
      } else {
        setAppState({ status: "ready", redirectPath: "/welcome" });
      }
    } catch (e: any) {
      console.error("Check state error:", e);
      setAppState({ status: "sync_error", error: e.message || "Something went wrong" });
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (sessionPending) return;
    checkAndSync();
  }, [sessionPending, checkAndSync]);

  const handleRetry = useCallback(() => {
    setAppState({ status: "loading" });
    checkAndSync();
  }, [checkAndSync]);

  const handleDevReset = useCallback(async () => {
    try {
      await authClient.signOut();
      await deleteWallet();
      await resetOnboarding();
      await authStorage.clearAll();
      setAppState({ status: "ready", redirectPath: "/welcome" });
    } catch (err) {
      console.error("Dev reset error:", err);
    }
  }, []);

  if (appState.status === "loading" || sessionPending) {
    return (
      <Box flex center background="darkest">
        <SplashLoader />
      </Box>
    );
  }

  // Syncing state - authenticated but syncing with backend
  if (appState.status === "syncing") {
    return (
      <Box flex center background="darkest" px="lg">
        <SplashLoader skipIntro />
        <Text size="md" mode="subtle" style={{ marginTop: 16, textAlign: "center" }}>
          Setting up your account...
        </Text>
      </Box>
    );
  }

  // Sync error - show retry option
  if (appState.status === "sync_error") {
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

  // Ready - redirect to appropriate screen
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
