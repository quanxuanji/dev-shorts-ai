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

type SceneTone = "intro" | "problem" | "solution" | "project" | "summary";

const resolveAudioSource = (audioPath?: string) => {
  if (!audioPath) return undefined;
  if (/^(https?:|file:)/.test(audioPath)) return audioPath;
  if (audioPath.startsWith("/")) return `file://${audioPath}`;
  return staticFile(audioPath);
};

const compactText = (value?: string) => (value || "").replace(/\s+/g, " ").trim();

const truncateText = (value: string, max: number) => {
  const text = compactText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
};

const splitText = (value?: string, max = 24) => {
  const text = compactText(value);
  if (!text) return [];
  if (text.length <= max) return [text];
  const parts = text.split(/[，。；,!?！？、]/).map((item) => item.trim()).filter(Boolean);
  if (parts.length > 1) return parts.slice(0, 3).map((part) => truncateText(part, max));
  return [truncateText(text, max)];
};

const cleanProjectTitle = (value?: string) =>
  compactText(value).replace(/^\s*(?:TOP\s*)?\d+\s*[:：?-]?\s*/i, "").trim();

const sceneCopy = (scene: SceneManifest) => {
  const caption = normalizeCaption(scene.caption).join(" ");
  return compactText([scene.title, scene.caption, scene.description, scene.whyHot, scene.text, caption].filter(Boolean).join(" "));
};

const sceneTone = (scene: SceneManifest, sceneIndex: number, sceneCount: number): SceneTone => {
  const explicit = scene.sceneType;
  if (explicit === "problem" || explicit === "solution" || explicit === "project" || explicit === "summary" || explicit === "intro") {
    return explicit;
  }
  if (sceneIndex === 0 && !scene.rank) return "intro";
  if (sceneIndex === sceneCount - 1 && !scene.rank) return "summary";
  if (scene.rank || scene.name || scene.growth || /^TOP\s*\d+/i.test(scene.title)) return "project";

  const text = sceneCopy(scene);
  if (/痛点|问题|卡住|太慢|失败|混乱|风险|难/.test(text)) return "problem";
  if (/方案|解决|做法|自动|生成|提升|优化|方法/.test(text)) return "solution";
  return "solution";
};

const toneLabel: Record<SceneTone, string> = {
  intro: "本期看点",
  problem: "先看问题",
  solution: "解决方案",
  project: "重点项目",
  summary: "最后总结"
};

const toneHook: Record<SceneTone, string> = {
  intro: "这条视频会讲清楚",
  problem: "为什么这一步很容易翻车？",
  solution: "真正有用的是这一步",
  project: "为什么它值得关注？",
  summary: "记住这 3 个结论"
};

const displayTitle = (scene: SceneManifest) => truncateText(cleanProjectTitle(scene.name || scene.title) || "AI 短视频", 22);

const mainStatement = (scene: SceneManifest, tone: SceneTone) => {
  if (scene.takeaway) return truncateText(scene.takeaway, 36);
  if (scene.description) return truncateText(scene.description, 36);
  if (scene.whyHot) return truncateText(scene.whyHot, 36);
  const captions = normalizeCaption(scene.caption).filter(Boolean);
  if (captions[0]) return truncateText(captions[0], 36);
  if (scene.text) return truncateText(scene.text, 36);
  if (tone === "problem") return "先把问题讲清楚，后面才好生成";
  if (tone === "summary") return "最后用一句话收住重点";
  return truncateText(scene.title, 36);
};

const bulletItems = (scene: SceneManifest, tone: SceneTone) => {
  if (scene.bullets?.length) return scene.bullets.slice(0, 3).map((item) => truncateText(item, 22));

  const candidates = [
    ...normalizeCaption(scene.caption),
    scene.whyHot,
    scene.description,
    scene.text
  ].flatMap((value) => splitText(value, 22));

  const unique = candidates.filter((item, index) => item && candidates.indexOf(item) === index).slice(0, 3);
  if (unique.length >= 3) return unique;

  const fallbacks: Record<SceneTone, string[]> = {
    intro: ["先讲问题", "再讲做法", "最后给结论"],
    problem: ["成本变高", "沟通变慢", "返工变多"],
    solution: ["输入更简单", "过程更自动", "结果可复用"],
    project: ["解决真实问题", "上手门槛低", "适合现在关注"],
    summary: ["抓住主线", "保留重点", "直接行动"]
  };

  return [...unique, ...fallbacks[tone]].slice(0, 3);
};

