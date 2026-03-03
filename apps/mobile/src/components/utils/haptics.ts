import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/**
 * Utility functions for haptic feedback using expo-haptics
 */

export type HapticFeedbackType =
  | "light"
  | "medium"
  | "heavy"
  | "selection"
  | "success"
  | "warning"
  | "error"
  | "none";

export interface HapticConfig {
  in?: HapticFeedbackType;
  out?: HapticFeedbackType;
}

/**
 * Triggers a light impact haptic feedback
 */
export const lightImpact = () => {
  if (Platform.OS === "android") {
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Keyboard_Tap);
  } else {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
};

/**
 * Triggers a medium impact haptic feedback
 */
export const mediumImpact = () => {
  if (Platform.OS === "android") {
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Context_Click);
  } else {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
};

/**
 * Triggers a heavy impact haptic feedback
 */
export const heavyImpact = () => {
  if (Platform.OS === "android") {
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press);
  } else {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }
};

/**
 * Triggers a success notification haptic feedback
 */
export const successNotification = () => {
  if (Platform.OS === "android") {
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm);
  } else {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
};

/**
 * Triggers a warning notification haptic feedback
 */
export const warningNotification = () => {
  if (Platform.OS === "android") {
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject);
  } else {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }
};

/**
 * Triggers an error notification haptic feedback
 */
export const errorNotification = () => {
  if (Platform.OS === "android") {
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject);
  } else {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
};

/**
 * Triggers a selection feedback
 */
export const selection = () => {
  if (Platform.OS === "android") {
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Clock_Tick);
  } else {
    Haptics.selectionAsync();
  }
};

/**
 * Triggers the specified haptic feedback type
 */
export const triggerHaptic = (type: HapticFeedbackType, disabled?: boolean) => {
  if (disabled) return;

  switch (type) {
    case "light":
      lightImpact();
      break;
    case "medium":
      mediumImpact();
      break;
    case "heavy":
      heavyImpact();
      break;
    case "selection":
      selection();
      break;
    case "success":
      successNotification();
      break;
    case "warning":
      warningNotification();
      break;
    case "error":
      errorNotification();
      break;
    case "none":
    default:
      break;
  }
};

/**
 * Android-specific haptic effects for more precise control
 */
export const androidHaptics = {
  clockTick: () => Platform.OS === "android" && Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Clock_Tick),
  confirm: () => Platform.OS === "android" && Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm),
  contextClick: () => Platform.OS === "android" && Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Context_Click),
  dragStart: () => Platform.OS === "android" && Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Drag_Start),
  gestureEnd: () => Platform.OS === "android" && Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Gesture_End),
  gestureStart: () => Platform.OS === "android" && Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Gesture_Start),
  keyboardPress: () => Platform.OS === "android" && Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Keyboard_Press),
  keyboardRelease: () => Platform.OS === "android" && Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Keyboard_Release),
  keyboardTap: () => Platform.OS === "android" && Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Keyboard_Tap),
  longPress: () => Platform.OS === "android" && Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press),
  reject: () => Platform.OS === "android" && Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject),
  segmentFrequentTick: () => Platform.OS === "android" && Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Frequent_Tick),
  segmentTick: () => Platform.OS === "android" && Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick),
  textHandleMove: () => Platform.OS === "android" && Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Text_Handle_Move),
  toggleOff: () => Platform.OS === "android" && Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Toggle_Off),
  toggleOn: () => Platform.OS === "android" && Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Toggle_On),
  virtualKey: () => Platform.OS === "android" && Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key),
  virtualKeyRelease: () => Platform.OS === "android" && Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key_Release),
};

/**
 * Haptics utility object containing all haptic feedback functions
 */
const haptics = {
  lightImpact,
  mediumImpact,
  heavyImpact,
  successNotification,
  warningNotification,
  errorNotification,
  selection,
  triggerHaptic,
  androidHaptics,
};

export default haptics;
