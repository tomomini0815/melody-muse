import { Language } from "./types";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_STREAM_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`;
const GEMINI_POST_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

export interface GenerateRequest {
  genres: string[];
  mood: string;
  tempo: string;
  bpm: number;
  themes: string[];
  customTheme: string;
  customArtist: string;
  language: string;
  duration: string;
  artist?: string;
}

export interface GenerateResponse {
  lyrics: string;
  styleTags: string;
  meta: {
    bpm: number;
    key: string;
    instruments: string;
  };
}

export async function generateLyrics(
  config: GenerateRequest,
  onDelta: (text: string) => void,
  onDone: () => void
): Promise<string> {
  const langMap: Record<string, string> = {
    "ja": "Japanese",
    "en": "English",
    "zh": "Chinese",
    "id": "Indonesian",
    "vi": "Vietnamese"
  };
  const targetLang = langMap[config.language] || "Japanese";

  const prompt = `You are a professional music producer and songwriter. Generate a song based on the following configuration:
Genres: ${config.genres.join(", ")}
Mood: ${config.mood}
Tempo: ${config.tempo} (BPM: ${config.bpm})
Themes: ${config.themes.join(", ")}
Custom Theme: ${config.customTheme}
Artist Style Reference: ${config.customArtist || config.artist || "None"}
Duration: ${config.duration}
Target Language: ${targetLang}

Output Format REQUIREMENT:
Your response MUST strictly follow this structure:
[Style Tags]
(Comma separated tags like: J-Pop, Energetic, Piano, 170BPM)

[Meta]
BPM: ${config.bpm}
Key: (e.g., C Major)
Instruments: (e.g., Piano, Electric Guitar, Drums)

[Lyrics]
(The actual song lyrics in ${targetLang})

Generate the song now:`;

  const resp = await fetch(GEMINI_STREAM_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    }),
  });

  if (!resp.ok || !resp.body) {
    const errorBody = await resp.text();
    console.error("Gemini API Error (Generate):", resp.status, errorBody);
    throw new Error(`AIの生成に失敗しました (${resp.status}): APIキーやモデル設定を確認してください。`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (content) {
            fullText += content;
            onDelta(content);
          }
        } catch (e) {
          // Ignore parse errors for partial chunks
        }
      }
    }
  }

  onDone();
  return fullText;
}

export async function translateLyrics(lyrics: string, targetLang: Language): Promise<string> {
  const langNames: Record<Language, string> = {
    "ja": "Japanese",
    "en": "English",
    "zh": "Chinese",
    "id": "Indonesian",
    "vi": "Vietnamese"
  };
  const targetName = langNames[targetLang];

  const prompt = `You are an expert translator. 
TASK: Translate the lyrics below into ${targetName}.

CONSTRAINTS:
- OUTPUT ONLY the translated lyrics in ${targetName}.
- DO NOT add any explanations, headers, or prefix like "Here is the translation".
- DO NOT fallback to English unless the target language IS English.
- Preserving the rhythm and structure of the original song is important.

ORIGINAL LYRICS TO TRANSLATE (into ${targetName}):
"""
${lyrics}
"""

TARGET LANGUAGE: ${targetName}
TRANSLATED LYRICS:`;

  const resp = await fetch(GEMINI_POST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3, // Lower temperature for more accurate translation
      }
    }),
  });

  if (!resp.ok) {
    const errorBody = await resp.text();
    console.error("Gemini API Error (Translate):", resp.status, errorBody);
    throw new Error(`翻訳に失敗しました: ${resp.status}`);
  }
  const data = await resp.json();
  const translation = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!translation) throw new Error("翻訳結果が空です。");
  return translation;
}

export async function generateCoverArt(lyrics: string, styleTags: string): Promise<string> {
  // 1. Use Gemini to generate a descriptive image prompt
  const geminiPrompt = `Create a short, highly descriptive, artistic image generation prompt (max 50 words) for an album cover.
Based on these lyrics and style tags, describe a visual scene without using any text/letters in the image.
Focus on composition, lighting, art style, and mood.

Lyrics: ${lyrics.substring(0, 300)}...
Style Tags: ${styleTags}

Output ONLY the descriptive prompt in English. No other text.`;

  const resp = await fetch(GEMINI_POST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: geminiPrompt }] }]
    }),
  });

  if (!resp.ok) throw new Error("画像プロンプトの生成に失敗しました。");
  const data = await resp.json();
  const visualPrompt = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!visualPrompt) throw new Error("画像プロンプトが空です。");

  // 2. Return Pollinations.ai URL (Direct Image API)
  const cleanPrompt = visualPrompt
    .replace(/^["'`\s]+|["'`\s]+$/g, "") // Remove surrounding quotes or whitespace
    .replace(/```[a-z]*\n?|```/g, "") // Remove markdown code blocks if any
    .trim();

  const encodedPrompt = encodeURIComponent(cleanPrompt);
  const seed = Math.floor(Math.random() * 1000000);
  // Using image.pollinations.ai for direct binary image response
  // Removed model=flux for better reliability during Cloudflare outages
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true`;
}

export async function refineStyleTags(prompt: string): Promise<string> {
  const geminiPrompt = `Refine the following music description into short, effective style tags for an AI music generator like Suno.
Output only the tags separated by commas. Do not include brackets or extra text.

Input Description: ${prompt}`;

  const resp = await fetch(GEMINI_POST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: geminiPrompt }] }]
    }),
  });

  if (!resp.ok) throw new Error("プロンプト精査に失敗しました。");
  const data = await resp.json();
  const refined = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!refined) throw new Error("精査結果が空です。");
  return refined;
}
