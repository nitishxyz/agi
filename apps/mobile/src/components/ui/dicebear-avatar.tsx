import type { ImageProps } from "expo-image";
import Avatar from "./avatar";

interface DicebearAvatarProps extends Omit<ImageProps, "source"> {
  seed?: string;
  size?: number;
  rounded?: "none" | "sm" | "md" | "lg" | "xl" | "full";
  border?: "none" | "thin" | "thick";
  variant?: string;
  fallback?: string;
}

export default function DicebearAvatar({
  seed,
  variant = "bottts",
  size = 42,
  rounded = "full",
  border = "thin",
  fallback,
  ...props
}: DicebearAvatarProps) {
  const getDicebearUrl = (seed?: string) => {
    if (!seed && !fallback) return undefined;
    return `https://api.dicebear.com/7.x/${variant}/png?seed=${
      seed || fallback
    }`;
  };

  return (
    <Avatar
      size={size}
      rounded={rounded}
      border={border}
      cachePolicy={"memory-disk"}
      source={{ uri: getDicebearUrl(seed) }}
      {...props}
    />
  );
}
