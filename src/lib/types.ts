export interface Genre {
  id: string;
  label: string;
  labelEn: string;
  icon: string;
}

export interface Artist {
  id: string;
  name: string;
  label: string; // Display name (e.g. "Taylor Swift")
  category: "global" | "japanese";
  style: string; // Description for the prompt
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
  language: Language;
  duration: Duration;
  artist?: string; // Artist ID
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

export const ARTISTS: Artist[] = [
  // Global
  { id: "taylor_swift", name: "Taylor Swift", label: "Taylor Swift", category: "global", style: "storytelling pop, country influence, catchy hooks, emotional, bridge-focused" },
  { id: "ed_sheeran", name: "Ed Sheeran", label: "Ed Sheeran", category: "global", style: "acoustic pop, folk-pop, loop pedal style, rap-sung vocals, romantic" },
  { id: "ariana_grande", name: "Ariana Grande", label: "Ariana Grande", category: "global", style: "pop, R&B, high vocal range, whistle notes, trap beats" },
  { id: "bruno_mars", name: "Bruno Mars", label: "Bruno Mars", category: "global", style: "funk, soul, retro pop, energetic, groovy basslines" },
  { id: "the_beatles", name: "The Beatles", label: "The Beatles", category: "global", style: "classic rock, pop rock, experimental, harmonious vocals" },
  { id: "queen", name: "Queen", label: "Queen", category: "global", style: "glam rock, operatic, theatrical, anthemic, heavy guitar solos" },
  { id: "michael_jackson", name: "Michael Jackson", label: "Michael Jackson", category: "global", style: "pop, funk, dance-pop, rhythmic breathing, strong beat" },
  { id: "bts", name: "BTS", label: "BTS", category: "global", style: "K-pop, hip-hop, polished production, rap verses and vocal chorus" },
  { id: "blackpink", name: "BLACKPINK", label: "BLACKPINK", category: "global", style: "K-pop, EDM trap, girl crush, bold, catchy drops" },
  
  // Japanese
  { id: "yoasobi", name: "YOASOBI", label: "YOASOBI", category: "japanese", style: "J-pop, storytelling, fast piano, vocaloid-style melody, Ikura vocals" },
  { id: "kenshi_yonezu", name: "Kenshi Yonezu", label: "米津玄師", category: "japanese", style: "J-pop, rock, experimental, unique chord progressions, poetic lyrics" },
  { id: "official_hige_dandism", name: "Official Hige Dandism", label: "Official髭男dism", category: "japanese", style: "piano pop-rock, soulful vocals, complex arrangements, catchy chorus" },
  { id: "ado", name: "Ado", label: "Ado", category: "japanese", style: "J-pop, rock, powerful vocals, aggressive and emotional, wide vocal range" },
  { id: "utada_hikaru", name: "Utada Hikaru", label: "宇多田ヒカル", category: "japanese", style: "R&B, J-pop, electronic, emotional, distinctive vibrato" },
  { id: "gen_hoshino", name: "Gen Hoshino", label: "星野源", category: "japanese", style: "pop, soul, funk, joy, everyday life themes" },
  { id: "misia", name: "MISIA", label: "MISIA", category: "japanese", style: "R&B, soul, powerful ballad, 5-octave vocal range" },
  { id: "x_japan", name: "X Japan", label: "X Japan", category: "japanese", style: "visual kei, heavy metal, speed metal, classical influence, piano ballads" },
  { id: "king_gnu", name: "King Gnu", label: "King Gnu", category: "japanese", style: "mixture rock, J-pop, experimental, dual vocals, groovy" },
  { id: "radwimps", name: "RADWIMPS", label: "RADWIMPS", category: "japanese", style: "rock, indie, emotional, philosophical lyrics, movie soundtrack style" },
];

export const DEFAULT_CONFIG: MusicConfig = {
  genres: [],
  mood: "bright",
  tempo: "normal",
  bpm: 120,
  themes: [],
  customTheme: "",
  language: "ja",
  language: "ja",
  duration: "2min",
  artist: "",
};
