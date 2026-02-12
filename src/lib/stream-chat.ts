const GENERATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-lyrics`;

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
) {
  const resp = await fetch(GENERATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(config),
  });

  if (resp.status === 429) {
    throw new Error("レート制限に達しました。しばらくしてから再試行してください。");
  }
  if (resp.status === 402) {
    throw new Error("クレジットが不足しています。");
  }
  if (!resp.ok || !resp.body) {
    throw new Error("生成に失敗しました。");
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let fullText = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        streamDone = true;
        break;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) {
          fullText += content;
          onDelta(content);
        }
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  // flush remaining
  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) {
          fullText += content;
          onDelta(content);
        }
      } catch { /* ignore */ }
    }
  }

  onDone();
  return fullText;
}

const TRANSLATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate-lyrics`;

export async function translateLyrics(lyrics: string, targetLang: "ja" | "en"): Promise<string> {
  const resp = await fetch(TRANSLATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ lyrics, targetLang }),
  });

  if (!resp.ok) throw new Error("翻訳に失敗しました。");
  const data = await resp.json();
  return data.translation;
}

const COVER_ART_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-cover-art`;

export async function generateCoverArt(lyrics: string, styleTags: string): Promise<string> {
  const resp = await fetch(COVER_ART_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ lyrics, styleTags }),
  });

  if (!resp.ok) {
    const errorBody = await resp.text().catch(() => "Unknown error");
    console.error("Cover Art Error:", resp.status, errorBody);
    throw new Error(`生成エラー (${resp.status}): ${errorBody.slice(0, 100)}`);
  }

  const data = await resp.json();
  return data.imageUrl;
}

export async function refineStyleTags(prompt: string): Promise<string> {
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  if (!GEMINI_API_KEY) throw new Error("VITE_GEMINI_API_KEY is not configured in .env");

  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `You are a Suno AI prompt expert. Convert the user's music description into a concise, effective comma-separated list of English style tags (max 120 characters total). Only output the tags themselves inside brackets, e.g. [upbeat pop, disco strings, energetic]. 

User Description: ${prompt}`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 100,
      }
    }),
  });

  if (!resp.ok) {
    const errorData = await resp.json();
    console.error("Gemini API error:", errorData);
    throw new Error("プロンプトの更新に失敗しました。APIキーの設定を確認してください。");
  }

  const data = await resp.json();
  const refinedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return refinedText.trim();
}
