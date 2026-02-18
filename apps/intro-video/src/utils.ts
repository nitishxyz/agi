import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export function useSpring(
  delay: number,
  config?: { damping?: number; mass?: number; stiffness?: number },
) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    frame: frame - delay,
    fps,
    config: {
      damping: config?.damping ?? 28,
      mass: config?.mass ?? 0.8,
      stiffness: config?.stiffness ?? 180,
    },
  });
}

export function useFadeIn(delay: number, duration = 15) {
  const frame = useCurrentFrame();
  return interpolate(frame, [delay, delay + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export function useSlideUp(delay: number, distance = 40) {
  const progress = useSpring(delay);
  return {
    opacity: progress,
    transform: `translateY(${interpolate(progress, [0, 1], [distance, 0])}px)`,
  };
}

export function useSlideIn(
  delay: number,
  direction: "left" | "right" | "up" | "down" = "up",
  distance = 50,
) {
  const progress = useSpring(delay);
  const offset = interpolate(progress, [0, 1], [distance, 0]);

  const transforms: Record<string, string> = {
    left: `translateX(${-offset}px)`,
    right: `translateX(${offset}px)`,
    up: `translateY(${offset}px)`,
    down: `translateY(${-offset}px)`,
  };

  return {
    opacity: progress,
    transform: transforms[direction],
  };
}

export function useTypewriter(text: string, startFrame: number, speed = 2) {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const chars = Math.min(Math.floor(elapsed / speed), text.length);
  return text.slice(0, chars);
}

export function useScale(delay: number, from = 0.8) {
  const progress = useSpring(delay, { damping: 20, stiffness: 120 });
  return {
    opacity: progress,
    transform: `scale(${interpolate(progress, [0, 1], [from, 1])})`,
  };
}
