import { LucideIcon, Video, Gamepad2, Mic, Briefcase, PartyPopper, Heart, GraduationCap, Palette, Tv, Radio } from "lucide-react";
import { MusicConfig, Mood, Tempo, Duration } from "./types";

export interface Step2Option {
    id: string;
    label: string;
    description?: string;
    defaultConfig: Partial<MusicConfig>;
    extraPrompt?: string; // Additional style info
}

export interface Step3Option {
    id: string;
    label: string;
    description?: string;
    defaultConfig: Partial<MusicConfig>;
    extraPrompt?: string;
}

export interface CreatorCategory {
    id: string;
    label: string;
    icon: string;
    step2Label: string;
    step2Options: Step2Option[];
    step3Label: string;
    step3Options: Step3Option[];
}

export const CREATOR_CATEGORIES: CreatorCategory[] = [
    {
        id: "video",
        label: "動画",
        icon: "Video",
        step2Label: "動画タイプ・ジャンルを選択",
        step2Options: [
            {
                id: "yt_long", label: "YouTube長尺動画",
                defaultConfig: { duration: "3min+", bpm: 110, mood: "bright" },
                extraPrompt: "Seamless background music, suitable for long-form viewing, non-distracting"
            },
            {
                id: "tiktok_shorts", label: "TikTok / YouTube Shorts",
                defaultConfig: { duration: "30s", bpm: 128, mood: "energetic" },
                extraPrompt: "High energy, instant impact, catchy hook, viral potential"
            },
            {
                id: "reels", label: "Instagram Reels",
                defaultConfig: { duration: "1min", bpm: 124, mood: "dreamy" },
                extraPrompt: "Stylish, lifestyle-focused, aesthetic vibe"
            },
            {
                id: "vlog", label: "Vlog（日常・旅行）",
                defaultConfig: { duration: "3min+", bpm: 105, mood: "bright" },
                extraPrompt: "Lightweight, acoustic elements, warm and friendly"
            },
            {
                id: "cooking", label: "料理・レシピ動画",
                defaultConfig: { duration: "2min", bpm: 100, mood: "bright" },
                extraPrompt: "Gentle rhythmic steps, kitchen atmosphere, cozy"
            }
        ],
        step3Label: "使用シーンを選択",
        step3Options: [
            { id: "opening", label: "オープニング", defaultConfig: { duration: "30s" }, extraPrompt: "Strong intro, energetic start" },
            { id: "bgm", label: "BGM全体", defaultConfig: { duration: "3min+", instrumental: true }, extraPrompt: "Steady volume, loopable feeling" },
            { id: "ending", label: "エンディング", defaultConfig: { duration: "1min" }, extraPrompt: "Memorable wrap-up, fade out" },
            { id: "transition", label: "トランジション", defaultConfig: { duration: "30s" }, extraPrompt: "Short burst, scene change vibe" }
        ]
    },
    {
        id: "game",
        label: "ゲーム",
        icon: "Gamepad2",
        step2Label: "ゲーム用途を選択",
        step2Options: [
            { id: "title", label: "タイトル画面", defaultConfig: { bpm: 90, mood: "dreamy" }, extraPrompt: "Grand orchestral, sense of anticipation" },
            { id: "field", label: "フィールド・探索", defaultConfig: { bpm: 110, mood: "calm", instrumental: true }, extraPrompt: "Adventurous, loopable, not tiring" },
            { id: "battle", label: "バトル・戦闘曲", defaultConfig: { bpm: 155, mood: "energetic" }, extraPrompt: "High tension, fast drums, adrenaline" },
            { id: "boss", label: "ボス戦BGM", defaultConfig: { bpm: 165, mood: "dark" }, extraPrompt: "Heavy, complex development, overwhelming presence" },
            { id: "town", label: "村・町・安全地帯", defaultConfig: { bpm: 85, mood: "calm" }, extraPrompt: "Peaceful, accordion or flute, relaxing" }
        ],
        step3Label: "演出の方向性",
        step3Options: [
            { id: "loop", label: "ループ再生重視", defaultConfig: {}, extraPrompt: "Perfect loop, seamless transition" },
            { id: "dramatic", label: "ドラマチック展開", defaultConfig: {}, extraPrompt: "Progressive build-up, emotional peaks" },
            { id: "retro", label: "レトロ・チップチューン風", defaultConfig: {}, extraPrompt: "8-bit style, chiptune textures" }
        ]
    },
    {
        id: "podcast",
        label: "音声",
        icon: "Mic",
        step2Label: "番組のジャンル・要素を選択",
        step2Options: [
            { id: "news", label: "ニュース・時事解説", defaultConfig: { bpm: 120, mood: "calm" }, extraPrompt: "Serious, professional, electronic pulses" },
            { id: "talk", label: "エンタメ・トーク", defaultConfig: { bpm: 115, mood: "bright" }, extraPrompt: "Playful, light jazz or pop, conversational" },
            { id: "business_p", label: "ビジネス・自己啓発", defaultConfig: { bpm: 110, mood: "energetic" }, extraPrompt: "Inspiring, confident, steady beat" },
            { id: "story", label: "ストーリーテリング", defaultConfig: { bpm: 95, mood: "dreamy" }, extraPrompt: "Immersive, atmospheric, cinematic" }
        ],
        step3Label: "使用シーン",
        step3Options: [
            { id: "p_opening", label: "オープニングジングル", defaultConfig: { duration: "30s" }, extraPrompt: "Hooky, branding sound" },
            { id: "p_bgm", label: "バックグラウンドBGM", defaultConfig: { duration: "3min+", instrumental: true }, extraPrompt: "Low profile, -18dB feel, non-intrusive" },
            { id: "p_ending", label: "エンディング", defaultConfig: { duration: "1min" }, extraPrompt: "Warm closure, call to action vibe" }
        ]
    },
    {
        id: "business",
        label: "仕事",
        icon: "Briefcase",
        step2Label: "ビジネス用途を選択",
        step2Options: [
            { id: "presen", label: "プレゼンテーション中", defaultConfig: { bpm: 100, mood: "calm" }, extraPrompt: "Focus enhancing, minimal, steady" },
            { id: "event_in", label: "イベント入場曲", defaultConfig: { bpm: 120, mood: "energetic" }, extraPrompt: "Success, bright, corporate professional" },
            { id: "holding", label: "電話保留音", defaultConfig: { bpm: 80, mood: "calm", instrumental: true }, extraPrompt: "Calming, pleasant, classic or bossa style" },
            { id: "cm_15", label: "15秒CM", defaultConfig: { duration: "30s", bpm: 135, mood: "energetic" }, extraPrompt: "High impact, immediate branding" }
        ],
        step3Label: "会社のイメージ",
        step3Options: [
            { id: "trust", label: "信頼感・伝統", defaultConfig: { mood: "calm" }, extraPrompt: "Orchestral, piano, stable" },
            { id: "tech", label: "先進的・テクノロジー", defaultConfig: { mood: "dreamy" }, extraPrompt: "Synth clean textures, digital pulse" },
            { id: "friendly", label: "親しみやすさ", defaultConfig: { mood: "bright" }, extraPrompt: "Acoustic, upbeat, warm" }
        ]
    },
    {
        id: "event",
        label: "行事",
        icon: "PartyPopper",
        step2Label: "イベントの種類を選択",
        step2Options: [
            { id: "wedding", label: "ウェディング", defaultConfig: { bpm: 75, mood: "dreamy" }, extraPrompt: "Romantic, grand, strings and piano" },
            { id: "ceremony", label: "卒業式・入学式", defaultConfig: { bpm: 85, mood: "calm" }, extraPrompt: "Solemn, emotional, growth and future" },
            { id: "party", label: "パーティー・二次会", defaultConfig: { bpm: 125, mood: "energetic" }, extraPrompt: "Uplifting, danceable, celebratory" },
            { id: "birthday", label: "誕生日・記念日", defaultConfig: { bpm: 110, mood: "bright" }, extraPrompt: "Joyful, happy, personal feel" }
        ],
        step3Label: "具体的なシーン",
        step3Options: [
            { id: "e_entry", label: "入場・開始", defaultConfig: { bpm: 90 }, extraPrompt: "Anticipation, grand intro" },
            { id: "e_climax", label: "ハイライト・感動", defaultConfig: { bpm: 70 }, extraPrompt: "Emotional peak, swelling strings" },
            { id: "e_cheer", label: "乾杯・盛り上がり", defaultConfig: { bpm: 128 }, extraPrompt: "Energetic, festive atmosphere" }
        ]
    },
    {
        id: "wellness",
        label: "健康",
        icon: "Heart",
        step2Label: "ウェルネス用途を選択",
        step2Options: [
            { id: "meditation", label: "瞑想・ヨガ", defaultConfig: { bpm: 60, mood: "calm", instrumental: true }, extraPrompt: "432Hz tuning, deep breathing guide style" },
            { id: "sleep", label: "睡眠・リラックス", defaultConfig: { bpm: 50, mood: "dreamy", instrumental: true }, extraPrompt: "Ambient drone, nature sounds, delta wave" },
            { id: "fitness", label: "フィットネス・HIIT", defaultConfig: { bpm: 145, mood: "energetic" }, extraPrompt: "Aggressive, driving bass, motivational" },
            { id: "focus", label: "集中・作業用", defaultConfig: { bpm: 90, mood: "calm", instrumental: true }, extraPrompt: "Lo-fi, minimal, repetitive but pleasant" }
        ],
        step3Label: "時間・強度",
        step3Options: [
            { id: "short_w", label: "短時間（導入/クールダウン）", defaultConfig: { duration: "1min" }, extraPrompt: "Transition from activity to rest" },
            { id: "long_w", label: "長時間ループ", defaultConfig: { duration: "3min+" }, extraPrompt: "Extended duration, continuous flow" }
        ]
    },
    {
        id: "education",
        label: "教育",
        icon: "GraduationCap",
        step2Label: "学習用途を選択",
        step2Options: [
            { id: "online", label: "オンライン授業", defaultConfig: { bpm: 105, mood: "calm", instrumental: true }, extraPrompt: "Background, non-intrusive, focus-assisting" },
            { id: "kids", label: "子供向け教材", defaultConfig: { bpm: 125, mood: "bright" }, extraPrompt: "Playful, simple melody, curious vibes" },
            { id: "language_l", label: "語学学習", defaultConfig: { bpm: 110, mood: "calm" }, extraPrompt: "Rhythmic memory aid, clear structure" }
        ],
        step3Label: "学習者の年齢層",
        step3Options: [
            { id: "child", label: "幼児・小学生", defaultConfig: { mood: "bright" }, extraPrompt: "Cute, bouncy" },
            { id: "adult", label: "成人・ビジネス", defaultConfig: { mood: "calm" }, extraPrompt: "Sophisticated, professional" }
        ]
    },
    {
        id: "art",
        label: "芸術",
        icon: "Palette",
        step2Label: "クリエイティブ用途を選択",
        step2Options: [
            { id: "gallery", label: "展示・ギャラリー", defaultConfig: { bpm: 80, mood: "dreamy", instrumental: true }, extraPrompt: "Atmospheric, spatial, complementary to visuals" },
            { id: "fashion", label: "ファッションショー", defaultConfig: { bpm: 124, mood: "energetic" }, extraPrompt: "Stylish, runway beat, avant-garde" },
            { id: "reading", label: "朗読・オーディオブック", defaultConfig: { bpm: 85, mood: "calm" }, extraPrompt: "Subtle, mood-enhancing for storytelling" }
        ],
        step3Label: "表現したい色・感情",
        step3Options: [
            { id: "colorful", label: "鮮やか・多様性", defaultConfig: { mood: "bright" }, extraPrompt: "Vibrant, varied textures" },
            { id: "minimal", label: "ミニマル・洗練", defaultConfig: { mood: "calm" }, extraPrompt: "Clean, sophisticated, spacious" }
        ]
    },
    {
        id: "performance",
        label: "芸術",
        icon: "Tv",
        step2Label: "パフォーマンス用途を選択",
        step2Options: [
            { id: "stage", label: "舞台・演劇", defaultConfig: { bpm: 110, mood: "dreamy" }, extraPrompt: "Dramatic, theatrical, narrative transitions" },
            { id: "street", label: "ストリートパフォーマンス", defaultConfig: { bpm: 135, mood: "energetic" }, extraPrompt: "Catchy, crowd-attracting, high energy" },
            { id: "comedy", label: "コメディ", defaultConfig: { bpm: 128, mood: "bright" }, extraPrompt: "Quick-witted, humorous timing, bouncy" }
        ],
        step3Label: "演出の役割",
        step3Options: [
            { id: "intro", label: "登場・つかみ", defaultConfig: { duration: "30s" }, extraPrompt: "Attention grabber, high impact" },
            { id: "bridge", label: "繋ぎ・転換", defaultConfig: { duration: "1min" }, extraPrompt: "Background flow while resetting" }
        ]
    },
    {
        id: "streaming",
        label: "配信",
        icon: "Radio",
        step2Label: "配信用途を選択",
        step2Options: [
            { id: "waiting", label: "待機画面・カウントダウン", defaultConfig: { duration: "2min", bpm: 120, mood: "bright" }, extraPrompt: "Steady build-up of anticipation" },
            { id: "talk_stream", label: "雑談配信BGM", defaultConfig: { duration: "3min+", bpm: 105, mood: "calm" }, extraPrompt: "Relaxed, does not interfere with voice" },
            { id: "gaming_stream", label: "ゲーム配信・実況", defaultConfig: { bpm: 130, mood: "energetic" }, extraPrompt: "Hype, gaming vibe, slightly intense" },
            { id: "ending_stream", label: "配信終了・エンディング", defaultConfig: { duration: "1min", bpm: 95, mood: "dreamy" }, extraPrompt: "Memorable wrap-up, gratitude feel" }
        ],
        step3Label: "放送の雰囲気",
        step3Options: [
            { id: "chill", label: "チル・ゆったり", defaultConfig: { mood: "calm" }, extraPrompt: "Low-fi, relaxed" },
            { id: "hype", label: "ハイパー・盛り上がり", defaultConfig: { mood: "energetic" }, extraPrompt: "High BPM, modern synth" }
        ]
    }
];
