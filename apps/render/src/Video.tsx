import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig
} from "remotion";
import {
  getSceneTimings,
  normalizeCaption,
  RenderInputProps,
  resolveManifest,
  SceneManifest
} from "./manifest";

const fontFamily = "'Inter', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif";
const accents = ["#7C5CFF", "#5DE2FF", "#8EF6B0", "#F5F5F7"];

const resolveAudioSource = (audioPath?: string) => {
  if (!audioPath) return undefined;
  if (/^(https?:|file:)/.test(audioPath)) return audioPath;
  if (audioPath.startsWith("/")) return `file://${audioPath}`;
  return staticFile(audioPath);
};

const splitText = (value?: string, max = 24) => {
  const text = (value || "").trim();
  if (!text) return [];
  if (text.length <= max) return [text];
  const parts = text.split(/[，。；,.]/).map((item) => item.trim()).filter(Boolean);
  if (parts.length > 1) return parts.slice(0, 3);
  return [text.slice(0, max), text.slice(max, max * 2)].filter(Boolean);
};

const cleanProjectTitle = (value?: string) =>
  (value || "").replace(/^\s*(?:TOP\s*)?\d+\s*[:：.-]?\s*/i, "").trim();

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 180], [0, 1], { extrapolateRight: "extend" });

  return (
    <AbsoluteFill style={{ background: "#07080A", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 20% 8%, rgba(124,92,255,0.34), transparent 34%), radial-gradient(circle at 88% 20%, rgba(93,226,255,0.22), transparent 30%), linear-gradient(180deg, #0B0B0C 0%, #101216 46%, #050506 100%)"
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.22,
          backgroundImage:
            "linear-gradient(rgba(245,245,247,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(245,245,247,0.06) 1px, transparent 1px)",
          backgroundSize: "54px 54px",
          transform: `translateY(${(drift * 54) % 54}px)`
        }}
      />
      {Array.from({ length: 34 }).map((_, index) => {
        const x = (index * 79) % 980;
        const y = (index * 137) % 1660;
        const opacity = 0.18 + ((index * 17) % 40) / 100;
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: 50 + x,
              top: 110 + y,
              width: index % 5 === 0 ? 6 : 3,
              height: index % 5 === 0 ? 6 : 3,
              borderRadius: 99,
              background: index % 3 === 0 ? "#5DE2FF" : "#F5F5F7",
              opacity,
              boxShadow: "0 0 18px rgba(93,226,255,0.6)",
              transform: `translateY(${Math.sin((frame + index * 12) / 24) * 7}px)`
            }}
          />
        );
      })}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(7,8,10,0.1), rgba(7,8,10,0.66) 70%, rgba(7,8,10,0.92))"
        }}
      />
    </AbsoluteFill>
  );
};

const Chrome: React.FC<{
  readonly seriesTitle: string;
  readonly sceneIndex: number;
  readonly sceneCount: number;
  readonly progress: number;
}> = ({ seriesTitle, sceneIndex, sceneCount, progress }) => (
  <>
    <div
      style={{
        position: "absolute",
        top: 54,
        left: 64,
        right: 64,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        color: "rgba(245,245,247,0.78)",
        fontSize: 22,
        fontWeight: 800,
        letterSpacing: 0
      }}
    >
      <span>{seriesTitle}</span>
      <span style={{ color: "#F5F5F7" }}>{String(sceneIndex + 1).padStart(2, "0")} / {String(sceneCount).padStart(2, "0")}</span>
    </div>
    <div
      style={{
        position: "absolute",
        top: 106,
        left: 64,
        right: 64,
        height: 8,
        borderRadius: 99,
        background: "rgba(245,245,247,0.13)",
        overflow: "hidden"
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: "linear-gradient(90deg, #7C5CFF, #5DE2FF, #F5F5F7)",
          boxShadow: "0 0 30px rgba(93,226,255,0.8)"
        }}
      />
    </div>
  </>
);

