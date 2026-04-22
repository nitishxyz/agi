import React from "react";
import { Box } from "../primitives";
import { Text } from "../primitives/text";
import { Icon } from "../primitives/icon";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

export interface SimpleProgressHeaderProps {
  currentStep: number;
  totalSteps: number;
  isCurrentStepComplete?: boolean; // New prop to mark current step as complete
}

export const SimpleProgressHeader = ({
  currentStep,
  totalSteps,
  isCurrentStepComplete = false,
}: SimpleProgressHeaderProps) => {
  return (
    <Box direction="row" alignItems="center" justifyContent="center" style={styles.container}>
      {Array.from({ length: totalSteps }, (_, index) => {
        const isActive = index === currentStep && !isCurrentStepComplete;
        const isCompleted = index < currentStep || (index === currentStep && isCurrentStepComplete);

        return (
          <React.Fragment key={index}>
            {/* Progress Dot */}
            <ProgressDot
              isActive={isActive}
              isCompleted={isCompleted}
              currentStep={currentStep}
              index={index}
            />

            {/* Connecting Line - positioned to connect dots */}
            {index < totalSteps - 1 && (
              <Box style={styles.lineContainer}>
                <ConnectingLine
                  isCompleted={index < currentStep || (index === currentStep && isCurrentStepComplete)}
                  currentStep={currentStep}
                />
              </Box>
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
};

// Simple Progress Dot
const ProgressDot = ({
  isActive,
  isCompleted,
  currentStep,
  index,
}: {
  isActive: boolean;
  isCompleted: boolean;
  currentStep: number;
  index: number;
}) => {
  const dotStyle = useAnimatedStyle(() => {
    let scale = 1;
    if (isActive) scale = 1.2;
    else scale = 0.85; // Both completed and upcoming are smaller and same size
    
    return {
      transform: [{ scale: withSpring(scale, { damping: 15, stiffness: 200 }) }],
    };
  }, [isActive, isCompleted, currentStep]);

  const getBackgroundColor = () => {
    if (isCompleted) return "#10B981"; // Green
    if (isActive) return "#6366F1"; // Purple
    return "#9CA3AF"; // Less dim gray
  };

  return (
    <Animated.View style={[styles.dot, { backgroundColor: getBackgroundColor() }, dotStyle]}>
      {isCompleted ? (
        <Icon icon={Feather} name="check" size={10} color="#FFFFFF" />
      ) : (
        <Text size="xs" weight="bold" style={{ color: "#FFFFFF", fontSize: 10 }}>
          {index + 1}
        </Text>
      )}
    </Animated.View>
  );
};

// Simple Connecting Line
const ConnectingLine = ({
  isCompleted,
  currentStep,
}: {
  isCompleted: boolean;
  currentStep: number;
}) => {
  const lineStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: withSpring(
        isCompleted ? "#10B981" : "#E5E7EB",
        { damping: 15, stiffness: 200 }
      ),
    };
  }, [isCompleted, currentStep]);

  return <Animated.View style={[styles.line, lineStyle]} />;
};

const styles = StyleSheet.create((theme) => ({
  container: {
    paddingVertical: theme.spacing.sm,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2, // Always on top of lines
    backgroundColor: 'transparent', // Will be overridden by animated style
  },
  lineContainer: {
    marginHorizontal: -4, // Overlap slightly with dots to connect properly
    zIndex: 1,
  },
  line: {
    width: 24, // Longer to connect properly
    height: 2,
    borderRadius: 1,
  },
}));