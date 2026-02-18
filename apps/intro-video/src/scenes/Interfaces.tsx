import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { colors, font } from "../theme";

const INTERFACES = [
  {
    tag: "CLI",
    headline: "Terminal-native",
    cmd: "otto \"fix the auth bug\"",
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
  },
  {
    tag: "Server + Web UI",
    headline: "HTTP API & browser",
    cmd: "otto serve --port 3000",
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" />
      </svg>
    ),
  },
  {
    tag: "Desktop",
    headline: "Native Tauri app",
    cmd: "otto",
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" />
      </svg>
    ),
  },
  {
    tag: "SDK",
    headline: "Embed anywhere",
    cmd: "import { createEmbeddedApp }",
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m18 16 4-4-4-4" /><path d="m6 8-4 4 4 4" /><path d="m14.5 4-5 16" />
      </svg>
    ),
  },
];

export const Interfaces: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerProgress = spring({
    frame,
    fps,
    config: { damping: 18, mass: 0.8, stiffness: 120 },
    delay: 5,
  });
  const headerX = interpolate(headerProgress, [0, 1], [-120, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: font.mono,
      }}
    >
      <div style={{ width: 1100 }}>
        <div
          style={{
            marginBottom: 50,
            opacity: headerProgress,
            transform: `translateX(${headerX}px)`,
          }}
        >
          <div style={{ fontSize: 16, color: colors.dim, letterSpacing: "0.2em", textTransform: "uppercase" as const, marginBottom: 12 }}>
            Interfaces
          </div>
          <div style={{ fontSize: 48, fontWeight: 700, color: colors.text, lineHeight: 1.2 }}>
            One tool. Every surface.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, background: colors.border, borderRadius: 20, overflow: "hidden" }}>
          {INTERFACES.map((item, i) => {
            const delay = 25 + i * 15;
            const progress = spring({
              frame: frame - delay,
              fps,
              config: { damping: 14, mass: 0.7, stiffness: 180 },
            });
            const directions = [
              { x: -1, y: -1 },
              { x: 1, y: -1 },
              { x: -1, y: 1 },
              { x: 1, y: 1 },
            ];
            const slideX = interpolate(progress, [0, 1], [60 * directions[i].x, 0]);
            const slideY = interpolate(progress, [0, 1], [60 * directions[i].y, 0]);
            const scale = interpolate(progress, [0, 1], [0.85, 1]);

            return (
              <div
                key={item.tag}
                style={{
                  background: colors.bg,
                  padding: 40,
                  opacity: progress,
                  transform: `translate(${slideX}px, ${slideY}px) scale(${scale})`,
                }}
              >
                <div style={{ marginBottom: 16 }}>{item.icon}</div>
                <div style={{ fontSize: 14, color: colors.dim, textTransform: "uppercase" as const, letterSpacing: "0.15em", marginBottom: 6 }}>
                  {item.tag}
                </div>
                <div style={{ fontSize: 26, fontWeight: 600, color: colors.text, marginBottom: 16 }}>
                  {item.headline}
                </div>
                <code style={{ fontSize: 15, color: colors.dim, background: colors.surface, padding: "6px 14px", borderRadius: 6, border: `1px solid ${colors.border}` }}>
                  {item.cmd}
                </code>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
