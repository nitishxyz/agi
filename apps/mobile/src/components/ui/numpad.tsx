import { StyleSheet } from "react-native-unistyles";
import { Box, Text, Icon } from "@/primitives";
import { Feather } from "@expo/vector-icons";
import AnimatedPressable from "./primitives/animated-pressable";
import haptics from "@/components/utils/haptics";

type NumpadProps = {
  onPress: (value: string) => void;
  onClear?: () => void;
  onBackspace?: () => void;
};

const Numpad = ({ onPress, onClear, onBackspace }: NumpadProps) => {
  const numbers = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    [".", "0", "delete"],
  ];

  const handlePress = (value: string) => {
    // Trigger haptic feedback
    if (value === "delete") {
      haptics.lightImpact();
      onBackspace?.();
    } else {
      haptics.selection();
      onPress(value);
    }
  };

  return (
    <Box style={styles.container}>
      <Box style={styles.grid}>
        {numbers.map((row, rowIndex) => (
          <Box key={rowIndex} direction="row" style={styles.row}>
            {row.map((num) => (
              <AnimatedPressable
                key={num}
                onPress={() => handlePress(num)}
                style={styles.button}
              >
                {num === "delete" ? (
                  <Icon icon={Feather} name="delete" size={30} />
                ) : (
                  <Text size="mega" weight="bold">
                    {num}
                  </Text>
                )}
              </AnimatedPressable>
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default Numpad;

const styles = StyleSheet.create((theme) => ({
  container: {},
  grid: {},
  row: {
    height: 70,
  },
  buttonWrapper: {
    flex: 1,
  },
  button: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    fontSize: 32,
  },
}));
