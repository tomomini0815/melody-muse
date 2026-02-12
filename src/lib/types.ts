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
  customArtist: string;
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
  coverUrl?: string;
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
  {
    id: "taylor_swift",
    name: "Taylor Swift",
    label: "Taylor Swift",
    category: "global",
    style: "Vocal: Warm, conversational, clear articulation. Atmosphere: Narrative-driven storytelling, blend of acoustic guitar and polished synth-pop, emotional bridge build-ups."
  },
  {
    id: "ed_sheeran",
    name: "Ed Sheeran",
    label: "Ed Sheeran",
    category: "global",
    style: "Vocal: Smooth acoustic pop tone, occasional rap-sung flow. Atmosphere: Intimate loop-pedal vibe, organic textures, romantic and rhythmic, folk-pop fusion."
  },
  {
    id: "ariana_grande",
    name: "Ariana Grande",
    label: "Ariana Grande",
    category: "global",
    style: "Vocal: High-range soprano, breathy textures, whistle notes. Atmosphere: R&B-infused pop, lush harmonies, trap beats mixed with orchestral strings, glossy production."
  },
  {
    id: "bruno_mars",
    name: "Bruno Mars",
    label: "Bruno Mars",
    category: "global",
    style: "Vocal: Energetic, soulful, retro-tinged tenor. Atmosphere: Funk and soul revival, groovy basslines, tight brass sections, 80s/90s R&B nostalgia, danceable."
  },
  {
    id: "the_beatles",
    name: "The Beatles",
    label: "The Beatles",
    category: "global",
    style: "Vocal: Harmonious group vocals, melodic and distinct. Atmosphere: Classic rock innovation, experimental studio effects, jangling guitars, psychedelic transitions, timeless pop structures."
  },
  {
    id: "queen",
    name: "Queen",
    label: "Queen",
    category: "global",
    style: "Vocal: Operatic, powerful, theatrical range. Atmosphere: Grandiose arena rock, multi-layered vocal harmonies, intricate guitar solos, dramatic tempo changes, anthemic."
  },
  {
    id: "michael_jackson",
    name: "Michael Jackson",
    label: "Michael Jackson",
    category: "global",
    style: "Vocal: Rhythmic, percussive vocal delivery (hiccups, grunts), high tenor. Atmosphere: Polished dance-pop, funk grooves, sharp syncopation, driving bass, cinematic production."
  },
  {
    id: "bts",
    name: "BTS",
    label: "BTS",
    category: "global",
    style: "Vocal: Blend of smooth R&B vocals and sharp rap verses. Atmosphere: High-energy K-pop, polished electronic production, catchy hooks, genre-blending (hip-hop/pop/EDM), dynamic formations."
  },
  {
    id: "blackpink",
    name: "BLACKPINK",
    label: "BLACKPINK",
    category: "global",
    style: "Vocal: Sassy, confident, bilingual (Korean/English) delivery. Atmosphere: EDM-trap influence, heavy bass drops, bold girl-crush concept, 'Blackpink in your area' signature sound."
  },

  // Japanese
  {
    id: "yoasobi",
    name: "YOASOBI",
    label: "YOASOBI",
    category: "japanese",
    style: "Vocal: Ikura's crystal clear, bright, rapid-fire rhythmic singing. Atmosphere: Ayase's fast-paced piano rock/electronic fusion, vocaloid-inspired melodies, melancholic yet driving tempo, storytelling lyrics."
  },
  {
    id: "kenshi_yonezu",
    name: "Kenshi Yonezu",
    label: "米津玄師",
    category: "japanese",
    style: "Vocal: Distinctive, slightly rough masculine vocals with wide emotional range. Atmosphere: Genre-bending J-pop/Rock, complex dissonant chords, funk elements, profound and poetic lyrics, artistic and moody."
  },
  {
    id: "official_hige_dandism",
    name: "Official Hige Dandism",
    label: "Official髭男dism",
    category: "japanese",
    style: "Vocal: Fujihara's soulful, high-range vocals with strong falsetto. Atmosphere: Piano-driven pop rock, complex jazz/funk influenced arrangements, catchy and emotional choruses, bright and groovy."
  },
  {
    id: "ado",
    name: "Ado",
    label: "Ado",
    category: "japanese",
    style: "Vocal: Powerful, aggressive, changeable voice (growls to falsetto), theatrical interpretation. Atmosphere: Dark edgy rock, fast tempo, dramatic and emotional, rebellious energy, vocaloid-producer style influence."
  },
  {
    id: "utada_hikaru",
    name: "Utada Hikaru",
    label: "宇多田ヒカル",
    category: "japanese",
    style: "Vocal: Emotional, husky, R&B-influenced vocals with distinctive vibrato. Atmosphere: Sophisticated J-pop/R&B, electronic textures, introspective lyrics, groovy but melancholic, timeless sound."
  },
  {
    id: "gen_hoshino",
    name: "Gen Hoshino",
    label: "星野源",
    category: "japanese",
    style: "Vocal: Gentle, warm, conversational singing voice. Atmosphere: J-Pop mixed with Soul/Funk/Jazz, creating a 'Yellow Music' vibe. Marimba use, clapping backing tracks, joyful and everyday-life focused."
  },
  {
    id: "misia",
    name: "MISIA",
    label: "MISIA",
    category: "japanese",
    style: "Vocal: Incredible 5-octave range, powerful majestic belting, whistle register. Atmosphere: Grand R&B ballads, soul, gospel influences, emotional and overpowering, diva-style production."
  },
  {
    id: "x_japan",
    name: "X Japan",
    label: "X Japan",
    category: "japanese",
    style: "Vocal: Toshi's piercing high-pitched rock vocals. Atmosphere: Visual Kei pioneer, speed metal mixed with classical piano ballads, dramatic, symphonic, fast drums, twin guitar harmonies."
  },
  {
    id: "king_gnu",
    name: "King Gnu",
    label: "King Gnu",
    category: "japanese",
    style: "Vocal: Twin vocals (Iguchi's beautiful falsetto & Tsuneta's low rasp). Atmosphere: 'Tokyo New Mixture Style', blending rock, R&B, jazz, and classical. Gritty, chaotic yet sophisticated, urban vibe."
  },
  {
    id: "radwimps",
    name: "RADWIMPS",
    label: "RADWIMPS",
    category: "japanese",
    style: "Vocal: Noda's emotional, boys-like candid vocals. Atmosphere: Alternative rock, intricate guitar interplay, philosophical and romantic lyrics, dynamic range from quiet verses to explosive choruses, 'Shinkai' movie vibe."
  },
  {
    id: "fujii_kaze",
    name: "Fujii Kaze",
    label: "藤井風",
    category: "japanese",
    style: "Vocal: Smooth, soulful, R&B-influenced vocals with Okayama dialect. Atmosphere: Free-spirited, blend of R&B, Jazz, and deeply spiritual/philosophical Japanese Pop. Piano-driven, groovy yet relaxed."
  },
  {
    id: "mrs_green_apple",
    name: "Mrs. GREEN APPLE",
    label: "Mrs. GREEN APPLE",
    category: "japanese",
    style: "Vocal: Motoki's incredibly high, bright, and powerful range. Atmosphere: colorful, sparkling Pop-Rock, complex arrangements with EDM elements, catchy and uplifting melodies, youthful energy."
  },
  {
    id: "shiina_ringo",
    name: "Shiina Ringo",
    label: "椎名林檎",
    category: "japanese",
    style: "Vocal: Expressive, theatrical, sometimes distorted or whispered (Makizita). Atmosphere: Avant-garde Pop/Rock, heavy Jazz and Showa Kayo influences, complex chords, orchestral hits, edgy and sophisticated."
  },
  {
    id: "perfume",
    name: "Perfume",
    label: "Perfume",
    category: "japanese",
    style: "Vocal: Auto-tuned, unison female vocals, mechanic yet cute. Atmosphere: Futuristic Technopop (Nakata Yasutaka sound), heavy side-chain compression, electronic dance beats, geometric and polished."
  },
  {
    id: "tatsuro_yamashita",
    name: "Tatsuro Yamashita",
    label: "山下達郎",
    category: "japanese",
    style: "Vocal: Smooth multi-layered doo-wop harmonies, rich mid-range. Atmosphere: King of City Pop, summer vibe, sophisticated funk/soul arrangements, sparkling guitar cutting, 80s resort feeling."
  },
  {
    id: "vaundy",
    name: "Vaundy",
    label: "Vaundy",
    category: "japanese",
    style: "Vocal: Versatile, from lazy low-fi to powerful rock shouting. Atmosphere: Genre-blending genius (Rock, Hip-hop, R&B, EDM), catchy loops, modern Tokyo vibe, stylish and highly produced sound."
  },
  {
    id: "lisa",
    name: "LiSA",
    label: "LiSA",
    category: "japanese",
    style: "Vocal: Piercing, powerful rock heroine voice, emotional vibrato. Atmosphere: High-speed Anime song style, heavy rock instrumentation mixed with pop melodies, dramatic, hopeful and driving."
  },
  {
    id: "spitz",
    name: "Spitz",
    label: "スピッツ",
    category: "japanese",
    style: "Vocal: Masamune's clear, high, evergreen boyish voice. Atmosphere: Jangle-pop, arpeggio guitars, nostalgic melodies, pure and refreshing world view, timeless folk-rock essence."
  },
  {
    id: "sakanaction",
    name: "Sakanaction",
    label: "サカナクション",
    category: "japanese",
    style: "Vocal: Yamaguchi's folk-influenced literary vocals. Atmosphere: Fusion of Alternative Rock and Club Music/Techno. Four-on-the-floor beats, choir choruses, night-swimming vibe, artistic and danceable."
  },
  {
    id: "bump_of_chicken",
    name: "BUMP OF CHICKEN",
    label: "BUMP OF CHICKEN",
    category: "japanese",
    style: "Vocal: Fujiwara's storytelling, honest and slightly raspy voice. Atmosphere: Story-driven Guitar Rock, spacey/cosmic themes, emotional swells, anthem-like choruses, 'songs for the weak'."
  },
  {
    id: "zutomayo",
    name: "ZUTOMAYO",
    label: "ずっと真夜中でいいのに。",
    category: "japanese",
    style: "Vocal: ACA-ne's expressive high-tone vocals with sudden shifts to falsetto. Atmosphere: Highly complex arrangements, funky basslines, math-rock influence, dark yet catchy J-pop, frequent use of slap bass and sophisticated rhythmic play."
  },
  {
    id: "eve",
    name: "Eve",
    label: "Eve",
    category: "japanese",
    style: "Vocal: Melancholic, boyish, and emotive vocal style. Atmosphere: Fast-paced guitar rock with electronic nuances, dark fantasy themes, catchy melodies with a slight alternative edge, 'Utaite' culture influence."
  },
  {
    id: "one_ok_rock",
    name: "ONE OK ROCK",
    label: "ONE OK ROCK",
    category: "japanese",
    style: "Vocal: Taka's world-class, rasp-tinted powerful vocals and perfect English. Atmosphere: Energetic Arena Rock, blend of Emo and Post-Hardcore elements with polished Pop-Rock production, driving and anthemic."
  },
  {
    id: "milet",
    name: "milet",
    label: "milet",
    category: "japanese",
    style: "Vocal: Deep, husky, and gravelly low-to-mid range with elegant high notes. Atmosphere: Cinematic Pop, rich orchestral textures mixed with modern electronic production, sophisticated and ethereal vibe."
  },
  {
    id: "back_number",
    name: "back number",
    label: "back number",
    category: "japanese",
    style: "Vocal: Iyori Shimizu's candid, slightly nasal yet deeply emotional voice. Atmosphere: Heartfelt guitar-pop, sentimental and honest lyrics, beautifully crafted melodies, standard but high-quality J-pop structure."
  }
];

export const DEFAULT_CONFIG: MusicConfig = {
  genres: [],
  mood: "bright",
  tempo: "normal",
  bpm: 120,
  themes: [],
  customTheme: "",
  customArtist: "",
  language: "ja",
  duration: "2min",
  artist: "",
};
