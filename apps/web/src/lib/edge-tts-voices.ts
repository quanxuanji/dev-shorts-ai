export type EdgeVoiceCategory = "Recommended" | "Mandarin" | "Regional";

export type EdgeTtsVoice = {
  id: string;
  name: string;
  gender: "Female" | "Male";
  locale: string;
  category: EdgeVoiceCategory;
  tone: string;
  useCase: string;
};

export const edgeTtsVoices = [
  {
    id: "zh-CN-XiaoxiaoNeural",
    name: "Xiaoxiao",
    gender: "Female",
    locale: "Mandarin",
    category: "Recommended",
    tone: "Warm, clear, balanced",
    useCase: "Default narrator for polished short videos"
  },
  {
    id: "zh-CN-YunxiNeural",
    name: "Yunxi",
    gender: "Male",
    locale: "Mandarin",
    category: "Recommended",
    tone: "Young, energetic, natural",
    useCase: "Tech explainers and creator-style narration"
  },
  {
    id: "zh-CN-YunjianNeural",
    name: "Yunjian",
    gender: "Male",
    locale: "Mandarin",
    category: "Mandarin",
    tone: "Confident, firm, documentary",
    useCase: "Product launches and serious commentary"
  },
  {
    id: "zh-CN-XiaoyiNeural",
    name: "Xiaoyi",
    gender: "Female",
    locale: "Mandarin",
    category: "Mandarin",
    tone: "Bright, friendly, concise",
    useCase: "Tutorials and lightweight product demos"
  },
  {
    id: "zh-CN-YunyangNeural",
    name: "Yunyang",
    gender: "Male",
    locale: "Mandarin",
    category: "Mandarin",
    tone: "Broadcast, stable, formal",
    useCase: "News-style updates and structured lists"
  },
  {
    id: "zh-CN-liaoning-XiaobeiNeural",
    name: "Xiaobei",
    gender: "Female",
    locale: "Liaoning",
    category: "Regional",
    tone: "Regional, expressive, casual",
    useCase: "Localized content with a stronger personality"
  },
  {
    id: "zh-CN-shaanxi-XiaoniNeural",
    name: "Xiaoni",
    gender: "Female",
    locale: "Shaanxi",
    category: "Regional",
    tone: "Regional, distinct, memorable",
    useCase: "Social clips that need a recognizable accent"
  }
] as const satisfies readonly EdgeTtsVoice[];

export function getEdgeTtsVoice(id: string | null | undefined) {
  return edgeTtsVoices.find((voice) => voice.id === id) ?? null;
}

export function edgeTtsVoiceLabel(id: string | null | undefined) {
  const voice = getEdgeTtsVoice(id);
  return voice ? `${voice.name} · ${voice.gender} · ${voice.locale}` : id || "Custom voice";
}
