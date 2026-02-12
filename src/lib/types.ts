export interface Genre {
  id: string;
  label: string;
  labelEn: string;
  icon: string;
}

export type Mood = "bright" | "dark" | "energetic" | "calm" | "melancholic" | "dreamy";
export type Tempo = "slow" | "normal" | "fast" | "custom";
export type Language = "ja" | "en";
export type Duration = "30s" | "1min" | "2min" | "3min+";

export interface MusicConfig {
  genres: string[];
  mood: Mood;
  tempo: Tempo;
  bpm: number;
  themes: string[];
  customTheme: string;
  language: Language;
  duration: Duration;
}

export interface GeneratedPrompt {
  id: string;
  lyrics: string;
  styleTags: string;
  meta: {
    bpm: number;
    key: string;
    instruments: string;
  };
  config: MusicConfig;
  createdAt: number;
  isFavorite: boolean;
}

export const GENRES: Genre[] = [
  { id: "pop", label: "ポップ", labelEn: "Pop", icon: "Music" },
  { id: "rock", label: "ロック", labelEn: "Rock", icon: "Guitar" },
  { id: "jazz", label: "ジャズ", labelEn: "Jazz", icon: "Music2" },
  { id: "edm", label: "EDM", labelEn: "EDM", icon: "Disc3" },
  { id: "hiphop", label: "ヒップホップ", labelEn: "Hip Hop", icon: "Mic" },
  { id: "classical", label: "クラシック", labelEn: "Classical", icon: "Piano" },
  { id: "acoustic", label: "アコースティック", labelEn: "Acoustic", icon: "Guitar" },
  { id: "bossanova", label: "ボサノバ", labelEn: "Bossa Nova", icon: "Coffee" },
  { id: "rnb", label: "R&B", labelEn: "R&B", icon: "Heart" },
  { id: "reggae", label: "レゲエ", labelEn: "Reggae", icon: "Sun" },
  { id: "funk", label: "ファンク", labelEn: "Funk", icon: "Zap" },
  { id: "soul", label: "ソウル", labelEn: "Soul", icon: "Flame" },
  { id: "metal", label: "メタル", labelEn: "Metal", icon: "Skull" },
  { id: "punk", label: "パンク", labelEn: "Punk", icon: "AlertTriangle" },
  { id: "country", label: "カントリー", labelEn: "Country", icon: "TreePine" },
  { id: "folk", label: "フォーク", labelEn: "Folk", icon: "Leaf" },
  { id: "ambient", label: "アンビエント", labelEn: "Ambient", icon: "Cloud" },
  { id: "trap", label: "トラップ", labelEn: "Trap", icon: "Triangle" },
  { id: "dnb", label: "ドラムンベース", labelEn: "Drum & Bass", icon: "Drum" },
  { id: "citypop", label: "シティポップ", labelEn: "City Pop", icon: "Building2" },
  { id: "lofi", label: "Lo-Fi", labelEn: "Lo-Fi", icon: "Headphones" },
  { id: "synthwave", label: "シンセウェーブ", labelEn: "Synthwave", icon: "Waves" },
  { id: "gospel", label: "ゴスペル", labelEn: "Gospel", icon: "Church" },
  { id: "blues", label: "ブルース", labelEn: "Blues", icon: "CloudRain" },
];

export const MOODS: { id: Mood; label: string; labelEn: string; icon: string }[] = [
  { id: "bright", label: "明るい", labelEn: "Bright", icon: "Sun" },
  { id: "dark", label: "暗い", labelEn: "Dark", icon: "Moon" },
  { id: "energetic", label: "エネルギッシュ", labelEn: "Energetic", icon: "Zap" },
  { id: "calm", label: "穏やか", labelEn: "Calm", icon: "Feather" },
  { id: "melancholic", label: "メランコリック", labelEn: "Melancholic", icon: "CloudRain" },
  { id: "dreamy", label: "ドリーミー", labelEn: "Dreamy", icon: "Sparkles" },
];

export const THEMES = [
  { id: "love", label: "恋愛", labelEn: "Love" },
  { id: "adventure", label: "冒険", labelEn: "Adventure" },
  { id: "daily", label: "日常", labelEn: "Daily Life" },
  { id: "season", label: "季節", labelEn: "Seasons" },
  { id: "night", label: "夜", labelEn: "Night" },
  { id: "travel", label: "旅", labelEn: "Travel" },
  { id: "friendship", label: "友情", labelEn: "Friendship" },
  { id: "freedom", label: "自由", labelEn: "Freedom" },
  { id: "nostalgia", label: "ノスタルジア", labelEn: "Nostalgia" },
  { id: "future", label: "未来", labelEn: "Future" },
];

export const DEFAULT_CONFIG: MusicConfig = {
  genres: [],
  mood: "bright",
  tempo: "normal",
  bpm: 120,
  themes: [],
  customTheme: "",
  language: "ja",
  duration: "2min",
};