const IntroScene: React.FC<{ readonly title: string; readonly subtitle: string; readonly enter: number }> = ({ title, subtitle, enter }) => (
  <div
    style={{
      position: "absolute",
      left: 74,
      right: 74,
      top: 292,
      opacity: enter,
      transform: `translateY(${interpolate(enter, [0, 1], [44, 0])}px)`
    }}
  >
    <div style={{ color: "#5DE2FF", fontSize: 28, fontWeight: 900 }}>WEEKLY AI RADAR</div>
    <h1 style={{ margin: "30px 0 0", color: "#F5F5F7", fontSize: 92, lineHeight: 1.04, fontWeight: 950, letterSpacing: 0 }}>{title}</h1>
    <div
      style={{
        marginTop: 36,
        display: "inline-flex",
        padding: "18px 24px",
        borderRadius: 18,
        border: "1px solid rgba(93,226,255,0.32)",
        background: "rgba(93,226,255,0.10)",
        color: "#F5F5F7",
        fontSize: 36,
        fontWeight: 900,
        boxShadow: "0 0 44px rgba(93,226,255,0.18)"
      }}
    >
      {subtitle}
    </div>
    <div style={{ marginTop: 180, display: "flex", gap: 18, color: "#9EA3AE", fontSize: 26, fontWeight: 800 }}>
      <span>★ GitHub Trending</span>
      <span>★ AI Agent</span>
      <span>★ Workflow</span>
    </div>
  </div>
);

