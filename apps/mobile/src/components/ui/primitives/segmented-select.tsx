import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useUnistyles } from "react-native-unistyles";
import { Box } from "./box";
import { Text } from "./text";
import { triggerHaptic } from "@/components/utils/haptics";

export interface SegmentedSelectOption<T> {
  value: T;
  label: string;
}

export interface SegmentedSelectProps<T> {
  options: SegmentedSelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  label?: string;
}

export function SegmentedSelect<T extends string | number>({
  options,
  value,
  onChange,
  disabled = false,
  label,
}: SegmentedSelectProps<T>) {
  const { theme } = useUnistyles();

  const handlePress = (optionValue: T) => {
    if (disabled || optionValue === value) return;
    triggerHaptic("selection");
    onChange(optionValue);
  };

  return (
    <Box>
      {label && (
        <Text
          size="xs"
          weight="medium"
          mode="subtle"
          style={{ marginBottom: theme.spacing.xs, marginLeft: theme.spacing.xs }}
        >
          {label}
        </Text>
      )}
      <Box
        style={[
          styles.container,
          {
            borderColor: theme.colors.border.default,
            borderRadius: theme.radius.lg,
          },
        ]}
      >
        {options.map((option, index) => (
          <React.Fragment key={String(option.value)}>
            {index > 0 && (
              <Box
                style={[
                  styles.divider,
                  { backgroundColor: theme.colors.border.default },
                ]}
              />
            )}
            <Pressable
              onPress={() => handlePress(option.value)}
              disabled={disabled}
              style={styles.option}
            >
              <Box
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                style={{ paddingVertical: 14, paddingHorizontal: 16 }}
              >
                <Text
                  size="md"
                  weight="regular"
                >
                  {option.label}
                </Text>
                {value === option.value && (
                  <Feather
                    name="check"
                    size={20}
                    color={theme.colors.brand.base}
                  />
                )}
              </Box>
            </Pressable>
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    overflow: "hidden",
  },
  option: {},
  divider: {
    height: 1,
  },
});
