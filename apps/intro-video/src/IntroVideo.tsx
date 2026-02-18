import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, Easing } from "remotion";
import { LogoReveal } from "./scenes/LogoReveal";
import { Tagline } from "./scenes/Tagline";
import { ProductMockup } from "./scenes/ProductMockup";
import { Interfaces } from "./scenes/Interfaces";
import { Providers } from "./scenes/Providers";
import { Tools } from "./scenes/Tools";
import { Setu } from "./scenes/Setu";
import { LocalFirst } from "./scenes/LocalFirst";
import { OpenSource } from "./scenes/OpenSource";
import { CTA } from "./scenes/CTA";
import { SoundDesign } from "./SoundDesign";

const T = 18;

type TransitionType = "fade" | "drop" | "push-up" | "slide-left" | "scale";

const SceneTransition: React.FC<{
  children: React.ReactNode;
  durationInFrames: number;
  enterType: TransitionType;
  exitType: TransitionType;
}> = ({ children, durationInFrames, enterType, exitType }) => {
  const frame = useCurrentFrame();

  const enterProgress = interpolate(frame, [0, T], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const exitProgress = interpolate(
    frame,
    [durationInFrames - T, durationInFrames],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    },
  );

  const enterStyles = getEnterStyles(enterType, enterProgress);
  const exitStyles = getExitStyles(exitType, exitProgress);

  const isEntering = frame < T;
  const isExiting = frame > durationInFrames - T;
  const activeStyles = isExiting ? exitStyles : isEntering ? enterStyles : {};

  return (
    <AbsoluteFill
      style={{
        ...activeStyles,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

function getEnterStyles(type: TransitionType, progress: number): React.CSSProperties {
  switch (type) {
    case "drop":
      return {
        opacity: progress,
        transform: `translateY(${interpolate(progress, [0, 1], [-1080, 0])}px)`,
      };
    case "push-up":
      return {
        transform: `translateY(${interpolate(progress, [0, 1], [1080, 0])}px)`,
      };
    case "slide-left":
      return {
        opacity: progress,
        transform: `translateX(${interpolate(progress, [0, 1], [1920, 0])}px)`,
      };
    case "scale":
      return {
        opacity: progress,
        transform: `scale(${interpolate(progress, [0, 1], [0.6, 1])})`,
      };
    case "fade":
    default:
      return { opacity: progress };
  }
}

function getExitStyles(type: TransitionType, progress: number): React.CSSProperties {
  switch (type) {
    case "push-up":
      return {
        transform: `translateY(${interpolate(progress, [0, 1], [0, -1080])}px)`,
      };
    case "drop":
      return {
        opacity: 1 - progress,
        transform: `translateY(${interpolate(progress, [0, 1], [0, 1080])}px)`,
      };
    case "slide-left":
      return {
        opacity: 1 - progress,
        transform: `translateX(${interpolate(progress, [0, 1], [0, -1920])}px)`,
      };
    case "scale":
      return {
        opacity: 1 - progress,
        transform: `scale(${interpolate(progress, [0, 1], [1, 0.6])})`,
      };
    case "fade":
    default:
      return { opacity: 1 - progress };
  }
}

export const IntroVideo: React.FC = () => {
  const scenes: {
    component: React.ReactNode;
    duration: number;
    enter: TransitionType;
    exit: TransitionType;
  }[] = [
    { component: <LogoReveal />, duration: 160, enter: "fade", exit: "push-up" },
    { component: <Tagline />, duration: 140, enter: "drop", exit: "fade" },
    { component: <ProductMockup />, duration: 230, enter: "push-up", exit: "push-up" },
    { component: <Interfaces />, duration: 150, enter: "push-up", exit: "slide-left" },
    { component: <Providers />, duration: 140, enter: "slide-left", exit: "scale" },
    { component: <Setu />, duration: 195, enter: "scale", exit: "push-up" },
    { component: <LocalFirst />, duration: 195, enter: "push-up", exit: "slide-left" },
    { component: <Tools />, duration: 130, enter: "slide-left", exit: "push-up" },
    { component: <OpenSource />, duration: 195, enter: "drop", exit: "scale" },
    { component: <CTA />, duration: 160, enter: "scale", exit: "fade" },
  ];

  let offset = 0;

  return (
    <AbsoluteFill>
      <SoundDesign />
      {scenes.map((scene, i) => {
        const from = offset;
        offset += scene.duration - T;

        return (
          <Sequence
            key={i}
            from={from}
            durationInFrames={scene.duration}
            name={`Scene ${i + 1}`}
          >
            <SceneTransition
              durationInFrames={scene.duration}
              enterType={scene.enter}
              exitType={scene.exit}
            >
              {scene.component}
            </SceneTransition>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
