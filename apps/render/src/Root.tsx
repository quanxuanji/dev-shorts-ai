import React from "react";
import { Composition } from "remotion";
import { DevShortsPortrait } from "./Video";
import {
  defaultManifest,
  getFps,
  getTotalFrames,
  HEIGHT,
  RenderInputProps,
  resolveManifest,
  WIDTH
} from "./manifest";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DevShortsPortrait"
      component={DevShortsPortrait}
      defaultProps={{ manifest: defaultManifest }}
      durationInFrames={getTotalFrames(defaultManifest)}
      fps={getFps(defaultManifest)}
      width={WIDTH}
      height={HEIGHT}
      calculateMetadata={({ props }) => {
        const manifest = resolveManifest(props as RenderInputProps);

        return {
          durationInFrames: getTotalFrames(manifest),
          fps: getFps(manifest),
          width: WIDTH,
          height: HEIGHT,
          props: { manifest }
        };
      }}
    />
  );
};
