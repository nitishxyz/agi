
import { useEffect, useRef, useCallback, memo } from "react";
import * as Updates from "expo-updates";
import { useSonner } from "@/providers/sonner-provider";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { AppState } from "react-native";

const INITIAL_CHECK_DELAY_MS = 1000;
const ACTIVE_CHECK_DELAY_MS = 2000;
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const RESET_DELAY_MS = 5000;

const UpdateNotificationManagerComponent = () => {
  const { showSonner, updateSonner } = useSonner();
  const updateNotificationId = useRef<string | null>(null);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCheckingRef = useRef(false);
  const isUpdatingRef = useRef(false);

  const resetNotificationState = useCallback(() => {
    updateNotificationId.current = null;
    isUpdatingRef.current = false;
  }, []);

  const handleUpdatePress = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled || isUpdatingRef.current) {
      return;
    }

    isUpdatingRef.current = true;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (updateNotificationId.current) {
        updateSonner(updateNotificationId.current, {
          type: "loading",
          title: "Installing update...",
          persistent: true,
          onPress: undefined,
        });
      }

      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (error) {
      console.error("Error updating app:", error);

      if (updateNotificationId.current) {
        updateSonner(updateNotificationId.current, {
          type: "error",
          title: "Update failed",
          persistent: false,
          duration: RESET_DELAY_MS,
          onPress: undefined,
        });
      }

      setTimeout(resetNotificationState, RESET_DELAY_MS);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      if (!updateNotificationId.current) {
        isUpdatingRef.current = false;
      }
    }
  }, [resetNotificationState, updateSonner]);

  const checkForUpdates = useCallback(async () => {
    if (
      __DEV__ ||
      !Updates.isEnabled ||
      isCheckingRef.current ||
      isUpdatingRef.current ||
      updateNotificationId.current
    ) {
      return;
    }

    isCheckingRef.current = true;

    try {
      const updateCheck = await Updates.checkForUpdateAsync();

      if (!updateCheck.isAvailable || updateNotificationId.current) {
        return;
      }

      updateNotificationId.current = showSonner({
        type: "info",
        title: "Update available",
        persistent: true,
        icon: {
          component: Ionicons,
          name: "download-outline",
          size: 20,
        },
        onPress: handleUpdatePress,
      });
    } catch (error) {
      console.error("Error checking for updates:", error);
    } finally {
      isCheckingRef.current = false;
    }
  }, [handleUpdatePress, showSonner]);

  useEffect(() => {
    const timeoutId = setTimeout(checkForUpdates, INITIAL_CHECK_DELAY_MS);

    checkIntervalRef.current = setInterval(checkForUpdates, CHECK_INTERVAL_MS);

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        setTimeout(checkForUpdates, ACTIVE_CHECK_DELAY_MS);
      }
    });

    return () => {
      clearTimeout(timeoutId);
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      subscription.remove();
    };
  }, [checkForUpdates]);

  return null;
};

export const UpdateNotificationManager = memo(
  UpdateNotificationManagerComponent,
);
UpdateNotificationManager.displayName = "UpdateNotificationManager";
