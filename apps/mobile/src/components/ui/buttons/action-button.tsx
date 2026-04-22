import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Button } from "@/primitives";
import type { IconProps } from "@expo/vector-icons/build/createIconSet";

type Icon = {
  group: React.ComponentType<IconProps<any>>;
  name: string;
};

type ActionButtonProps = {
  title: string;
  icon: Icon;
  onPress?: () => void;
};

export const ActionButton = ({ title, icon, onPress }: ActionButtonProps) => {
  const { theme } = useUnistyles();
  return (
    <Button
      style={styles.actionBtn}
      rounded="full"
      key={title}
      mt="sm"
      size="sm"
      onPress={onPress}
      haptics={"heavy"}
    >
      <Button.Icon style={styles.icon}>
        {(props) => {
          return (
            <icon.group
              {...props}
              size={15}
              name={icon.name}
              color={theme.colors.text.default}
            />
          );
        }}
      </Button.Icon>
      <Button.Text weight="bold" style={{ fontSize: 14 }}>
        {title}
      </Button.Text>
    </Button>
  );
};

const styles = StyleSheet.create((theme) => ({
  actionBtn: {
    alignItems: "center",
    justifyContent: "center",
    // paddingHorizontal: theme.spacing.sm,
    paddingLeft: 4,
    paddingRight: theme.spacing.sm + 2,
  },
  icon: {
    backgroundColor: theme.colors.background.subtle,
    borderRadius: 100,
    width: 22,
    height: 22,
  },
}));
