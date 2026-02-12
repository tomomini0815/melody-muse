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

export async function generateCoverArt(lyrics: string, styleTags: string): Promise<string> {
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY?.trim();
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
    throw new Error(".envファイルの VITE_GEMINI_API_KEY を正しく設定してください。");
  }

  const visualPrompt = `Create a stunning, artistic music album cover art. Style: ${styleTags}. Mood inspired by these lyrics: ${lyrics.slice(0, 300)}. Make it visually striking, creative, and suitable as a square album cover. No text or words on the image.`;

  let errors: string[] = [];

  // ============ Phase 1: Gemini画像生成モデル (generateContent API) ============
  const geminiCandidates = [
    { v: "v1beta", m: "gemini-2.0-flash-exp-image-generation" },
    { v: "v1beta", m: "gemini-2.5-flash-image" },
  ];

  for (const { v, m } of geminiCandidates) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`[Phase1] Trying ${m} (${v}), attempt ${attempt + 1}`);
        const url = `https://generativelanguage.googleapis.com/${v}/models/${m}:generateContent?key=${GEMINI_API_KEY}`;

        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: visualPrompt }] }],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
            },
          }),
        });

        if (resp.status === 429) {
          const waitSec = (attempt + 1) * 10;
          console.warn(`${m}: レートリミット。${waitSec}秒後にリトライ...`);
          await new Promise(r => setTimeout(r, waitSec * 1000));
          continue;
        }

        if (!resp.ok) {
          const errorData = await resp.json().catch(() => ({}));
          const msg = errorData.error?.message || `HTTP ${resp.status}`;
          errors.push(`${m}(${v}): ${msg}`);
          console.warn(`${m} failed: ${msg}`);
          break;
        }

        const data = await resp.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData?.data && part.inlineData?.mimeType) {
            console.log("✅ Image generated successfully via Gemini!");
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          }
        }
        errors.push(`${m}(${v}): 画像データなし`);
        break;
      } catch (e) {
        errors.push(`${m}(${v}): ネットワークエラー`);
        break;
      }
    }
  }

  // ============ Phase 2: Imagen 4.0 (predict API) ============
  const imagenCandidates = [
    "imagen-4.0-fast-generate-001",
    "imagen-4.0-generate-001",
  ];

  for (const model of imagenCandidates) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`[Phase2] Trying ${model}, attempt ${attempt + 1}`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${GEMINI_API_KEY}`;

        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{ prompt: visualPrompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio: "1:1",
            },
          }),
        });

        if (resp.status === 429) {
          const waitSec = (attempt + 1) * 10;
          console.warn(`${model}: レートリミット。${waitSec}秒後にリトライ...`);
          await new Promise(r => setTimeout(r, waitSec * 1000));
          continue;
        }

        if (!resp.ok) {
          const errorData = await resp.json().catch(() => ({}));
          const msg = errorData.error?.message || `HTTP ${resp.status}`;
          errors.push(`${model}: ${msg}`);
          console.warn(`${model} failed: ${msg}`);
          break;
        }

        const data = await resp.json();
        // Imagen returns predictions[].bytesBase64Encoded
        const predictions = data.predictions || [];
        for (const pred of predictions) {
          if (pred.bytesBase64Encoded) {
            console.log("✅ Image generated successfully via Imagen!");
            return `data:image/png;base64,${pred.bytesBase64Encoded}`;
          }
        }
        errors.push(`${model}: 画像データなし`);
        break;
      } catch (e) {
        errors.push(`${model}: ネットワークエラー`);
        break;
      }
    }
  }

  const allErrors = errors.join("\n");
  throw new Error(`画像生成に失敗しました。\n\n${allErrors}\n\n※レートリミットの場合は1〜2分ほど待ってから再試行してください。`);
}

export async function refineStyleTags(prompt: string): Promise<string> {
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY?.trim();
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
    throw new Error(".envファイルの VITE_GEMINI_API_KEY を正しく設定してください。");
  }

  // デバッグ用: キーの情報を少し表示
  console.log(`Using API Key (suffix): ...${GEMINI_API_KEY.slice(-4)}, Length: ${GEMINI_API_KEY.length}`);

  // 診断結果に基づき、より広範囲なモデル候補を設定
  // 特にユーザーの環境で見つかった 2.0 や 2.5 系列も追加
  const candidates = [
    { v: "v1beta", m: "gemini-2.0-flash" },
    { v: "v1beta", m: "gemini-1.5-flash" },
    { v: "v1", m: "gemini-1.5-flash" },
    { v: "v1beta", m: "gemini-2.0-flash-exp" },
    { v: "v1beta", m: "gemini-flash-latest" },
    { v: "v1beta", m: "gemini-pro-latest" },
    { v: "v1beta", m: "gemini-1.5-pro" },
    { v: "v1", m: "gemini-1.5-pro" },
    { v: "v1", m: "gemini-pro" }, // legacy
    { v: "v1", m: "gemini-2.0-flash" },
    { v: "v1", m: "gemini-2.5-flash" },
  ];

  let errors: string[] = [];

  for (const { v, m } of candidates) {
    try {
      const url = `https://generativelanguage.googleapis.com/${v}/models/${m}:generateContent?key=${GEMINI_API_KEY}`;
      console.log(`Trying Gemini model: ${m} (${v})`);

      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `You are a Suno AI prompt expert. Convert the user's music description into a concise, effective comma-separated list of English style tags (max 120 characters total). Only output the tags themselves inside brackets, e.g. [upbeat pop, disco strings, energetic]. \n\nUser Description: ${prompt}` }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 100 }
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const refinedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (refinedText) return refinedText.trim();
      } else {
        const errorData = await resp.json().catch(() => ({}));
        const msg = errorData.error?.message || `HTTP ${resp.status}`;
        errors.push(`${m}(${v}): ${msg}`);
        console.warn(`${m} failed: ${msg}`);
      }
    } catch (e) {
      errors.push(`${m}(${v}): Network error or CORS issue`);
    }
  }

  const allErrors = errors.join("\n");
  throw new Error(`全モデルで試行しましたが失敗しました。\n\n詳細リスト:\n${allErrors}\n\n※Google AI Studioで新しいAPIキーを作成し直すか、利用規約への同意が完了しているか確認してください。\n※.envファイルを書き換えた後は、一度ターミナルを終了して npm run dev をやり直してください。`);
}
