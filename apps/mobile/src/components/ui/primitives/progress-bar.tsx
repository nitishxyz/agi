import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  Easing,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

export interface ProgressBarProps {
  progress: number; // 0-100
  size?: "sm" | "md" | "lg";
  mode?: "subtle" | "brand" | "secondary" | "warning" | "error" | "success";
  variant?: "default" | "minimal";
  animated?: boolean;
  duration?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  size = "md",
  mode = "brand",
  variant = "default",
  animated = true,
  duration = 300,
}) => {
  const progressWidth = useSharedValue(0);

  // Update progress with animation
  useEffect(() => {
    if (animated) {
      progressWidth.value = withTiming(progress, {
        duration,
        easing: Easing.out(Easing.quad),
      });
    } else {
      progressWidth.value = progress;
    }
  }, [progress, animated, duration, progressWidth]);

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  // Use variants to style the container
  styles.useVariants({ size, mode, variant: variant === "default" ? undefined : variant });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.progressBar, progressAnimatedStyle]} />
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: theme.colors.background.lighter,
    borderRadius: theme.radius.sm,
    height: 6,
    variants: {
      size: {
        sm: {
          height: 4,
          borderRadius: theme.radius.sm,
        },
        md: {
          height: 6,
          borderRadius: theme.radius.sm,
        },
        lg: {
          height: 8,
          borderRadius: theme.radius.md,
        },
      },
      variant: {
        default: {
          backgroundColor: theme.colors.background.lighter,
        },
        minimal: {
          backgroundColor: theme.colors.background.subtle,
        },
      },
    },
  },
  progressBar: {
    height: "100%",
    borderRadius: "inherit",
    backgroundColor: theme.colors.brand[500],
    variants: {
      mode: {
        subtle: {
          backgroundColor: theme.colors.text.subtle,
        },
        brand: {
          backgroundColor: theme.colors.brand[500],
        },
        secondary: {
          backgroundColor: theme.colors.secondary[500],
        },
        warning: {
          backgroundColor: theme.colors.warning[500],
        },
        error: {
          backgroundColor: theme.colors.error[500],
        },
        success: {
          backgroundColor: theme.colors.success[500],
        },
      },
      size: {
        sm: {
          borderRadius: theme.radius.sm,
        },
        md: {
          borderRadius: theme.radius.sm,
        },
        lg: {
          borderRadius: theme.radius.md,
        },
      },
    },
  },
}));