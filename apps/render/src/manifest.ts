export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export type SceneManifest = {
  readonly id?: string;
  readonly title: string;
  readonly caption: string | readonly string[];
  readonly audioPath?: string;
  readonly duration?: number;
  readonly text?: string;
  readonly rank?: number;
  readonly name?: string;
  readonly description?: string;
  readonly growth?: string;
  readonly whyHot?: string;
  readonly tags?: readonly string[];
};

export type TimelineEntry = {
  readonly sceneIndex?: number;
  readonly rank?: number;
  readonly title?: string;
  readonly speechStartMs?: number;
  readonly speechEndMs?: number;
  readonly silenceStartMs?: number;
  readonly silenceEndMs?: number;
  readonly visualStartMs?: number;
  readonly visualEndMs?: number;
  readonly fromFrame: number;
  readonly durationInFrames: number;
};

export type RenderManifest = {
  readonly template?: string;
  readonly title?: string;
  readonly subtitle?: string;
  readonly audioPath?: string;
  readonly fps?: number;
  readonly timeline?: readonly TimelineEntry[];
  readonly scenes: readonly SceneManifest[];
};

export type RenderInputProps = {
  readonly manifest?: RenderManifest;
} & Partial<RenderManifest>;

export const defaultManifest = {
  template: "creator-short",
  title: "DevShorts AI",
  subtitle: "Runtime Preview",
  audioPath: "",
  scenes: [
    {
      title: "脚本进入渲染队列",
      caption: ["读取 manifest", "生成竖屏时间线"],
      audioPath: "",
      duration: 2.4
    },
    {
      title: "字幕与旁白对齐",
      caption: ["每个 scene 自带 duration", "后续可接入真实 voice.wav"],
      audioPath: "",
      duration: 2.8
    },
    {
      title: "输出 final.mp4",
      caption: ["544 x 960", "适配开发者短视频"],
      audioPath: "",
      duration: 2.6
    }
  ]
} satisfies RenderManifest;

export const normalizeCaption = (caption: SceneManifest["caption"]) =>
  Array.isArray(caption) ? caption : [caption];

const isTimelineEntry = (entry: TimelineEntry | undefined): entry is TimelineEntry =>
  typeof entry?.fromFrame === "number" &&
  Number.isFinite(entry.fromFrame) &&
  typeof entry.durationInFrames === "number" &&
  Number.isFinite(entry.durationInFrames) &&
  entry.durationInFrames > 0;

export const resolveManifest = (props: RenderInputProps): RenderManifest => {
  const candidate = props.manifest ?? props;
  const rawScenes = candidate.scenes ?? [];
  const rawTimeline = candidate.timeline ?? [];
  const timelinePairs = rawTimeline
    .map((timeline, index) => {
      const sceneIndex = Number.isInteger(timeline.sceneIndex) ? timeline.sceneIndex : index;
      return { scene: rawScenes[sceneIndex ?? index], timeline };
    })
    .filter((pair) => isTimelineEntry(pair.timeline));
  const hasTimeline = rawTimeline.length > 0;
  const scenes = hasTimeline
    ? timelinePairs.map((pair) => pair.scene)
    : rawScenes.filter((scene) => (scene.duration ?? 0) > 0);
  const timeline = hasTimeline
    ? timelinePairs.map((pair) => ({
        sceneIndex: pair.timeline.sceneIndex,
        rank: pair.timeline.rank,
        title: pair.timeline.title,
        speechStartMs: pair.timeline.speechStartMs,
        speechEndMs: pair.timeline.speechEndMs,
        silenceStartMs: pair.timeline.silenceStartMs,
        silenceEndMs: pair.timeline.silenceEndMs,
        visualStartMs: pair.timeline.visualStartMs,
        visualEndMs: pair.timeline.visualEndMs,
        fromFrame: Math.max(0, Math.round(pair.timeline.fromFrame)),
        durationInFrames: Math.max(1, Math.round(pair.timeline.durationInFrames))
      }))
    : undefined;

  if (scenes.length === 0) {
    return defaultManifest;
  }

  return {
    template: candidate.template ?? defaultManifest.template,
    title: candidate.title ?? defaultManifest.title,
    subtitle: candidate.subtitle ?? defaultManifest.subtitle,
    audioPath: candidate.audioPath ?? defaultManifest.audioPath,
    fps: candidate.fps,
    timeline,
    scenes
  };
};

export const getFps = (manifest: RenderManifest) => manifest.fps ?? FPS;

export const getSceneTimings = (manifest: RenderManifest) => {
  if (manifest.timeline?.length) {
    return manifest.timeline.map((entry) => ({
      fromFrame: entry.fromFrame,
      durationInFrames: entry.durationInFrames
    }));
  }

  let cursor = 0;

  return manifest.scenes.map((scene) => {
    const durationInFrames = Math.max(1, Math.round((scene.duration ?? 0) * getFps(manifest)));
    const timing = { fromFrame: cursor, durationInFrames };
    cursor += durationInFrames;

    return timing;
  });
};

export const getSceneFrames = (manifest: RenderManifest) =>
  getSceneTimings(manifest).map((timing) => timing.durationInFrames);

export const getTotalFrames = (manifest: RenderManifest) =>
  getSceneTimings(manifest).reduce(
    (total, timing) => Math.max(total, timing.fromFrame + timing.durationInFrames),
    0
  );