const ProjectScene: React.FC<{ readonly scene: SceneManifest; readonly enter: number; readonly accent: string }> = ({ scene, enter, accent }) => {
  const isRankedProject = Boolean(scene.rank || scene.name || scene.growth || /^TOP\s*\d+/i.test(scene.title));
  if (isRankedProject && (scene.rank === undefined || scene.rank === null)) {
    throw new Error(`ranked project scene is missing rank: ${scene.title}`);
  }
  const whyLines = splitText(scene.whyHot || scene.text, 28);
  const tags = scene.tags?.length ? scene.tags : ["AI", "Open Source"];
  const projectTitle = cleanProjectTitle(scene.name || scene.title);

  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        right: 70,
        top: 178,
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [38, 0])}px)`
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 22,
            color: "#F5F5F7"
          }}
        >
          <div
            style={{
              width: 124,
              height: 124,
              borderRadius: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `linear-gradient(135deg, ${accent}, rgba(245,245,247,0.12))`,
              boxShadow: `0 0 54px ${accent}55`,
              fontSize: 48,
              fontWeight: 950
            }}
          >
            {scene.rank ? `#${scene.rank}` : "AI"}
          </div>
          <div>
            <div style={{ color: accent, fontSize: 24, fontWeight: 900 }}>TOP PROJECT</div>
            <div style={{ marginTop: 6, fontSize: 64, lineHeight: 1, fontWeight: 950, letterSpacing: 0 }}>{projectTitle}</div>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 58,
          borderRadius: 38,
          border: "1px solid rgba(245,245,247,0.12)",
          background: "linear-gradient(180deg, rgba(21,23,26,0.92), rgba(12,13,15,0.92))",
          boxShadow: "0 32px 90px rgba(0,0,0,0.42)",
          padding: "42px 44px 38px"
        }}
      >
        <div style={{ color: "#F5F5F7", fontSize: 38, lineHeight: 1.24, fontWeight: 900 }}>{scene.description || normalizeCaption(scene.caption)[0]}</div>
        <div
          style={{
            marginTop: 28,
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 18px",
            borderRadius: 16,
            background: "rgba(93,226,255,0.10)",
            border: "1px solid rgba(93,226,255,0.22)",
            color: "#B8F4FF",
            fontSize: 30,
            fontWeight: 950
          }}
        >
          ★ {scene.growth || "Stars rising this week"}
        </div>
        <div style={{ marginTop: 34, color: "#F5F5F7", fontSize: 32, lineHeight: 1.38, fontWeight: 820 }}>
          {whyLines.map((line, index) => <div key={index}>{line}</div>)}
        </div>
        <div style={{ marginTop: 38, display: "flex", flexWrap: "wrap", gap: 14 }}>
          {tags.slice(0, 3).map((tag) => (
            <div key={tag} style={{ padding: "10px 16px", borderRadius: 999, background: "rgba(245,245,247,0.08)", color: "#D6D8DE", fontSize: 24, fontWeight: 800 }}>
              {tag}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const OutroScene: React.FC<{ readonly enter: number }> = ({ enter }) => (
  <div
    style={{
      position: "absolute",
      left: 76,
      right: 76,
      top: 336,
      opacity: enter,
      transform: `scale(${interpolate(enter, [0, 1], [0.96, 1])})`
    }}
  >
    <div style={{ color: "#5DE2FF", fontSize: 32, fontWeight: 950 }}>NEXT EPISODE?</div>
    <h1 style={{ margin: "28px 0 0", color: "#F5F5F7", fontSize: 92, lineHeight: 1.05, fontWeight: 950 }}>想看下一期</h1>
    <div style={{ marginTop: 20, color: "#F5F5F7", fontSize: 104, lineHeight: 1, fontWeight: 950 }}>评论区扣 1</div>
    <div style={{ marginTop: 66, padding: "24px 28px", borderRadius: 28, background: "rgba(124,92,255,0.16)", border: "1px solid rgba(124,92,255,0.36)", color: "#D6D8DE", fontSize: 34, fontWeight: 850 }}>
      DevShorts AI 自动生成
    </div>
  </div>
);

const CaptionBar: React.FC<{ readonly scene: SceneManifest }> = ({ scene }) => (
  <div
    style={{
      position: "absolute",
      left: 70,
      right: 70,
      bottom: 112,
      borderRadius: 22,
      background: "rgba(5,5,6,0.72)",
      border: "1px solid rgba(245,245,247,0.16)",
      padding: "18px 26px",
      color: "#F5F5F7",
      fontSize: 34,
      lineHeight: 1.25,
      fontWeight: 900,
      textAlign: "center",
      textShadow: "0 2px 0 rgba(0,0,0,0.8)",
      boxShadow: "0 20px 70px rgba(0,0,0,0.32)"
    }}
  >
    {normalizeCaption(scene.caption)[0]}
  </div>
);

const Scene: React.FC<{
  readonly scene: SceneManifest;
  readonly sceneIndex: number;
  readonly sceneCount: number;
  readonly durationInFrames: number;
  readonly seriesTitle: string;
  readonly subtitle: string;
}> = ({ scene, sceneIndex, sceneCount, durationInFrames, seriesTitle, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const accent = accents[sceneIndex % accents.length];
  const enter = spring({ frame: frame + 8, fps, config: { damping: 190, stiffness: 118 }, durationInFrames: 22 });
  const progress = interpolate(frame, [0, durationInFrames], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const isIntro = sceneIndex === 0 && !scene.rank;
  const isOutro = sceneIndex === sceneCount - 1 && !scene.rank;

  return (
    <AbsoluteFill style={{ fontFamily, color: "white" }}>
      <Chrome seriesTitle={seriesTitle} sceneIndex={sceneIndex} sceneCount={sceneCount} progress={progress} />
      {isIntro ? <IntroScene title={seriesTitle} subtitle={subtitle} enter={enter} /> : null}
      {!isIntro && !isOutro ? <ProjectScene scene={scene} enter={enter} accent={accent} /> : null}
      {isOutro ? <OutroScene enter={enter} /> : null}
      <CaptionBar scene={scene} />
      <div style={{ position: "absolute", left: 70, bottom: 48, color: "rgba(245,245,247,0.42)", fontSize: 20, fontWeight: 800 }}>DEVSHORTS AI</div>
    </AbsoluteFill>
  );
};

export const DevShortsPortrait: React.FC<RenderInputProps> = (props) => {
  const manifest = resolveManifest(props);
  const audioSource = resolveAudioSource(manifest.audioPath);
  const timings = getSceneTimings(manifest);

  return (
    <AbsoluteFill style={{ background: "#0B0B0C" }}>
      <Background />
      {audioSource ? <Audio src={audioSource} /> : null}
      {manifest.scenes.map((scene, index) => {
        const timing = timings[index];

        return (
          <Sequence key={`${scene.title}-${index}`} from={timing.fromFrame} durationInFrames={timing.durationInFrames}>
            <Scene
              scene={scene}
              sceneIndex={index}
              sceneCount={manifest.scenes.length}
              durationInFrames={timing.durationInFrames}
              seriesTitle={manifest.title ?? "DevShorts AI"}
              subtitle={manifest.subtitle ?? "Runtime Preview"}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