const keywordTags = (scene: SceneManifest, tone: SceneTone) => {
  if (scene.tags?.length) return scene.tags.slice(0, 4);
  if (tone === "problem") return ["痛点", "效率", "风险"];
  if (tone === "summary") return ["结论", "下一步", "复盘"];
  if (tone === "project") return ["AI", "开源", "工具"];
  return ["AI", "流程", "自动化"];
};

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
          opacity: 0.2,
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

const IntroScene: React.FC<{
  readonly title: string;
  readonly subtitle: string;
  readonly highlights: readonly string[];
  readonly enter: number;
}> = ({ title, subtitle, highlights, enter }) => (
  <div
    style={{
      position: "absolute",
      left: 74,
      right: 74,
      top: 250,
      opacity: enter,
      transform: `translateY(${interpolate(enter, [0, 1], [44, 0])}px)`
    }}
  >
    <div style={{ color: "#5DE2FF", fontSize: 28, fontWeight: 950 }}>AI SHORT VIDEO</div>
    <h1 style={{ margin: "30px 0 0", color: "#F5F5F7", fontSize: 88, lineHeight: 1.04, fontWeight: 950, letterSpacing: 0 }}>{title}</h1>
    <div
      style={{
        marginTop: 34,
        display: "inline-flex",
        padding: "18px 24px",
        borderRadius: 18,
        border: "1px solid rgba(93,226,255,0.32)",
        background: "rgba(93,226,255,0.10)",
        color: "#F5F5F7",
        fontSize: 34,
        fontWeight: 900,
        boxShadow: "0 0 44px rgba(93,226,255,0.18)"
      }}
    >
      {subtitle}
    </div>

    <div style={{ marginTop: 92, display: "grid", gap: 18 }}>
      {highlights.slice(0, 3).map((item, index) => (
        <div
          key={item}
          style={{
            display: "grid",
            gridTemplateColumns: "58px 1fr",
            alignItems: "center",
            gap: 18,
            padding: "22px 24px",
            borderRadius: 28,
            background: "rgba(245,245,247,0.075)",
            border: "1px solid rgba(245,245,247,0.12)"
          }}
        >
          <div style={{ color: "#050506", background: index === 0 ? "#5DE2FF" : index === 1 ? "#8EF6B0" : "#F5F5F7", width: 58, height: 58, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 950 }}>
            {index + 1}
          </div>
          <div style={{ color: "#F5F5F7", fontSize: 32, lineHeight: 1.25, fontWeight: 900 }}>{item}</div>
        </div>
      ))}
    </div>
  </div>
);

