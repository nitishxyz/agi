import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Box, Button, Icon } from "@/primitives";
import type { IconProps } from "@expo/vector-icons/build/createIconSet";
import { StyleProp, ViewStyle } from "react-native";

type Icon = {
  group: React.ComponentType<IconProps<any>>;
  name: string;
};

type ActionButtonProps = {
  title?: string;
  icon: Icon;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export const ActionButton = ({
  title,
  icon,
  onPress,
  style,
}: ActionButtonProps) => {
  const { theme } = useUnistyles();
  const isIconOnly = !title;

  return (
    <Button
      style={[
        isIconOnly ? styles.iconOnlyBtn : styles.actionBtn,
        style,
      ]}
      contentStyle={styles.btnContentStyle}
      rounded="full"
      key={title || icon.name}
      size="auto"
      onPress={onPress}
      haptics={"heavy"}
    >
      <Box
        style={styles.iconContainer}
        center
        rounded="full"
      >
        <Icon
          name={icon.name}
          icon={icon.group}
          color={theme.colors.primary.base}
          size={16}
        />
      </Box>

      {title && (
        <Button.Text weight="bold" style={styles.buttonText}>
          {title}
        </Button.Text>
      )}
    </Button>
  );
};

const styles = StyleSheet.create((theme) => ({
  actionBtn: {
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: theme.spacing.sm,
  },
  iconOnlyBtn: {
    padding: 4,
  },
  btnContentStyle: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  iconContainer: {
    backgroundColor: theme.colors.background.base,
    width: 28,
    height: 28,
  },
  buttonText: {
    fontSize: 13,
  },
}));
