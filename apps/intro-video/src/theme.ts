import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadPlexMono } from "@remotion/google-fonts/IBMPlexMono";

const { fontFamily: interFamily } = loadInter("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const { fontFamily: monoFamily } = loadPlexMono("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const colors = {
  bg: "#E8E8EB",
  surface: "#F4F4F5",
  card: "#E4E4E7",
  border: "#D4D4D8",
  text: "#09090B",
  muted: "#52525B",
  dim: "#A1A1AA",
  accent: "#3B82F6",
  accentLight: "#2563EB",
  white: "#FAFAFA",
  emerald: "#059669",
  violet: "#7C3AED",
  amber: "#D97706",
  purple: "#9333EA",
};

export const font = {
  sans: interFamily,
  mono: monoFamily,
};
