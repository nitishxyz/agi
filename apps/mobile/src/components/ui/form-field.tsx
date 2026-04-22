import React from "react";
import { Controller, Control, FieldValues, Path, FieldError } from "react-hook-form";
import { Box, Text, Input } from "@/primitives";

type FormFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  label: string;
  placeholder?: string;
  error?: FieldError;
  required?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad" | "decimal-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  leftAccessory?: React.ReactNode;
  secureTextEntry?: boolean;
  maxLength?: number;
  helperText?: string;
  /** For multiline inputs, minimum height in pixels */
  minHeight?: number;
  /** Disable the input field */
  disabled?: boolean;
};

export function FormField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  error,
  required,
  multiline,
  numberOfLines = 3,
  keyboardType = "default",
  autoCapitalize = "sentences",
  autoCorrect = true,
  leftAccessory,
  secureTextEntry,
  maxLength,
  helperText,
  minHeight = 100,
  disabled,
}: FormFieldProps<T>) {
  return (
    <Box mb="md">
      <Box direction="row" alignItems="center" mb="sm">
        <Text size="sm" mode="subtle" weight="medium">
          {label}
        </Text>
        {required && (
          <Text size="sm" mode="error" style={{ marginLeft: 4 }}>
            *
          </Text>
        )}
      </Box>
      
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            value={value || ""}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder={placeholder}
            variant="outline"
            size="lg"
            mode={disabled ? "disabled" : error ? "error" : undefined}
            multiline={multiline}
            numberOfLines={multiline ? numberOfLines : 1}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            autoCorrect={autoCorrect}
            leftAccessory={leftAccessory}
            secureTextEntry={secureTextEntry}
            maxLength={maxLength}
            minHeight={multiline ? minHeight : undefined}
          />
        )}
      />
      
      {error?.message && (
        <Box direction="row" alignItems="center" mt="xs" gap="xs">
          <Text size="sm" mode="error">
            {error.message}
          </Text>
        </Box>
      )}
      
      {!error && helperText && (
        <Text size="xs" mode="subtle" style={{ marginTop: 4 }}>
          {helperText}
        </Text>
      )}
    </Box>
  );
}
