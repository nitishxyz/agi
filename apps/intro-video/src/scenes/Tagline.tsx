import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { colors, font } from "../theme";

export const Tagline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = ["Open-source.", "Local-first.", "Provider-agnostic."];
  const directions = [-1, 1, -1];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: font.mono,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 400,
          background: `radial-gradient(ellipse at center, ${colors.accent}0A, transparent 70%)`,
          filter: "blur(60px)",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}>
        {words.map((word, i) => {
          const delay = 5 + i * 20;
          const progress = spring({
            frame: frame - delay,
            fps,
            config: { damping: 14, mass: 0.8, stiffness: 160 },
          });
          const x = interpolate(progress, [0, 1], [120 * directions[i], 0]);
          const scale = interpolate(progress, [0, 1], [0.7, 1]);
          const rotate = interpolate(progress, [0, 1], [8 * directions[i], 0]);

          return (
            <div
              key={word}
              style={{
                fontSize: 64,
                fontWeight: 700,
                color: colors.text,
                opacity: progress,
                transform: `translateX(${x}px) scale(${scale}) rotate(${rotate}deg)`,
                letterSpacing: "-0.02em",
              }}
            >
              {word}
            </div>
          );
        })}

        {(() => {
          const descDelay = 70;
          const descProgress = spring({
            frame: frame - descDelay,
            fps,
            config: { damping: 22, stiffness: 100 },
          });
          const descScale = interpolate(descProgress, [0, 1], [0.9, 1]);
          const descY = interpolate(descProgress, [0, 1], [40, 0]);

          return (
            <div
              style={{
                marginTop: 24,
                fontSize: 24,
                color: colors.muted,
                opacity: descProgress,
                transform: `translateY(${descY}px) scale(${descScale})`,
                maxWidth: 700,
                textAlign: "center" as const,
                lineHeight: 1.6,
              }}
            >
              Connects to any AI provider, gives it tools to read, write,
              and execute — then streams the result back to you.
            </div>
          );
        })()}
      </div>
    </AbsoluteFill>
  );
};
