import Color from "color";
import { UnistylesRuntime } from "react-native-unistyles";

export function getContrastColor(backgroundColor: string) {
  const color = Color(backgroundColor);
  // Using WCAG relative luminance calculation to determine contrast
  return color.isLight() ? "#000000" : "#FFFFFF";
}

export const getIconSize = (size: "sm" | "md" | "lg" | "auto") => {
  const theme = UnistylesRuntime.getTheme();
  switch (size) {
    case "sm":
      return theme.sizing.lg;
    case "md":
      return theme.sizing.xl;
    case "lg":
      return theme.sizing.xxl;
    case "auto":
      return theme.sizing.lg;
  }
};
