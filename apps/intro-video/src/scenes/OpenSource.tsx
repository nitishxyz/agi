import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { colors, font } from "../theme";

const STATS = [
  { value: "MIT", label: "License" },
  { value: "TypeScript", label: "Language" },
  { value: "Bun", label: "Runtime" },
];

export const OpenSource: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const ghProgress = spring({ frame: frame - 5, fps, config: { damping: 10, mass: 1, stiffness: 100 } });
  const ghScale = interpolate(ghProgress, [0, 1], [0, 1.08]);
  const ghSettle = spring({ frame, fps, config: { damping: 18, stiffness: 200 }, delay: 22 });
  const finalGhScale = interpolate(ghSettle, [0, 1], [1.08, 1]);
  const computedGhScale = frame < 22 ? ghScale : finalGhScale;

  const titleProgress = spring({ frame: frame - 22, fps, config: { damping: 16, mass: 0.8, stiffness: 90 } });
  const titleY = interpolate(titleProgress, [0, 1], [40, 0]);

  const urlProgress = spring({ frame: frame - 85, fps, config: { damping: 20, stiffness: 100 } });

  const floatY = Math.sin(frame * 0.03) * 3;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: font.sans,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(0,0,0,0.03), transparent 65%)`,
          filter: "blur(60px)",
          opacity: ghProgress,
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 36, transform: `translateY(${floatY}px)` }}>
        <div style={{ position: "relative" }}>
          <div
            style={{
              position: "absolute",
              inset: -24,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(0,0,0,0.05), transparent 70%)",
              filter: "blur(14px)",
              opacity: ghProgress,
            }}
          />
          <div style={{ transform: `scale(${computedGhScale})`, opacity: ghProgress, position: "relative" }}>
            <svg width={110} height={110} viewBox="0 0 24 24" fill={colors.text}>
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </div>
        </div>

        <div style={{ textAlign: "center" as const }}>
          <div
            style={{
              fontSize: 20,
              color: colors.dim,
              letterSpacing: "0.3em",
              textTransform: "uppercase" as const,
              marginBottom: 18,
              opacity: titleProgress,
              fontFamily: font.mono,
              fontWeight: 500,
            }}
          >
            Open Source
          </div>
          <div
            style={{
              fontSize: 80,
              fontWeight: 700,
              color: colors.text,
              opacity: titleProgress,
              transform: `translateY(${titleY}px)`,
              letterSpacing: "-0.03em",
            }}
          >
            Built in the open.
          </div>
        </div>

        <div style={{ display: "flex", gap: 28, marginTop: 12 }}>
          {STATS.map((stat, i) => {
            const delay = 40 + i * 14;
            const progress = spring({ frame: frame - delay, fps, config: { damping: 12, mass: 0.6, stiffness: 180 } });
            const y = interpolate(progress, [0, 1], [40, 0]);
            const scale = interpolate(progress, [0, 1], [0.85, 1]);

            return (
              <div
                key={stat.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  opacity: progress,
                  transform: `translateY(${y}px) scale(${scale})`,
                  background: `linear-gradient(145deg, ${colors.surface}, ${colors.card})`,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 22,
                  padding: "36px 56px",
                  minWidth: 220,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.02)",
                }}
              >
                <span style={{ fontSize: 38, fontWeight: 700, color: colors.text }}>
                  {stat.value}
                </span>
                <span style={{ fontSize: 18, color: colors.dim }}>
                  {stat.label}
                </span>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 24,
            color: colors.dim,
            fontWeight: 500,
            opacity: urlProgress,
            transform: `translateY(${interpolate(urlProgress, [0, 1], [15, 0])}px)`,
            fontFamily: font.mono,
          }}
        >
          <span>github.com/</span>
          <span style={{ color: colors.text, fontWeight: 700 }}>nitishxyz/otto</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
