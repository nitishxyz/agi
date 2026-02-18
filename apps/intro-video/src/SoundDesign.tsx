import { Audio, Sequence, staticFile } from "remotion";

export const SoundDesign: React.FC = () => {
  return (
    <>
      <Sequence from={0} durationInFrames={1533} name="soundtrack">
        <Audio
          src={staticFile("sfx/tomorow_itll_be_something_else.wav")}
          startFrom={12 * 30}
          volume={0.45}
        />
      </Sequence>
    </>
  );
};
