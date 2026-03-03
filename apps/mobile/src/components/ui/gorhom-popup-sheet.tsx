import React, {
  useCallback,
  useMemo,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Pressable } from "react-native";
import { FullWindowOverlay } from "react-native-screens";
import {
  StyleSheet,
  StyleSheet as UnistyleStyleSheet,
} from "react-native-unistyles";
import { useTheme } from "@/providers/theme-context";
import { BlurView } from "expo-blur";
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import {
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
  useBottomSheetSpringConfigs,
} from "@gorhom/bottom-sheet";
import { Box } from "./primitives/box";
import { Button } from "./primitives/button";
import { Icon } from "./primitives/icon";
import { Text } from "./primitives";
import { Feather } from "@expo/vector-icons";

type GorhomPopupSheetProps = {
  children?: React.ReactNode;
  title?: string;
  disableCloseButton?: boolean;
  onDismiss?: () => void;
};

type GorhomPopupSheetItemProps = {
  icon?: any;
  iconName?: string;
  title: string;
  description?: string;
  rightContent?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
};

type GorhomPopupSheetSectionProps = {
  title?: string;
  children: React.ReactNode;
};

export type GorhomPopupSheetRef = {
  present: () => void;
  dismiss: () => void;
};

// Custom Blur Backdrop Component
const CustomBackdrop = ({
  animatedIndex,
  style,
  onPress,
}: BottomSheetBackdropProps & { onPress?: () => void }) => {
  const { currentTheme } = useTheme();
  const colorScheme = currentTheme;

  // Animated style for backdrop opacity
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedIndex.value,
      [-1, 0],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  const containerStyle = useMemo(
    () => [style, containerAnimatedStyle],
    [style, containerAnimatedStyle]
  );

  return (
    <Animated.View style={containerStyle}>
      <Pressable onPress={onPress} style={StyleSheet.absoluteFillObject}>
        <BlurView
          intensity={50}
          tint={colorScheme === "dark" ? "dark" : "light"}
          style={{ flex: 1 }}
        />
      </Pressable>
    </Animated.View>
  );
};

// Close Button Component
const CloseButton = ({
  onPress,
  disabled,
  hidden,
}: {
  onPress?: () => void;
  disabled?: boolean;
  hidden?: boolean;
}) => {
  return (
    <Box
      style={[
        styles.closeButtonContainer,
        {
          opacity: hidden ? 0 : 1,
        },
      ]}
    >
      <Button
        style={styles.closeButton}
        rounded="full"
        size="auto"
        variant="ghost"
        mode="subtle"
        onPress={onPress}
        disabled={disabled}
      >
        <Button.Icon>
          {(props) => <Icon color="muted" icon={Feather} name="x" size={20} />}
        </Button.Icon>
      </Button>
    </Box>
  );
};

// Sheet Item Component
const GorhomPopupSheetItem = ({
  icon,
  iconName,
  title,
  description,
  rightContent,
  onPress,
  disabled,
}: GorhomPopupSheetItemProps) => {
  return (
    <Button
      variant="ghost"
      size="auto"
      onPress={onPress}
      disabled={disabled}
      style={styles.itemButton}
    >
      <Box
        direction="row"
        alignItems="center"
        rounded="xl"
        style={styles.itemContent}
      >
        {/* Left Icon Section */}
        {icon && iconName && (
          <Box
            rounded="lg"
            style={styles.iconContainer}
            center
            background="base"
          >
            <Icon icon={icon} name={iconName} size={22} />
          </Box>
        )}

        {/* Center Content Section */}
        <Box flex style={styles.textContent}>
          <Button.Text size="lg" weight="semibold">
            {title}
          </Button.Text>
          {description && (
            <Text size="sm" style={styles.description}>
              {description}
            </Text>
          )}
        </Box>

        {/* Right Content Section */}
        {rightContent && (
          <Box alignItems="flex-end" style={styles.rightContent}>
            {rightContent}
          </Box>
        )}
      </Box>
    </Button>
  );
};

// Sheet Section Component
const GorhomPopupSheetSection = ({
  title,
  children,
}: GorhomPopupSheetSectionProps) => {
  return (
    <Box gap="sm">
      {title && (
        <Box pl="md" pt="sm">
          <Text size="xs" style={styles.sectionTitle}>
            {title}
          </Text>
        </Box>
      )}
      <Box gap="sm">{children}</Box>
    </Box>
  );
};

