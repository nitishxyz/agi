import React from "react";
import { Box } from "../primitives";
import { Text } from "../primitives/text";
import { Icon } from "../primitives/icon";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  withSpring,
  withSequence,
  useDerivedValue,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet } from "react-native-unistyles";

export interface AnimatedProgressHeaderProps {
  currentStep: number;
  totalSteps: number;
  title?: string;
  steps?: { id: string; title: string; subtitle?: string }[];
  isCurrentStepComplete?: boolean; // New prop to mark current step as complete
}

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export const AnimatedProgressHeader = ({
  currentStep,
  totalSteps,
  title,
  steps,
  isCurrentStepComplete = false,
}: AnimatedProgressHeaderProps) => {
  // Title animation
  const titleAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withSpring(title ? 1 : 0, { damping: 15, stiffness: 150 }),
      transform: [
        {
          translateX: withSpring(title ? 0 : -20, {
            damping: 15,
            stiffness: 150,
          }),
        },
      ],
    };
  });

  // Subtitle animation (step info)
  const subtitleAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withSpring(0.7, { damping: 15, stiffness: 150 }),
      transform: [
        {
          translateX: withSpring(0, {
            damping: 15,
            stiffness: 150,
          }),
        },
      ],
    };
  });

  return (
    <Box style={styles.container}>
      {/* Just the Progress Dots - No Title */}
      <Box direction="row" alignItems="center" justifyContent="center" gap="xs">
        {Array.from({ length: totalSteps }, (_, index) => {
          const isActive = index === currentStep && !isCurrentStepComplete;
          const isCompleted = index < currentStep || (index === currentStep && isCurrentStepComplete);
          const isUpcoming = index > currentStep;

          return (
            <React.Fragment key={`${index}-${currentStep}-${isCurrentStepComplete}`}>
              {/* Progress Dot */}
              <ProgressDot
                isActive={isActive}
                isCompleted={isCompleted}
                isUpcoming={isUpcoming}
                index={index}
              />

              {/* Connecting Line (don't show after last dot) */}
              {index < totalSteps - 1 && (
                <ConnectingLine
                  isCompleted={index < currentStep || (index === currentStep && isCurrentStepComplete)}
                  isActive={index === currentStep - 1 && !isCurrentStepComplete}
                  progress={0}
                />
              )}
            </React.Fragment>
          );
        })}
      </Box>
    </Box>
  );
};

// Individual Progress Dot Component
const ProgressDot = ({
  isActive,
  isCompleted,
  isUpcoming,
  index,
}: {
  isActive: boolean;
  isCompleted: boolean;
  isUpcoming: boolean;
  index: number;
}) => {
  const dotAnimatedStyle = useAnimatedStyle(() => {
    const scale = isActive ? 1.3 : isCompleted ? 1.1 : 1;
    const opacity = isUpcoming ? 0.3 : 1;
    
    return {
      transform: [
        { 
          scale: withSpring(scale, { 
            damping: 15, 
            stiffness: 200,
          })
        }
      ],
      opacity: withSpring(opacity, { damping: 15, stiffness: 150 }),
    };
  });

  const gradientColors = useDerivedValue(() => {
    if (isCompleted) return ["#10B981", "#059669"]; // Green gradient
    if (isActive) return ["#6366F1", "#4F46E5"]; // Purple gradient  
    return ["#E5E7EB", "#D1D5DB"]; // Gray gradient
  });

  // Pulsing animation for active dot
  const pulseStyle = useAnimatedStyle(() => {
    if (!isActive) return {};
    
    return {
      transform: [
        {
          scale: withSequence(
            withSpring(1),
            withSpring(1.1, { damping: 8 }),
            withSpring(1, { damping: 8 })
          ),
        },
      ],
    };
  });

  return (
    <Animated.View style={[styles.dotContainer, dotAnimatedStyle]}>
      <AnimatedLinearGradient
        colors={gradientColors.value as [string, string]}
        style={[styles.dot, pulseStyle]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {isCompleted ? (
          <Icon icon={Feather} name="check" size={12} color="#FFFFFF" />
        ) : (
          <Text size="xs" weight="bold" style={styles.dotText}>
            {index + 1}
          </Text>
        )}
      </AnimatedLinearGradient>
    </Animated.View>
  );
};

// Connecting Line Component
const ConnectingLine = ({
  isCompleted,
  isActive,
  progress,
}: {
  isCompleted: boolean;
  isActive: boolean;
  progress: number;
}) => {
  const lineAnimatedStyle = useAnimatedStyle(() => {
    const width = isCompleted ? 24 : isActive ? 12 + (progress * 12) : 8;
    const opacity = isCompleted ? 1 : isActive ? 0.7 : 0.3;
    
    return {
      width: withSpring(width, { damping: 15, stiffness: 150 }),
      opacity: withSpring(opacity, { damping: 15, stiffness: 150 }),
    };
  });

  const backgroundColor = isCompleted ? "#10B981" : isActive ? "#6366F1" : "#E5E7EB";

  return (
    <Animated.View
      style={[
        styles.connectingLine,
        { backgroundColor },
        lineAnimatedStyle,
      ]}
    />
  );
};

const styles = StyleSheet.create((theme) => ({
  container: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    color: theme.colors.text.subtle,
    marginTop: theme.spacing.xs,
  },
  dotContainer: {
    position: "relative",
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dotText: {
    color: "#FFFFFF",
    fontSize: 10,
  },
  connectingLine: {
    height: 3,
    borderRadius: 1.5,
  },
}));