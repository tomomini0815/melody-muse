/**
 * 歌詞パーサー: 歌詞テキストをセクション（Verse, Chorus, Bridge等）に分割
 */

export interface LyricsSection {
    type: "verse" | "chorus" | "bridge" | "intro" | "outro" | "hook" | "interlude" | "prechorus";
    label: string;
    lines: string[];
    startTime: number;  // 秒
    endTime: number;    // 秒
}

const SECTION_PATTERNS: [RegExp, LyricsSection["type"], string][] = [
    [/^\[?\s*(Intro|イントロ)\s*\]?$/i, "intro", "Intro"],
    [/^\[?\s*(Verse|ヴァース|バース|Aメロ)\s*\d*\s*\]?$/i, "verse", "Verse"],
    [/^\[?\s*(Pre[- ]?Chorus|Bメロ|プリコーラス)\s*\]?$/i, "prechorus", "Pre-Chorus"],
    [/^\[?\s*(Chorus|コーラス|サビ)\s*\d*\s*\]?$/i, "chorus", "Chorus"],
    [/^\[?\s*(Hook|フック)\s*\]?$/i, "hook", "Hook"],
    [/^\[?\s*(Bridge|ブリッジ|Cメロ)\s*\d*\s*\]?$/i, "bridge", "Bridge"],
    [/^\[?\s*(Interlude|間奏)\s*\]?$/i, "interlude", "Interlude"],
    [/^\[?\s*(Outro|アウトロ)\s*\]?$/i, "outro", "Outro"],
];

function detectSectionType(line: string): { type: LyricsSection["type"]; label: string } | null {
    const trimmed = line.trim();
    for (const [pattern, type, label] of SECTION_PATTERNS) {
        if (pattern.test(trimmed)) {
            return { type, label };
        }
    }
    return null;
}

/**
 * 歌詞テキストをセクションに分割。BPMからセクション時間を推定。
 */
export function parseLyrics(rawLyrics: string, bpm: number = 120, durationSec: number = 180): LyricsSection[] {
    const lines = rawLyrics.split("\n");
    const sections: LyricsSection[] = [];
    let currentSection: { type: LyricsSection["type"]; label: string; lines: string[] } | null = null;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            // Blank lines: if we have content → close section
            if (currentSection && currentSection.lines.length > 0) {
                sections.push({ ...currentSection, startTime: 0, endTime: 0 });
                currentSection = null;
            }
            continue;
        }

        const sectionId = detectSectionType(trimmed);
        if (sectionId) {
            // Close previous section
            if (currentSection && currentSection.lines.length > 0) {
                sections.push({ ...currentSection, startTime: 0, endTime: 0 });
            }
            currentSection = { type: sectionId.type, label: sectionId.label, lines: [] };
        } else {
            if (!currentSection) {
                currentSection = { type: "verse", label: "Verse", lines: [] };
            }
            currentSection.lines.push(trimmed);
        }
    }

    // Push last section
    if (currentSection && currentSection.lines.length > 0) {
        sections.push({ ...currentSection, startTime: 0, endTime: 0 });
    }

    // If no sections found, split into uniform blocks
    if (sections.length === 0) {
        const allLines = lines.filter(l => l.trim());
        const chunkSize = Math.max(2, Math.ceil(allLines.length / 4));
        const types: LyricsSection["type"][] = ["verse", "chorus", "verse", "chorus", "bridge", "chorus"];
        const labels = ["Verse 1", "Chorus", "Verse 2", "Chorus", "Bridge", "Chorus"];
        for (let i = 0; i < allLines.length; i += chunkSize) {
            const idx = Math.min(Math.floor(i / chunkSize), types.length - 1);
            sections.push({
                type: types[idx],
                label: labels[idx],
                lines: allLines.slice(i, i + chunkSize),
                startTime: 0,
                endTime: 0,
            });
        }
    }

    // Assign times proportionally
    const totalLines = sections.reduce((sum, s) => sum + s.lines.length, 0);
    let currentTime = 0;
    for (const section of sections) {
        const proportion = section.lines.length / totalLines;
        section.startTime = currentTime;
        section.endTime = currentTime + proportion * durationSec;
        currentTime = section.endTime;
    }

    return sections;
}

/**
 * ムードとジャンルからビジュアルテーマカラーを取得
 */
export interface VisualTheme {
    name: string;
    bgGradient: [string, string, string];   // CSS color stops
    particleColor: string;
    glowColor: string;
    textColor: string;
    textShadow: string;
    accentColor: string;
    particleStyle: "float" | "rain" | "burst" | "wave" | "spiral";
    bgPattern: "stars" | "waves" | "grid" | "circles" | "none";
}

const MOOD_THEMES: Record<string, VisualTheme> = {
    bright: {
        name: "Sunshine",
        bgGradient: ["#0f0c29", "#302b63", "#24243e"],
        particleColor: "#ffd700",
        glowColor: "rgba(255, 215, 0, 0.4)",
        textColor: "#ffffff",
        textShadow: "0 0 20px rgba(255,215,0,0.6)",
        accentColor: "#ffab00",
        particleStyle: "float",
        bgPattern: "stars",
    },
    dark: {
        name: "Midnight",
        bgGradient: ["#0a0a0a", "#1a0a2e", "#16213e"],
        particleColor: "#8b5cf6",
        glowColor: "rgba(139, 92, 246, 0.4)",
        textColor: "#e2e8f0",
        textShadow: "0 0 25px rgba(139,92,246,0.7)",
        accentColor: "#a855f7",
        particleStyle: "rain",
        bgPattern: "grid",
    },
    energetic: {
        name: "Neon Rush",
        bgGradient: ["#0f0f0f", "#1a0000", "#2d0036"],
        particleColor: "#ff3366",
        glowColor: "rgba(255, 51, 102, 0.5)",
        textColor: "#ffffff",
        textShadow: "0 0 30px rgba(255,51,102,0.8)",
        accentColor: "#ff6b9d",
        particleStyle: "burst",
        bgPattern: "none",
    },
    calm: {
        name: "Ocean Breeze",
        bgGradient: ["#0c1220", "#1a2a3a", "#0d2847"],
        particleColor: "#64b5f6",
        glowColor: "rgba(100, 181, 246, 0.3)",
        textColor: "#e0f7fa",
        textShadow: "0 0 15px rgba(100,181,246,0.5)",
        accentColor: "#4fc3f7",
        particleStyle: "wave",
        bgPattern: "waves",
    },
    melancholic: {
        name: "Requiem",
        bgGradient: ["#0a0a15", "#1a1a2e", "#0f0f2a"],
        particleColor: "#90a4ae",
        glowColor: "rgba(144, 164, 174, 0.3)",
        textColor: "#cfd8dc",
        textShadow: "0 0 20px rgba(144,164,174,0.4)",
        accentColor: "#78909c",
        particleStyle: "rain",
        bgPattern: "circles",
    },
    dreamy: {
        name: "Aurora",
        bgGradient: ["#0f0c29", "#1a0533", "#2d1b69"],
        particleColor: "#e040fb",
        glowColor: "rgba(224, 64, 251, 0.4)",
        textColor: "#f3e5f5",
        textShadow: "0 0 25px rgba(224,64,251,0.6)",
        accentColor: "#ce93d8",
        particleStyle: "spiral",
        bgPattern: "stars",
    },
};

export function getVisualTheme(mood: string): VisualTheme {
    return MOOD_THEMES[mood] || MOOD_THEMES.bright;
}
