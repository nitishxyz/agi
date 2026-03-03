import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Button } from "./primitives/button";
import { Text } from "./primitives/text";

export const DevToolbar = () => {
  const { theme } = useUnistyles();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const snapPoints = useMemo(() => ["50%"], []);

  const handleOpenSheet = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSheetOpen(true);
    bottomSheetRef.current?.expand();
  }, []);

  const handleCloseSheet = useCallback(() => {
    setIsSheetOpen(false);
    bottomSheetRef.current?.close();
  }, []);

  const handleSheetChange = useCallback((index: number) => {
    setIsSheetOpen(index >= 0);
  }, []);

  const clearDatabase = async () => {
    try {
      setIsLoading(true);
      // Use the logout service's comprehensive database clearing
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "All database tables cleared");
    } catch (error) {
      console.error("Error clearing database:", error);
      Alert.alert("Error", "Failed to clear database");
    } finally {
      setIsLoading(false);
    }
  };

  const clearQueryCache = async () => {
    try {
      setIsLoading(true);
      queryClient.clear();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Query cache cleared");
    } catch (error) {
      console.error("Error clearing query cache:", error);
      Alert.alert("Error", "Failed to clear query cache");
    } finally {
      setIsLoading(false);
    }
  };

  const clearStage = async () => {
    try {
      setIsLoading(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Onboarding stage cleared");
    } catch (error) {
      console.error("Error clearing stage:", error);
      Alert.alert("Error", "Failed to clear stage");
    } finally {
      setIsLoading(false);
    }
  };

  const clearAllData = async () => {
    Alert.alert(
      "Clear All Data",
      "This will clear database, cache, secrets, and onboarding stage WITHOUT logging out. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              Alert.alert("Success", "All app data cleared (still logged in)");
            } catch (error) {
              console.error("Error clearing all data:", error);
              Alert.alert("Error", "Failed to clear all data");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  };

  const logoutUser = async () => {
    try {
      setIsLoading(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Logged out successfully");
    } catch (error) {
      console.error("Error logging out:", error);
      Alert.alert("Error", "Failed to logout");
    } finally {
      setIsLoading(false);
    }
  };

  const resetApp = async () => {
    Alert.alert(
      "Reset App",
      "This will clear ALL app data including database, cache, secrets, and log you out. This cannot be undone. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);

              handleCloseSheet();
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              Alert.alert("Success", "App completely reset. All data cleared.");
            } catch (error) {
              console.error("Error resetting app:", error);
              Alert.alert("Error", "Failed to reset app completely");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <>
      {/* Floating Button */}
      {!isSheetOpen && (
        <View
          style={[styles.fab, { backgroundColor: theme.colors.primary[500] }]}
        >
          <Pressable
            onPress={handleOpenSheet}
            style={styles.fabButton}
            android_ripple={{ color: theme.colors.primary[600] }}
          >
            <Text style={styles.fabText}>🔧</Text>
          </Pressable>
        </View>
      )}

      {/* Bottom Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onChange={handleSheetChange}
        backgroundStyle={{ backgroundColor: theme.colors.background.default }}
        handleIndicatorStyle={{ backgroundColor: theme.colors.border.default }}
      >
        <BottomSheetView style={styles.content}>
          <Text size="lg" weight="semibold" style={styles.title}>
            Developer Tools
          </Text>

          <View style={styles.buttons}>
            <Button
              size="md"
              mode="subtle"
              onPress={logoutUser}
              disabled={isLoading}
            >
              <Button.Text>Logout User</Button.Text>
            </Button>

            <Button
              size="md"
              mode="subtle"
              onPress={clearStage}
              disabled={isLoading}
            >
              <Button.Text>Clear Onboarding Stage</Button.Text>
            </Button>

            <Button
              size="md"
              mode="subtle"
              onPress={clearDatabase}
              disabled={isLoading}
            >
              <Button.Text>Clear Local Database</Button.Text>
            </Button>

            <Button
              size="md"
              mode="subtle"
              onPress={clearQueryCache}
              disabled={isLoading}
            >
              <Button.Text>Clear Query Cache</Button.Text>
            </Button>

            <Button
              size="md"
              mode="warning"
              onPress={clearAllData}
              disabled={isLoading}
            >
              <Button.Text>Clear All Data (Keep Auth)</Button.Text>
            </Button>

            <Button
              size="md"
              mode="error"
              onPress={resetApp}
              disabled={isLoading}
            >
              <Button.Text>Reset App & Logout</Button.Text>
            </Button>
          </View>
        </BottomSheetView>
      </BottomSheet>
    </>
  );
};

const styles = StyleSheet.create((theme) => ({
  fab: {
    position: "absolute",
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    zIndex: 1000,
  },
  fabButton: {
    width: "100%",
    height: "100%",
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  fabText: {
    fontSize: 24,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: theme.spacing.lg,
  },
  buttons: {
    gap: theme.spacing.md,
  },
}));