const InfoScene: React.FC<{ readonly scene: SceneManifest; readonly enter: number; readonly accent: string; readonly tone: SceneTone }> = ({ scene, enter, accent, tone }) => {
  const statement = mainStatement(scene, tone);
  const bullets = bulletItems(scene, tone);
  const tags = keywordTags(scene, tone);

  return (
    <div
      style={{
        position: "absolute",
        left: 68,
        right: 68,
        top: 168,
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [38, 0])}px)`
      }}
    >
      <div style={{ color: accent, fontSize: 26, fontWeight: 950 }}>{scene.hook || toneHook[tone]}</div>
      <h2 style={{ margin: "18px 0 0", color: "#F5F5F7", fontSize: 70, lineHeight: 1.05, fontWeight: 950, letterSpacing: 0 }}>{displayTitle(scene)}</h2>

      <div
        style={{
          marginTop: 50,
          padding: "40px 42px",
          borderRadius: 40,
          background: "linear-gradient(180deg, rgba(245,245,247,0.105), rgba(245,245,247,0.045))",
          border: "1px solid rgba(245,245,247,0.14)",
          boxShadow: `0 34px 90px rgba(0,0,0,0.42), 0 0 60px ${accent}24`
        }}
      >
        <div style={{ color: "#F5F5F7", fontSize: 46, lineHeight: 1.18, fontWeight: 950 }}>{statement}</div>
        <div style={{ marginTop: 34, display: "grid", gap: 16 }}>
          {bullets.map((item, index) => (
            <div key={`${item}-${index}`} style={{ display: "grid", gridTemplateColumns: "44px 1fr", alignItems: "start", gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: `${accent}22`, border: `1px solid ${accent}55`, color: accent, fontSize: 22, fontWeight: 950 }}>
                {index + 1}
              </div>
              <div style={{ color: "#DDE0E8", fontSize: 32, lineHeight: 1.28, fontWeight: 850 }}>{item}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 34, display: "flex", flexWrap: "wrap", gap: 14 }}>
        {tags.map((tag) => (
          <div key={tag} style={{ padding: "11px 18px", borderRadius: 999, background: "rgba(5,5,6,0.5)", border: "1px solid rgba(245,245,247,0.14)", color: "#D6D8DE", fontSize: 24, fontWeight: 850 }}>
            {tag}
          </div>
        ))}
      </div>
    </div>
  );
};

const ProjectScene: React.FC<{ readonly scene: SceneManifest; readonly enter: number; readonly accent: string }> = ({ scene, enter, accent }) => {
  const isRankedProject = Boolean(scene.rank || scene.name || scene.growth || /^TOP\s*\d+/i.test(scene.title));
  if (isRankedProject && (scene.rank === undefined || scene.rank === null)) {
    throw new Error(`ranked project scene is missing rank: ${scene.title}`);
  }

  const bullets = bulletItems(scene, "project");
  const tags = keywordTags(scene, "project");
  const projectTitle = displayTitle(scene);

  return (
    <div
      style={{
        position: "absolute",
        left: 68,
        right: 68,
        top: 168,
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [38, 0])}px)`
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 22, color: "#F5F5F7" }}>
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `linear-gradient(135deg, ${accent}, rgba(245,245,247,0.12))`,
            boxShadow: `0 0 54px ${accent}55`,
            fontSize: 46,
            fontWeight: 950
          }}
        >
          {scene.rank ? `#${scene.rank}` : "AI"}
        </div>
        <div>
          <div style={{ color: accent, fontSize: 24, fontWeight: 950 }}>重点项目 / 工具</div>
          <div style={{ marginTop: 8, fontSize: 62, lineHeight: 1, fontWeight: 950, letterSpacing: 0 }}>{projectTitle}</div>
        </div>
      </div>

      <div
        style={{
          marginTop: 54,
          borderRadius: 42,
          border: "1px solid rgba(245,245,247,0.14)",
          background: "linear-gradient(180deg, rgba(21,23,26,0.94), rgba(12,13,15,0.94))",
          boxShadow: "0 32px 90px rgba(0,0,0,0.42)",
          padding: "40px 42px"
        }}
      >
        <div style={{ color: "#9EA3AE", fontSize: 24, fontWeight: 900 }}>一句话看懂</div>
        <div style={{ marginTop: 12, color: "#F5F5F7", fontSize: 44, lineHeight: 1.16, fontWeight: 950 }}>{mainStatement(scene, "project")}</div>

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
            fontSize: 28,
            fontWeight: 950
          }}
        >
          {scene.growth || "这周热度上升"}
        </div>

        <div style={{ marginTop: 34, display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
          {bullets.map((item, index) => (
            <div key={`${item}-${index}`} style={{ display: "grid", gridTemplateColumns: "128px 1fr", gap: 18, alignItems: "center", padding: "18px 20px", borderRadius: 22, background: "rgba(245,245,247,0.065)", border: "1px solid rgba(245,245,247,0.08)" }}>
              <div style={{ color: accent, fontSize: 24, fontWeight: 950 }}>{["解决什么", "适合谁", "为什么火"][index] ?? "重点"}</div>
              <div style={{ color: "#F5F5F7", fontSize: 29, lineHeight: 1.24, fontWeight: 850 }}>{item}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 34, display: "flex", flexWrap: "wrap", gap: 14 }}>
        {tags.map((tag) => (
          <div key={tag} style={{ padding: "10px 16px", borderRadius: 999, background: "rgba(245,245,247,0.08)", color: "#D6D8DE", fontSize: 24, fontWeight: 850 }}>
            {tag}
          </div>
        ))}
      </div>
    </div>
  );
};

const OutroScene: React.FC<{ readonly enter: number; readonly scene: SceneManifest }> = ({ enter, scene }) => {
  const bullets = bulletItems(scene, "summary");

  return (
    <div
      style={{
        position: "absolute",
        left: 76,
        right: 76,
        top: 286,
        opacity: enter,
        transform: `scale(${interpolate(enter, [0, 1], [0.96, 1])})`
      }}
    >
      <div style={{ color: "#5DE2FF", fontSize: 32, fontWeight: 950 }}>最后总结</div>
      <h1 style={{ margin: "28px 0 0", color: "#F5F5F7", fontSize: 80, lineHeight: 1.05, fontWeight: 950 }}>{mainStatement(scene, "summary")}</h1>
      <div style={{ marginTop: 58, display: "grid", gap: 18 }}>
        {bullets.map((item, index) => (
          <div key={item} style={{ padding: "22px 24px", borderRadius: 26, background: "rgba(124,92,255,0.14)", border: "1px solid rgba(124,92,255,0.32)", color: "#F5F5F7", fontSize: 32, lineHeight: 1.25, fontWeight: 900 }}>
            {index + 1}. {item}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 58, padding: "24px 28px", borderRadius: 28, background: "rgba(93,226,255,0.12)", border: "1px solid rgba(93,226,255,0.32)", color: "#D6D8DE", fontSize: 32, fontWeight: 850 }}>
        DevShorts AI 自动生成
      </div>
    </div>
  );
};

const CaptionBar: React.FC<{ readonly scene: SceneManifest }> = ({ scene }) => {
  const caption = normalizeCaption(scene.caption)[0] || scene.text || scene.title;

  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        right: 70,
        bottom: 112,
        borderRadius: 22,
        background: "rgba(5,5,6,0.76)",
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
      {truncateText(caption, 42)}
    </div>
  );
};

const Scene: React.FC<{
  readonly scene: SceneManifest;
  readonly allScenes: readonly SceneManifest[];
  readonly sceneIndex: number;
  readonly sceneCount: number;
  readonly durationInFrames: number;
  readonly seriesTitle: string;
  readonly subtitle: string;
}> = ({ scene, allScenes, sceneIndex, sceneCount, durationInFrames, seriesTitle, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const accent = accents[sceneIndex % accents.length];
  const enter = spring({ frame: frame + 8, fps, config: { damping: 190, stiffness: 118 }, durationInFrames: 22 });
  const progress = interpolate(frame, [0, durationInFrames], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tone = sceneTone(scene, sceneIndex, sceneCount);
  const highlightCandidates = allScenes
    .filter((item, index) => index !== sceneIndex)
    .slice(0, 3)
    .map((item) => mainStatement(item, sceneTone(item, 1, sceneCount)));
  const highlights = [...highlightCandidates, ...bulletItems(scene, "intro")].slice(0, 3);

  return (
    <AbsoluteFill style={{ fontFamily, color: "white" }}>
      <Chrome seriesTitle={seriesTitle} sceneIndex={sceneIndex} sceneCount={sceneCount} progress={progress} />
      {tone === "intro" ? <IntroScene title={seriesTitle} subtitle={subtitle} highlights={highlights.length ? highlights : bulletItems(scene, "intro")} enter={enter} /> : null}
      {tone === "project" ? <ProjectScene scene={scene} enter={enter} accent={accent} /> : null}
      {tone === "problem" || tone === "solution" ? <InfoScene scene={scene} enter={enter} accent={accent} tone={tone} /> : null}
      {tone === "summary" ? <OutroScene scene={scene} enter={enter} /> : null}
      <div style={{ position: "absolute", left: 70, bottom: 172, color: accents[sceneIndex % accents.length], fontSize: 22, fontWeight: 950 }}>
        {toneLabel[tone]}
      </div>
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
              allScenes={manifest.scenes}
              sceneIndex={index}
              sceneCount={manifest.scenes.length}
              durationInFrames={timing.durationInFrames}
              seriesTitle={manifest.title ?? "DevShorts AI"}
              subtitle={manifest.subtitle ?? "AI Voice Video Studio"}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