// Main Sheet Component
const GorhomPopupSheet = forwardRef<GorhomPopupSheetRef, GorhomPopupSheetProps>(
  ({ children, title, disableCloseButton, onDismiss }, ref) => {
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);

    // Spring animation configs - More bouncy like your original
    const animationConfigs = useBottomSheetSpringConfigs({
      damping: 30,
      overshootClamping: false,
      stiffness: 400,
      mass: 1,
    });

    // Present modal
    const present = useCallback(() => {
      bottomSheetModalRef.current?.present();
    }, []);

    // Dismiss modal
    const dismiss = useCallback(() => {
      bottomSheetModalRef.current?.dismiss();
    }, []);

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        present,
        dismiss,
      }),
      [present, dismiss]
    );

    // Handle sheet changes
    const handleSheetChanges = useCallback((index: number) => {
      console.log("handleSheetChanges", index);
    }, []);

    const renderContainerComponent = useCallback(
      ({ children }: { children: React.ReactNode }) => (
        <FullWindowOverlay style={{ flex: 1 }}>
          {children}
        </FullWindowOverlay>
      ),
      []
    );

    return (
      <BottomSheetModal
        ref={bottomSheetModalRef}
        onChange={handleSheetChanges}
        enableDynamicSizing={true}
        backdropComponent={(props) => (
          <CustomBackdrop {...props} onPress={dismiss} />
        )}
        backgroundStyle={styles.backgroundStyle}
        style={styles.sheetStyle}
        handleStyle={styles.handleStyle}
        handleIndicatorStyle={styles.handleIndicatorStyle}
        enablePanDownToClose={true}
        onDismiss={onDismiss}
        animationConfigs={animationConfigs}
        animateOnMount={true}
        containerComponent={renderContainerComponent}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
      >
        <BottomSheetView
          style={[styles.contentContainer, { backgroundColor: "transparent" }]}
        >
          <Box m="md" p="lg" shadow="lg" background="base" style={styles.container} border="thin">
            {/* Header */}
            <Box direction="row" alignItems="center" style={styles.header}>
              <Box center flex>
                {title && (
                  <Text size="xl" mode="subtle" weight="bold">
                    {title}
                  </Text>
                )}
              </Box>
            </Box>
            <CloseButton
              onPress={dismiss}
              disabled={disableCloseButton}
              hidden={disableCloseButton}
            />

            {/* Content */}
            <Box gap="sm" mt="md">
              {children}
            </Box>
          </Box>
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

GorhomPopupSheet.displayName = "GorhomPopupSheet";

// Compound Component Pattern
const GorhomPopupSheetWithComponents = Object.assign(GorhomPopupSheet, {
  Item: GorhomPopupSheetItem,
  Section: GorhomPopupSheetSection,
});

export default GorhomPopupSheetWithComponents;

const styles = UnistyleStyleSheet.create((theme, rt) => ({
  // Bottom Sheet Modal Styles - Make completely transparent
  sheetStyle: {
    backgroundColor: "rgba(0, 0, 0, 0)",
    shadowColor: "transparent",
    shadowOpacity: 0,
    elevation: 0,
  },
  backgroundStyle: {
    backgroundColor: "rgba(0, 0, 0, 0)",
  },
  handleStyle: {
    backgroundColor: "rgba(0, 0, 0, 0)",
    height: 0, // Hide handle completely
    opacity: 0,
  },
  handleIndicatorStyle: {
    backgroundColor: "rgba(0, 0, 0, 0)",
    width: 0,
    height: 0, // Hide handle indicator completely
    opacity: 0,
  },

  // Content Container
  contentContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0)",
    paddingTop: theme.spacing.lg,
    paddingBottom: rt.insets.bottom,
  },

  // Popup Container (our actual popup)
  container: {
    alignSelf: "stretch",
    borderRadius: theme.radius.tera,
    paddingTop: theme.spacing.lg,
    marginBottom: 0,
  },

  // Header
  header: {
    minHeight: 35,
  },
  closeButtonContainer: {
    position: "absolute",
    top: theme.spacing.md,
    right: theme.spacing.md,
    zIndex: 1000,
  },
  closeButton: {
    height: 35,
    width: 35,
  },

  // Item Styles
  itemButton: {
    borderRadius: theme.radius.xxl,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  itemContent: {
    minHeight: 48,
    padding: theme.spacing.sm + 4,
    backgroundColor: theme.colors.background.lightest,
  },
  iconContainer: {
    width: 45,
    height: 45,
    marginRight: 12,
  },
  textContent: {},
  description: {
    opacity: 0.7,
  },
  rightContent: {
    minWidth: 60,
  },
  sectionTitle: {
    textTransform: "uppercase",
    opacity: 0.6,
    fontSize: 12,
    fontWeight: "600",
  },
}));
