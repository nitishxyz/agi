import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Box, Button, Icon } from "@/primitives";
import type { IconProps } from "@expo/vector-icons/build/createIconSet";
import { StyleProp, ViewStyle } from "react-native";

type IconConfig = {
  group: React.ComponentType<IconProps<any>>;
  name: string;
};

type BusinessActionButtonProps = {
  title: string;
  icon: IconConfig;
  onPress?: () => void;
  variant?: "primary" | "default";
  style?: StyleProp<ViewStyle>;
};

export const BusinessActionButton = ({
  title,
  icon,
  onPress,
  variant = "default",
  style,
}: BusinessActionButtonProps) => {
  const { theme } = useUnistyles();
  const isPrimary = variant === "primary";

  return (
    <Button
      style={[
        styles.actionBtn,
        {
          backgroundColor: isPrimary
            ? theme.colors.primary.base
            : theme.colors.background.dim,
        },
        style,
      ]}
      contentStyle={styles.btnContentStyle}
      rounded="full"
      size="auto"
      onPress={onPress}
      haptics="medium"
    >
      <Box
        style={[
          styles.iconContainer,
          {
            backgroundColor: isPrimary
              ? theme.colors.background.base
              : theme.colors.background.emphasis,
          },
        ]}
        center
        rounded="full"
      >
        <Icon
          name={icon.name}
          icon={icon.group}
          color={isPrimary ? theme.colors.primary.base : theme.colors.text.default}
          size={16}
        />
      </Box>

      <Button.Text
        weight="bold"
        style={{
          fontSize: 13,
          color: isPrimary ? theme.colors.primary.contrast : theme.colors.text.default,
        }}
      >
        {title}
      </Button.Text>
    </Button>
  );
};

const styles = StyleSheet.create((theme) => ({
  actionBtn: {
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: theme.spacing.sm,
  },
  btnContentStyle: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  iconContainer: {
    width: 28,
    height: 28,
  },
}));
