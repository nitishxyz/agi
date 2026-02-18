import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { colors, font } from "../theme";

const TOOL_STEPS = [
  { icon: "search", label: "glob", detail: "src/**/*.tsx — 8 files", color: colors.amber },
  { icon: "file", label: "read", detail: "src/App.tsx — 42 lines", color: "#3B82F6" },
  { icon: "write", label: "write", detail: "src/Waitlist.tsx — 64 lines", color: colors.emerald },
  { icon: "patch", label: "apply_patch", detail: "App.tsx — 4 lines changed", color: colors.purple },
  { icon: "terminal", label: "terminal", detail: "bun dev — ready on :3000", color: colors.muted },
];

const ToolIcon: React.FC<{ type: string; color: string; size?: number }> = ({ type, color, size = 20 }) => {
  const icons: Record<string, React.ReactNode> = {
    search: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
      </svg>
    ),
    file: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" />
      </svg>
    ),
    write: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M3 15h6" /><path d="M6 12v6" />
      </svg>
    ),
    patch: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v14" /><path d="M5 10h14" /><path d="M5 21h14" />
      </svg>
    ),
    terminal: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
  };
  return <>{icons[type]}</>;
};

export const ProductMockup: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardProgress = spring({
    frame,
    fps,
    config: { damping: 16, mass: 1, stiffness: 100 },
    delay: 5,
  });
  const cardScale = interpolate(cardProgress, [0, 1], [0.6, 1]);
  const cardRotate = interpolate(cardProgress, [0, 1], [3, 0]);

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
          width: 1400,
          background: colors.surface,
          borderRadius: 24,
          border: `2px solid ${colors.border}`,
          overflow: "hidden",
          boxShadow: "0 40px 80px rgba(0,0,0,0.12)",
          opacity: cardProgress,
          transform: `scale(${cardScale}) rotate(${cardRotate}deg)`,
        }}
      >
        <div
          style={{
            height: 84,
            borderBottom: `2px solid ${colors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 28px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span style={{ fontSize: 24, fontWeight: 600, color: colors.text }}>
              Build waitlist page
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 20 }}>
            <span style={{ color: colors.dim }}>claude-sonnet-4</span>
          </div>
        </div>

        <div style={{ padding: "32px 44px", minHeight: 420 }}>
          {(() => {
            const msgProgress = spring({
              frame: frame - 18,
              fps,
              config: { damping: 18, mass: 0.6, stiffness: 180 },
            });
            const msgX = interpolate(msgProgress, [0, 1], [100, 0]);
            return (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginBottom: 28,
                  opacity: msgProgress,
                  transform: `translateX(${msgX}px)`,
                }}
              >
                <div
                  style={{
                    background: "rgba(16, 185, 129, 0.08)",
                    border: "2px solid rgba(16, 185, 129, 0.2)",
                    borderRadius: 18,
                    padding: "16px 26px",
                    fontSize: 26,
                    color: colors.text,
                    maxWidth: 650,
                  }}
                >
                  build me a waitlist page with a gradient bg and confetti on signup
                </div>
              </div>
            );
          })()}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {TOOL_STEPS.map((step, i) => {
              const stepDelay = 35 + i * 22;
              const progress = spring({
                frame: frame - stepDelay,
                fps,
                config: { damping: 16, mass: 0.5, stiffness: 240 },
              });
              const slideX = interpolate(progress, [0, 1], [-80, 0]);
              const scale = interpolate(progress, [0, 1], [0.8, 1]);

              return (
                <div
                  key={step.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    opacity: progress,
                    transform: `translateX(${slideX}px) scale(${scale})`,
                    paddingLeft: 12,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: `${step.color}12`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <ToolIcon type={step.icon} color={step.color} />
                  </div>
                  <span style={{ fontSize: 26, fontWeight: 600, color: step.color }}>
                    {step.label}
                  </span>
                  <span style={{ fontSize: 24, color: colors.dim }}>
                    {step.detail}
                  </span>
                </div>
              );
            })}
          </div>

          {(() => {
            const msgDelay = 35 + TOOL_STEPS.length * 22 + 15;
            const msgProgress = spring({
              frame: frame - msgDelay,
              fps,
              config: { damping: 14, mass: 0.6, stiffness: 180 },
            });
            const popScale = interpolate(msgProgress, [0, 1], [0.6, 1]);

            return (
              <div
                style={{
                  marginTop: 24,
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                  opacity: msgProgress,
                  transform: `scale(${popScale})`,
                  transformOrigin: "left center",
                  paddingLeft: 12,
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.emerald} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 3, flexShrink: 0 }}>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <div style={{ fontSize: 26, color: colors.text, lineHeight: 1.5 }}>
                  Created <code style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "2px 10px", fontSize: 20 }}>Waitlist.tsx</code> with animated mesh gradient and confetti on submit.
                </div>
              </div>
            );
          })()}
        </div>

        <div
          style={{
            padding: "16px 28px",
            borderTop: `2px solid ${colors.border}`,
          }}
        >
          <div
            style={{
              background: colors.card,
              borderRadius: 9999,
              border: `1px solid ${colors.border}`,
              padding: "12px 12px 12px 26px",
              fontSize: 26,
              color: colors.dim,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <span>Type a message...</span>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                backgroundColor: colors.text,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.bg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12 7-7 7 7" />
                <path d="M12 19V5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
