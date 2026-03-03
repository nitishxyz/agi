import { StyleSheet } from "react-native-unistyles";
import { Box } from "./primitives/box";
import { Icon } from "./primitives/icon";
import { Text } from "./primitives";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from "react-native-reanimated";
import { Pressable } from "react-native";
import type { ComponentProps } from "react";
import type { MaterialCommunityIcons } from "@expo/vector-icons";
import PopupModal from "./popup-modal";
import { selection } from "../utils/haptics";

type SelectionSheetProps = {
  children?: React.ReactNode;
  title?: string;
  onClose?: () => void;
};

interface SelectionItemWithIconProps {
  icon: typeof MaterialCommunityIcons;
  iconName: ComponentProps<typeof MaterialCommunityIcons>["name"];
  title: string;
  description: string;
  onPress?: () => void;
}

const SelectionItemWithIcon = ({
  icon,
  iconName,
  title,
  description,
  onPress,
}: SelectionItemWithIconProps) => {
  return (
    <SelectionSheetItem onPress={onPress}>
      <Box direction="row" gap="md" alignItems="center">
        <Box rounded="lg" style={styles.iconContainer} center background="base">
          <Icon icon={icon} name={iconName} size={24} />
        </Box>
        <Box flex>
          <Text size="lg" weight="semibold">{title}</Text>
          <Text size="sm" mode="subtle" style={styles.description}>
            {description}
          </Text>
        </Box>
      </Box>
    </SelectionSheetItem>
  );
};

const SelectionSheet: React.FC<SelectionSheetProps> & {
  Item: typeof SelectionSheetItem;
  ItemWithIcon: typeof SelectionItemWithIcon;
} = ({ children, title, onClose }) => {
  return (
    <>
      <PopupModal title={title} onClose={onClose}>
        {children}
      </PopupModal>
    </>
  );
};

const SelectionSheetItem = ({
  children,
  onPress,
}: {
  children?: React.ReactNode;
  onPress?: () => void;
}) => {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    selection();
    scale.value = withSpring(0.97, {
      damping: 20,
      stiffness: 300,
    });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      damping: 20,
      stiffness: 300,
    });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
    >
      <Animated.View style={animatedStyle}>
        <Box direction="row" p="md" rounded="xl" style={styles.itemContent}>
          {children}
        </Box>
      </Animated.View>
    </Pressable>
  );
};

SelectionSheet.Item = SelectionSheetItem;
SelectionSheet.ItemWithIcon = SelectionItemWithIcon;

export default SelectionSheet;

const styles = StyleSheet.create((theme) => ({
  iconContainer: {
    width: 45,
    height: 45,
  },
  itemContent: {
    backgroundColor: theme.colors.background.lightest,
  },
  description: {
    opacity: 0.7,
  },
}));
