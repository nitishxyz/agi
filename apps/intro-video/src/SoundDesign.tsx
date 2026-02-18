import { Audio, Sequence, staticFile } from "remotion";

const sfx = {
  chime: staticFile("sfx/chime.wav"),
  whooshUp: staticFile("sfx/whoosh-up.wav"),
  whooshDown: staticFile("sfx/whoosh-down.wav"),
  slide: staticFile("sfx/slide.wav"),
  pop: staticFile("sfx/pop.wav"),
  popSmall: staticFile("sfx/pop-small.wav"),
  tick: staticFile("sfx/tick.wav"),
  success: staticFile("sfx/success.wav"),
  scalePop: staticFile("sfx/scale-pop.wav"),
  ambient: staticFile("sfx/ambient.wav"),
};

const T = 18;

const S1 = 0;
const S2 = 160 - T;
const S3 = S2 + 140 - T;
const S4 = S3 + 230 - T;
const S5 = S4 + 150 - T;
const S6 = S5 + 140 - T;
const S7 = S6 + 130 - T;

const Sfx: React.FC<{ src: string; frame: number; volume?: number }> = ({
  src,
  frame,
  volume = 0.4,
}) => (
  <Sequence from={frame} durationInFrames={90} name="sfx">
    <Audio src={src} volume={volume} />
  </Sequence>
);

export const SoundDesign: React.FC = () => {
  return (
    <>
      <Sequence from={0} durationInFrames={1002} name="ambient">
        <Audio src={sfx.ambient} volume={0.5} />
      </Sequence>

      {/* Scene 1: Logo Reveal */}
      <Sfx src={sfx.chime} frame={S1 + 8} volume={0.5} />
      <Sfx src={sfx.pop} frame={S1 + 50} volume={0.2} />
      <Sfx src={sfx.whooshUp} frame={160 - T} volume={0.3} />

      {/* Scene 2: Tagline */}
      <Sfx src={sfx.whooshDown} frame={S2} volume={0.25} />
      <Sfx src={sfx.pop} frame={S2 + 5} volume={0.2} />
      <Sfx src={sfx.pop} frame={S2 + 25} volume={0.2} />
      <Sfx src={sfx.pop} frame={S2 + 45} volume={0.2} />

      {/* Scene 3: Product Mockup */}
      <Sfx src={sfx.whooshUp} frame={S3} volume={0.3} />
      <Sfx src={sfx.popSmall} frame={S3 + 18} volume={0.15} />
      <Sfx src={sfx.tick} frame={S3 + 35} volume={0.15} />
      <Sfx src={sfx.tick} frame={S3 + 57} volume={0.15} />
      <Sfx src={sfx.tick} frame={S3 + 79} volume={0.15} />
      <Sfx src={sfx.tick} frame={S3 + 101} volume={0.15} />
      <Sfx src={sfx.tick} frame={S3 + 123} volume={0.15} />
      <Sfx src={sfx.success} frame={S3 + 160} volume={0.35} />
      <Sfx src={sfx.whooshUp} frame={S3 + 230 - T} volume={0.3} />

      {/* Scene 4: Interfaces */}
      <Sfx src={sfx.whooshUp} frame={S4} volume={0.25} />
      <Sfx src={sfx.pop} frame={S4 + 25} volume={0.18} />
      <Sfx src={sfx.pop} frame={S4 + 40} volume={0.18} />
      <Sfx src={sfx.pop} frame={S4 + 55} volume={0.18} />
      <Sfx src={sfx.pop} frame={S4 + 70} volume={0.18} />
      <Sfx src={sfx.slide} frame={S4 + 150 - T} volume={0.25} />

      {/* Scene 5: Providers */}
      <Sfx src={sfx.slide} frame={S5} volume={0.25} />
      <Sfx src={sfx.popSmall} frame={S5 + 20} volume={0.12} />
      <Sfx src={sfx.popSmall} frame={S5 + 28} volume={0.12} />
      <Sfx src={sfx.popSmall} frame={S5 + 36} volume={0.12} />
      <Sfx src={sfx.popSmall} frame={S5 + 44} volume={0.12} />
      <Sfx src={sfx.popSmall} frame={S5 + 52} volume={0.12} />
      <Sfx src={sfx.popSmall} frame={S5 + 60} volume={0.12} />
      <Sfx src={sfx.scalePop} frame={S5 + 140 - T} volume={0.2} />

      {/* Scene 6: Tools */}
      <Sfx src={sfx.scalePop} frame={S6} volume={0.25} />
      {Array.from({ length: 12 }, (_, i) => {
        const row = Math.floor(i / 4);
        const col = i % 4;
        const delay = 15 + row * 12 + col * 5;
        return (
          <Sfx
            key={`tool-${i}`}
            src={sfx.tick}
            frame={S6 + delay}
            volume={0.1}
          />
        );
      })}
      <Sfx src={sfx.whooshUp} frame={S6 + 130 - T} volume={0.25} />

      {/* Scene 7: CTA */}
      <Sfx src={sfx.whooshDown} frame={S7} volume={0.25} />
      <Sfx src={sfx.chime} frame={S7 + 5} volume={0.35} />
      <Sfx src={sfx.pop} frame={S7 + 40} volume={0.2} />
    </>
  );
};
