import { Language, LANGUAGES, ViralAnalysis, GeneratedPrompt } from "./types";
import { CREATOR_CATEGORIES } from "./creator-templates";

/**
 * Helper to fetch with exponential backoff for 429 errors
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 10,
  onRetry?: (attempt: number, waitTime: number, status: number) => void
): Promise<Response> {
  let retries = 0;
  while (true) {
    const resp = await fetch(url, options);

    const retryCodes = [429, 503];
    if (retryCodes.includes(resp.status) && retries < maxRetries) {
      const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
      // レート制限時は長めに待つ (8s -> 12s -> 24s ...)
      const baseWait = isTest ? 10 : 8000;
      let waitTime = Math.pow(1.5, retries) * baseWait + Math.random() * (isTest ? 5 : 2000);

      // 可能であればAPIレスポンスから推奨待機時間(retryDelay)を取得
      try {
        const body = await resp.clone().json();

        // --- 致命的なエラーの検知 (Daily Quota) ---
        const msg = body?.error?.message || "";
        if (msg.includes("GenerateRequestsPerDay") || msg.includes("limit: 0")) {
          console.warn(`Gemini API: Daily quota or absolute limit reached. Skipping retry wait.`);
          return resp; // 即座にリターンしてフォールバックへ
        }

        const details = body?.error?.details || [];
        const retryInfo = details.find((d: any) => d["@type"]?.includes("RetryInfo"));
        if (retryInfo?.retryDelay) {
          const seconds = parseFloat(retryInfo.retryDelay);
          if (!isNaN(seconds)) {
            if (seconds > 20) {
              // 待機時間が長すぎる場合はUIがフリーズするのを防ぐため、待たずに次のキー・モデルへフォールバックさせる
              console.warn(`Gemini API suggested wait is too long (${seconds}s). Skipping wait to try fallbacks.`);
              return resp;
            }
            waitTime = (seconds * 1000) + (isTest ? 0 : 1000); // 余裕を持って1秒追加
            console.log(`Gemini API suggested wait: ${seconds}s`);
          }
        }
      } catch (e) {
        // JSONでない場合やRetryInfoがない場合は無視してバックオフ計算値を使用
      }

      const displayWait = Math.round(waitTime / 1000);
      console.warn(`Gemini API ${resp.status} detected. Retrying in ${displayWait}s... (Attempt ${retries + 1}/${maxRetries})`);

      onRetry?.(retries + 1, waitTime, resp.status);

      await new Promise(resolve => setTimeout(resolve, waitTime));
      retries++;
      continue;
    }

    return resp;
  }
}

// 1日の上限がより広い（通常1500回/日）安定版モデルを優先
export const GEMINI_MODELS = [
  "gemini-2.5-flash",       // 正常稼働が確認できた最新モデル
];

// 複数のAPIキーを読み込み (キーローテーション用)
// ※ Viteの import.meta.env[key] は動的参照ができないため、静的に記述
export const GEMINI_API_KEYS = (() => {
  const keys: string[] = [];

  const k0 = import.meta.env.VITE_GEMINI_API_KEY;
  if (k0) keys.push(k0);

  const k1 = import.meta.env.VITE_GEMINI_API_KEY_1;
  if (k1 && !keys.includes(k1)) keys.push(k1);

  const k2 = import.meta.env.VITE_GEMINI_API_KEY_2;
  if (k2 && !keys.includes(k2)) keys.push(k2);

  const k3 = import.meta.env.VITE_GEMINI_API_KEY_3;
  if (k3 && !keys.includes(k3)) keys.push(k3);

  return keys.length > 0 ? keys : [""]; // 最低1つは確保
})();

// RESOURCE_EXHAUSTED (1日の上限到達) を起こした (キー索引, モデル) の組み合わせを記録
const exhaustedCombinations = new Set<string>();

function getGeminiConfig(modelIndex = 0, keyIndex = 0) {
  const key = GEMINI_API_KEYS[keyIndex % GEMINI_API_KEYS.length];
  const model = GEMINI_MODELS[Math.min(modelIndex, GEMINI_MODELS.length - 1)];

  return {
    key,
    keyIndex: keyIndex % GEMINI_API_KEYS.length,
    model,
    streamUrl: `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${key}&alt=sse`,
    postUrl: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
  };
}

/**
 * Handle Gemini API errors and throw user-friendly messages
 */
async function handleApiError(resp: Response, context: string): Promise<never> {
  const errorBody = await resp.text();
  console.error(`Gemini API Error (${context}):`, resp.status, errorBody);

  if (resp.status === 429) {
    throw new Error("APIの利用制限（レートリミット）に達しました。1分間にリクエストが集中しすぎたか、1日の上限を超えた可能性があります。少し時間を置いてから再度お試しください。");
  }

  if (resp.status === 403 || resp.status === 401) {
    throw new Error("APIキーが無効、または権限がありません。設定を確認してください。");
  }

  if (resp.status === 503) {
    throw new Error("サーバーが現在非常に混み合っています。リトライを数回試みましたが、依然として不安定です。しばらく待ってから再度お試しいただくか、プロンプトを少し短くしてみてください。");
  }

  throw new Error(`${context}に失敗しました (${resp.status})。しばらくしてから再度お試しください。`);
}

/**
 * 非ストリーミング用：複数モデルを順次試行して成功したレスポンスを返す
 */
async function geminiPostWithFallback(
  body: object,
  context: string,
  configOverride?: Partial<{ temperature: number }>,
  onRetry?: (msg: string) => void
): Promise<Response> {
  let lastResp: Response | null = null;
  let lastModel = "";

  // 全てのキーと全てのモデルの組み合わせを試行
  for (let k = 0; k < GEMINI_API_KEYS.length; k++) {
    for (let i = 0; i < GEMINI_MODELS.length; i++) {
      const config = getGeminiConfig(i, k);
      const comboKey = `${config.keyIndex}-${config.model}`;

      // すでにこのセッションで RESOURCE_EXHAUSTED になった組み合わせはスキップ
      if (exhaustedCombinations.has(comboKey)) {
        console.log(`Skipping exhausted combo: ${comboKey}`);
        continue;
      }

      lastModel = config.model;

      lastResp = await fetchWithRetry(
        config.postUrl,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...body,
            ...(configOverride ? { generationConfig: configOverride } : {})
          }),
        },
        1, // キーローテーション時はリトライを少なめに（1回だけ）
        (attempt, wait) => {
          onRetry?.(`キー#${config.keyIndex + 1} / モデル ${config.model} 制限。${Math.round(wait / 1000)}秒後に再試行中`);
        }
      );

      if (lastResp.ok) {
        console.log(`${context}: success with key#${config.keyIndex + 1} and ${config.model}`);
        return lastResp;
      }

      const errorBody = await lastResp.clone().text();
      // "GenerateRequestsPerDay" または "limit: 0" を含む場合はデイリークォータとみなし、そのセッションで完全にスキップ
      if (lastResp.status === 429 && (errorBody.includes("GenerateRequestsPerDay") || errorBody.includes("limit: 0"))) {
        console.warn(`${context}: Daily quota exhausted for key#${config.keyIndex + 1} and ${config.model}. Marking for skip.`);
        exhaustedCombinations.add(comboKey);
      }

      console.warn(`${context}: combo ${comboKey} failed (${lastResp.status}). Trying next...`);
    }
  }

  // 全ての組み合わせで失敗した場合
  if (!lastResp) {
    // 全てのキー/モデルが exhaustedCombinations に入っていてスキップされた場合
    // セッション中のキャッシュをクリアして再試行可能にする
    exhaustedCombinations.clear();
    throw new Error("すべてのAPIキー/モデルの組み合わせが制限に達しています。ページを再読み込みしてから再度お試しください。");
  }
  await handleApiError(lastResp, `${context} (${lastModel})`);
}

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
  creatorCategory?: string;
  creatorSubCategory?: string;
  creatorScene?: string;
  instrumental: boolean;
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
Instrumental Mode: ${config.instrumental ? "ON (BGM / No Vocals)" : "OFF (Vocal Song)"}

${(config.customArtist || config.artist) ? `### IMPORTANT ANTI-COPYRIGHT INSTRUCTION (Artist Style):
The user has provided an "Artist Style Reference". 
NEVER output the real name of the artist in the [Style & Meta] tags or anywhere else.
Instead, DECOMPOSE the artist's style into detailed musical characteristics, vocal qualities, and emotional tones.
For example, instead of "Taylor Swift", use "bright female vocal, storytelling pop, acoustic guitar pop, emotional".
Instead of "Michael Jackson", use "rhythmic male vocal, tight pop funk, high ad-libs, dance pop".
Translate the artist's essence into 3-5 descriptive English style tags.
###
` : ""}

${(() => {
      const cat = CREATOR_CATEGORIES.find(c => c.id === config.creatorCategory);
      if (!cat) return "";

      const sub = cat.step2Options.find(o => o.id === config.creatorSubCategory);
      const scene = cat.step3Options.find(o => o.id === config.creatorScene);

      const creatorContext = [
        `Creator Category: ${cat.label}`,
        sub ? `Specific Use: ${sub.label}` : "",
        scene ? `Scene Context: ${scene.label}` : "",
        sub?.extraPrompt ? `Additional Style Requirement: ${sub.extraPrompt}` : "",
        scene?.extraPrompt ? `Scene Requirement: ${scene.extraPrompt}` : ""
      ].filter(Boolean).join("\n");

      return `### SPECIAL CREATOR CONTEXT:\n${creatorContext}\n###`;
    })()}

${config.instrumental ? `### BGM COMPOSITION GUIDELINES (CRITICAL):
Since this is an INSTRUMENTAL BGM, you MUST provide detailed musical structure guidance in the Style Tags.
Think like a professional film/game composer creating a polished background music track.

STRUCTURE REQUIREMENTS:
- Define clear musical sections: [Intro] → [Main Theme A] → [Development B] → [Variation/Bridge] → [Climax] → [Outro/Loop Point]
- Each section should have a PURPOSE: Intro sets mood, Main Theme establishes melody, Development builds tension, Climax delivers emotional peak
- Include DYNAMIC MARKINGS in style tags: "builds gradually", "crescendo at bridge", "soft piano intro", "full orchestral climax"
- Ensure LOOP COMPATIBILITY: The outro should transition smoothly back to the intro for seamless looping

ARRANGEMENT REQUIREMENTS:
- Specify LAYERED instrumentation: Lead melody instrument, harmonic backing (pads/strings), rhythmic foundation (drums/percussion), bass line, atmospheric textures
- Include production descriptors: "professional studio mix", "warm analog tone", "spacious reverb", "balanced EQ"
- Describe the SONIC PALETTE: e.g., "warm piano melody over lush string pads with gentle acoustic guitar arpeggios and soft brushed drums"
- Add texture words: "ethereal", "lush", "crisp", "warm", "ambient", "driving", "pulsating"

QUALITY TAGS TO ALWAYS INCLUDE:
- "Instrumental", "No Vocals", "BGM", "Professional Mix", "High Fidelity"
- Duration-appropriate tags: "Loopable" for 3min+, "Jingle" for short pieces
- Mood-reinforcing production tags: "Cinematic Production" for epic, "Lo-fi Production" for chill, "Studio Quality" for professional
###
` : ""}
Output Format REQUIREMENT:
Your response MUST strictly follow this structure:
[Style & Meta]
(Consolidated tags for copy-pasting. Format: Style Tags, BPM, Key, Instruments. e.g., J-Pop, Energetic, Piano, 170BPM, C Major, Drums. ${config.instrumental ? "MANDATORY: Include 'Instrumental', 'No Vocals', 'BGM', 'Professional Mix', 'High Fidelity' in the tags. Also include arrangement descriptors like 'Warm Piano Lead', 'Lush String Pads', 'Loopable Structure'." : ""})

[Meta]
BPM: ${config.bpm}
Key: (e.g., C Major)
Instruments: (e.g., Piano, Electric Guitar, Drums)

[Viral Analysis]
Score: (0-100 based on Suno/Udio/Mureka success patterns)
Breakdown: Melody:XX, Empathy:XX, Trend:XX
Market: (Current trend analysis, e.g., J-Pop is trending +15% this week on Mureka/Suno)
Suggestions: (3 specific bullet points to improve the score, aligned with the genre. Focus on practical improvements like "Add a catchy hook" or "Enhance vocal texture". AVOID niche styles like "Operatic" unless appropriate.)

[Lyrics]
${config.instrumental ? `Output a STRUCTURED INSTRUMENTAL ARRANGEMENT, not just "[Instrumental]". Use this format:
[Intro]
[Instrumental - describe the opening: which instruments, dynamics, mood. e.g., "Soft piano arpeggios with ambient pad, pp, establishing gentle atmosphere"]

[Main Theme]
[Instrumental - describe the main melody: lead instrument, harmonic backing, rhythm. e.g., "Warm acoustic guitar melody over lush string ensemble, mf, with brushed snare keeping gentle 4/4 time"]

[Development]
[Instrumental - describe how the arrangement builds: added layers, rising energy. e.g., "Full band enters - electric piano joins with synth bass, building toward climax, f"]

[Climax/Bridge]
[Instrumental - describe the emotional peak: full arrangement, maximum intensity. e.g., "Full orchestral swell with soaring violin melody, cymbal crashes, ff, triumphant and uplifting"]

[Outro]
[Instrumental - describe the resolution: fading instruments, return to calm. e.g., "Gradual fadeout returning to solo piano motif from intro, pp, seamless loop point"]` : `(The actual song lyrics in ${targetLang}. Use high-impact words and emotional structures found in viral hits.)`}

Generate the song and analysis now:`;

  let resp: Response | null = null;
  let lastErrorModel = "";

  // 全てのキーと全てのモデルの組み合わせを試行
  console.log(`Starting generation loop. Available API Keys: ${GEMINI_API_KEYS.length}, Models: ${GEMINI_MODELS.length}`);

  for (let k = 0; k < GEMINI_API_KEYS.length; k++) {
    for (let i = 0; i < GEMINI_MODELS.length; i++) {
      const currentConfig = getGeminiConfig(i, k);
      const comboKey = `${currentConfig.keyIndex}-${currentConfig.model}`;

      if (exhaustedCombinations.has(comboKey)) {
        continue;
      }

      if (!currentConfig.key) {
        console.warn(`API key not set for index ${k}. Skipping.`);
        continue;
      }

      try {
        resp = await fetchWithRetry(
          currentConfig.streamUrl,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 4096,
              }
            }),
          },
          1, // キーローテーション時はリトライを少なめに
          (attempt, wait) => {
            const waitSec = Math.round(wait / 1000);
            onDelta(`\n[キー#${currentConfig.keyIndex + 1} / モデル ${currentConfig.model} 制限。${waitSec}秒後に再試行中]\n`);
          }
        );

        if (resp.ok) {
          console.log(`Generation started successfully using key#${currentConfig.keyIndex + 1} and ${currentConfig.model}`);
          break;
        } else {
          const errorBody = await resp.clone().text();
          if (resp.status === 429 && (errorBody.includes("GenerateRequestsPerDay") || errorBody.includes("limit: 0"))) {
            console.warn(`Daily quota exhausted for key#${currentConfig.keyIndex + 1} and ${currentConfig.model}. Marking for skip.`);
            exhaustedCombinations.add(comboKey);
          }
          console.warn(`Combo ${comboKey} failed with status ${resp.status}. Trying next...`);
          lastErrorModel = currentConfig.model;
        }
      } catch (err) {
        console.error(`Attempt with combo ${comboKey} threw error:`, err);
        lastErrorModel = currentConfig.model;
      }
    }
    if (resp && resp.ok) break;
  }

  if (!resp || !resp.ok || !resp.body) {
    if (!resp) {
      exhaustedCombinations.clear();
      throw new Error("すべてのAPIキー/モデルの組み合わせが制限に達しています。ページを再読み込みしてから再度お試しください。");
    }
    await handleApiError(resp, `歌詞の生成 (${lastErrorModel || "全モデル失敗"})`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let lineBuffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    lineBuffer += chunk;
    const lines = lineBuffer.split("\n");
    lineBuffer = lines.pop() || "";

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith("data: ")) {
        try {
          const data = JSON.parse(trimmedLine.slice(6));
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
  const targetLangConfig = LANGUAGES.find(l => l.id === targetLang);
  const targetName = targetLangConfig?.labelEn || "English";

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

  const resp = await geminiPostWithFallback(
    { contents: [{ parts: [{ text: prompt }] }] },
    "翻訳",
    { temperature: 0.3 }
  );
  const data = await resp.json();
  const translation = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!translation) throw new Error("翻訳結果が空です。");
  return translation;
}

/**
 * Vercel Serverless Function経由でAI Hordeの画像を生成する（CORS回避）
 * Phase 1: /api/generate-image にPOSTしてジョブIDを取得（瞬時）
 * Phase 2: /api/check-image?id=jobId をポーリングして完了を待つ（各リクエスト瞬時）
 */
async function generateImageViaHorde(
  prompt: string,
  width = 1024,
  height = 1024,
  onStatus?: (msg: string) => void
): Promise<string> {
  onStatus?.("画像生成リクエストを送信中...");

  // Phase 1: Submit the job
  const submitResp = await fetch("/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: prompt.substring(0, 1000),
      width: Math.min(width, 1024),
      height: Math.min(height, 1024),
    }),
  });

  if (!submitResp.ok) {
    const errData = await submitResp.json().catch(() => ({ error: `HTTP ${submitResp.status}` }));
    throw new Error(`画像生成に失敗しました: ${errData.error || submitResp.statusText}`);
  }

  const submitData = await submitResp.json();
  if (!submitData.jobId) throw new Error("ジョブIDを取得できませんでした。");

  // Phase 2: Poll for completion
  const maxPolls = 60;
  const pollInterval = 2000;

  for (let i = 0; i < maxPolls; i++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    const checkResp = await fetch(`/api/check-image?id=${submitData.jobId}`);
    const checkData = await checkResp.json();

    if (checkData.faulted) {
      throw new Error("画像生成に失敗しました。再度お試しください。");
    }

    if (checkData.done && checkData.imageUrl) {
      return checkData.imageUrl;
    }

    if (checkData.error) {
      throw new Error(`画像生成エラー: ${checkData.error}`);
    }

    const queuePos = checkData.queue_position ?? "?";
    const waitTime = checkData.wait_time ?? "?";
    onStatus?.(`画像を生成中... (キュー: ${queuePos}, 推定${waitTime}秒)`);
  }

  throw new Error("画像生成がタイムアウトしました。サーバーが混雑している可能性があります。");
}

export async function generateCoverArt(lyrics: string, styleTags: string): Promise<string> {
  // 1. Use Gemini to generate a descriptive image prompt
  const geminiPrompt = `Create a short, highly descriptive, artistic image generation prompt (max 50 words) for an album cover.
Based on these lyrics and style tags, describe a visual scene without using any text/letters in the image.
Focus on composition, lighting, art style, and mood.

Lyrics: ${lyrics.substring(0, 300)}...
Style Tags: ${styleTags}

Output ONLY the descriptive prompt in English. No other text.`;

  const resp = await geminiPostWithFallback(
    { contents: [{ parts: [{ text: geminiPrompt }] }] },
    "画像プロンプトの生成"
  );
  const data = await resp.json();
  const visualPrompt = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!visualPrompt) throw new Error("画像プロンプトが空です。");

  // 2. Clean up the prompt
  const cleanPrompt = visualPrompt
    .replace(/^["'`\s]+|["'`\s]+$/g, "")
    .replace(/```[a-z]*\n?|```/g, "")
    .trim();

  // 3. Generate image via AI Horde (512x512 for anonymous user limits)
  return await generateImageViaHorde(
    `${cleanPrompt}, album cover art, professional, high quality, no text, no watermark`,
    512,
    512
  );
}

/**
 * アートスタイル別のプロンプト補強マッピング
 */
const ART_STYLE_PROMPTS: Record<string, string> = {
  "cinematic": "masterpiece, ultra-realistic cinematic film still, 35mm anamorphic lens, highly detailed human features, expressive characters, breathtaking natural scenery, dramatic volumetric lighting, 8k resolution, photorealistic textures",
  "anime": "premium anime art style, detailed character design, Studio Ghibli inspired landscapes, vibrant cel shading, expressive anime eyes, atmospheric lighting, high-quality anime background, Makoto Shinkai aesthetic",
  "cyberpunk": "cyberpunk aesthetic, high-tech low-life, neon-drenched streets, realistic human cyborgs, bustling futuristic cityscape, rain-slicked surfaces, volumetric fog, teal and orange color grading",
  "3d-render": "hyper-realistic 3D render, Unreal Engine 5 style, complex cinematic character lighting, detailed environments, Ray Traced shadows, Octane Render, Subsurface Scattering on skin",
  "oil-painting": "fine art oil painting, realistic figure painting, detailed portrait, visible impasto brushstrokes, classical museum quality, dramatic chiaroscuro, rich textures and landscapes",
  "pixel-art": "high-fidelity pixel art, 32-bit aesthetic, detailed retro environments, expressive character sprites, atmospheric lighting, nostalgic but crisp",
  "vaporwave": "retro-futuristic vaporwave, 80s aesthetic, realistic statues with neon lights, lo-fi aesthetic, tropical landscapes, pink and turquoise sunset, VHS dreamscape",
};

/**
 * MVシーン画像を生成する。歌詞セクションごとにシーン記述→画像URLを生成。
 */
export async function generateMVSceneImages(
  lyrics: string,
  styleTags: string,
  mood: string,
  sceneCount: number,
  artStyle: string = "cinematic",
  onProgress?: (percent: number, status?: string) => void
): Promise<string[]> {
  const styleBoost = ART_STYLE_PROMPTS[artStyle] || ART_STYLE_PROMPTS["cinematic"];

  // 1. Generate scene descriptions using Gemini
  const geminiPrompt = `You are an award-winning music video director, cinematographer, and visual storyteller.
Create ${sceneCount} breathtaking, PHOTOREALISTIC visual scene descriptions for a premium cinematic music video.

ARTISTIC DIRECTION:
- Art Style: ${artStyle} — ${styleBoost}
- Music Genre & Style: ${styleTags}
- Emotional Mood: ${mood}

LYRICS:
"""
${lyrics.substring(0, 2000)}
"""

CRITICAL SCENE REQUIREMENTS:

1. HUMAN CHARACTER (MANDATORY for at least 70% of scenes):
   - Describe a SPECIFIC protagonist: age range (e.g., "a young woman in her early 20s"), ethnicity, hair style and color, skin tone and texture
   - FACIAL EXPRESSION is critical: describe the exact emotion shown (tearful eyes, bittersweet smile, determined gaze, wistful longing)
   - ATTIRE must be specific and contextual: material, color, style (e.g., "wearing a flowing white linen dress" or "in a dark leather jacket with silver chains")
   - BODY LANGUAGE: posture, gesture, movement (e.g., "standing with arms outstretched facing the ocean wind", "sitting hunched over a piano, fingers hovering above keys")

2. ENVIRONMENT & LANDSCAPE (MANDATORY for every scene):
   - Name the EXACT real-world-style location (e.g., "a windswept cliff overlooking the Pacific Ocean", "a narrow cobblestone alley in a rain-soaked European city at night")
   - Describe DEPTH and SCALE: foreground details, mid-ground subjects, background vistas
   - Include ATMOSPHERIC elements: fog, rain, dust particles in sunbeams, cherry blossom petals floating
   - SEASONAL and TIME cues: "autumn twilight", "frozen winter dawn", "humid summer midnight"

3. CINEMATOGRAPHY (MANDATORY for every scene):
   - CAMERA ANGLE: Choose from: extreme close-up (eyes/hands), medium close-up (face/shou lders), medium shot (waist up), wide shot (full body in environment), extreme wide/aerial (landscape dominant)
   - LENS EFFECT: "shot on 35mm anamorphic lens with shallow depth of field", "wide-angle 24mm with dramatic perspective", "telephoto compression"
   - LIGHTING: Be precise — "golden hour side-lighting casting long shadows", "neon pink and blue reflections on wet pavement", "single overhead spotlight in darkness", "diffused overcast light"

4. EMOTIONAL ARC:
   - Scenes 1-2: Establish mood, intimate/quiet
   - Scenes 3-5: Building intensity, wider shots
   - Scenes 6-${Math.max(6, sceneCount - 2)}: Climax, most dramatic visuals
   - Final scenes: Resolution, reflective

5. ABSOLUTE RULES:
   - NO text, letters, words, typography, watermarks, logos, UI elements
   - NO blurry or abstract images — everything must be SHARP and PHOTOREALISTIC
   - Each description must be 60-90 words
   - Write descriptions as IMAGE GENERATION PROMPTS, not prose

Output format — each scene on its own line, numbered 1-${sceneCount}:
1. [image prompt with character + environment + camera + lighting]
2. [image prompt with character + environment + camera + lighting]
...`;

  onProgress?.(5, "シーン記述を生成中...");

  const resp = await geminiPostWithFallback(
    { contents: [{ parts: [{ text: geminiPrompt }] }] },
    "シーン記述の生成",
    { temperature: 0.85 },
    (msg) => onProgress?.(5, msg)
  );
  const data = await resp.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Parse scene descriptions
  const sceneDescs: string[] = [];
  const lines = rawText.split("\n").filter((l: string) => l.trim());
  for (const line of lines) {
    const match = line.match(/^\d+\.\s*(.+)/);
    if (match) {
      sceneDescs.push(match[1].trim());
    }
  }

  // Ensure we have enough scenes
  while (sceneDescs.length < sceneCount) {
    sceneDescs.push(sceneDescs[sceneDescs.length - 1] || "abstract cinematic visual, moody lighting, atmospheric, volumetric fog");
  }

  onProgress?.(20);

  // 2. Generate actual images via AI Horde for each scene
  const imageUrls: string[] = [];

  for (let i = 0; i < Math.min(sceneDescs.length, sceneCount); i++) {
    const cleanPrompt = sceneDescs[i]
      .replace(/^["'`\s]+|["'`\s]+$/g, "")
      .replace(/```[a-z]*\n?|```/g, "")
      .trim();

    const qualityTail = "photorealistic, sharp focus, cinematic lighting, masterpiece, no text, no watermark";
    let fullPrompt = `${styleBoost}, ${cleanPrompt}, ${qualityTail}`;

    // Truncate to 1000 chars for AI Horde
    if (fullPrompt.length > 1000) {
      fullPrompt = fullPrompt.substring(0, 1000);
    }

    onProgress?.(20 + (70 * i) / sceneCount, `シーン ${i + 1}/${sceneCount} を生成中...`);

    try {
      const url = await generateImageViaHorde(
        fullPrompt,
        512,
        512, // Square for AI Horde anonymous user limits
        (status) => onProgress?.(20 + (70 * i) / sceneCount, `シーン ${i + 1}: ${status}`)
      );
      imageUrls.push(url);
    } catch (err) {
      console.warn(`Scene ${i + 1} generation failed, using placeholder:`, err);
      // Use empty string; the frontend will show a gradient fallback
      imageUrls.push("");
    }

    onProgress?.(20 + (70 * (i + 1)) / sceneCount);
  }

  onProgress?.(100);
  return imageUrls;
}

export async function refineStyleTags(prompt: string): Promise<string> {
  const geminiPrompt = `Refine the following music description into short, effective style tags for an AI music generator like Suno.
Output only the tags separated by commas. Do not include brackets or extra text.

Input Description: ${prompt}`;

  const resp = await geminiPostWithFallback(
    { contents: [{ parts: [{ text: geminiPrompt }] }] },
    "プロンプト精査"
  );
  const data = await resp.json();
  const refined = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!refined) throw new Error("精査結果が空です。");
  return refined;
}
export async function refineLyrics(currentLyrics: string, feedback: string): Promise<string> {
  const geminiPrompt = `You are an expert songwriter.
TASK: Refine the provided lyrics based on the user's feedback.

ORIGINAL LYRICS:
"""
${currentLyrics}
"""

USER FEEDBACK:
"${feedback}"

CONSTRAINTS:
- Keep the overall structure (Verse, Chorus, etc.) similar to the original unless instructed otherwise.
- Output ONLY the refined lyrics.
- Do NOT add any explanations or prefix like "Here are the refined lyrics".
- If the original lyrics are in Japanese, the refined lyrics should also be in Japanese (unless feedback says otherwise).
- Make it emotional, poetic, and professional.

REFINED LYRICS:`;

  const resp = await geminiPostWithFallback(
    { contents: [{ parts: [{ text: geminiPrompt }] }] },
    "ブラッシュアップ",
    { temperature: 0.8 }
  );
  const data = await resp.json();
  const refined = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!refined) throw new Error("ブラッシュアップ結果が空です。");
  return refined;
}

export async function optimizeLyricsForVirality(
  lyrics: string,
  currentAnalysis: any,
  styleTags: string,
  language: string
): Promise<string> {
  const isInstrumental = lyrics.includes("[Instrumental");

  const instrumentalGuard = isInstrumental ? `
CRITICAL: This is an INSTRUMENTAL/BGM track. There are NO vocals and NO lyrics.
- Do NOT generate any lyrics, words, or text that could be read aloud
- Do NOT translate or convert anything to Japanese text
- The [Lyrics] section MUST contain ONLY the exact string "[Instrumental]"
- Focus ALL optimization on the Style Tags: improve production quality descriptors, arrangement tags, and BGM-specific keywords
- Ensure Style Tags include: "Instrumental", "No Vocals", "BGM", "Professional Mix"
` : "";

  const geminiPrompt = `You are a strategic music marketing expert and professional songwriter.
TASK: Optimize the provided ${isInstrumental ? "style tags and production tags" : "lyrics and style tags"} to MAXIMIZE viral potential on Suno/Udio/TikTok.

${instrumentalGuard}

INPUT DATA:
- Current Lyrics: ${lyrics}
- Current Analysis: ${JSON.stringify(currentAnalysis)}
- Style Tags: ${styleTags}
- Target Language: ${language}

STRATEGY:
${isInstrumental ? `- Focus on PRODUCTION QUALITY tags: "high-fidelity", "studio mixing", "professional master", "warm analog", "crisp digital"
- Add ARRANGEMENT descriptors: instrument-specific tags, dynamic markers, texture keywords
- Include TREND-ALIGNED sub-genre tags for BGM (e.g., "Lo-fi Chill BGM", "Cinematic Orchestral", "Ambient Electronic")
- Optimize for Suno/Udio BGM generation quality` : `- Incorporate "Success Patterns": Use high-retention structures (hook in first 5s), rhythmic repetition, and emotionally resonant "meme-able" phrases found in Suno/Udio/Mureka hits.
- Mureka-Specific Optimization: Enhance production quality descriptors in style tags (e.g., "high-fidelity", "studio mixing", "professional master") to leverage Mureka's high-end sonic engine.
- Trend Alignment: Adjust style tags to align with the current +15% J-Pop/Cinematic trend mentioned in the analysis.`}
- Specific Fixes: Address EVERY suggestion provided in the current analysis.

OUTPUT FORMAT (Strictly follow):
[Style Tags]
(Updated tags — ALL IN ENGLISH, comma-separated)

[Viral Analysis]
(Updated metrics showing improvement)

[Lyrics]
${isInstrumental ? "(Output ONLY the string: [Instrumental])" : "(Fully optimized lyrics)"}

Generate the OPTIMIZED ${isInstrumental ? "style tags" : "song"} and new analysis now:`;

  const resp = await geminiPostWithFallback(
    { contents: [{ parts: [{ text: geminiPrompt }] }] },
    "バイラル最適化",
    { temperature: 0.85 }
  );
  const data = await resp.json();
  const optimized = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!optimized) throw new Error("最適化結果が空です。");
  return optimized;
}

/**
 * 歌詞とスタイルタグからバズりポテンシャルを分析する
 */
export async function analyzeViralPotential(lyrics: string, styleTags: string): Promise<ViralAnalysis> {
  const prompt = `You are a viral trend analyst in the music industry.
Analyze the viral potential of the following song based on its lyrics and style tags.

Lyrics:
"""
${lyrics.substring(0, 1000)}
"""

Style Tags: ${styleTags}

Output your analysis in EXPLICIT JSON format with the following keys:
- score: (number, 0-100)
- breakdown: { melody: number, empathy: number, trend: number } (each 0-100)
- marketTrend: (string, a short catchy trend comment like "J-Pop synth-rock is rising +20% this week")
- suggestions: (array of 3 specific improvement suggestions in Japanese. Focus on practical improvements like "Add a catchy synth hook", "Increase emotional resonance in the chorus", or "Layer professional vocal textures". AVOID suggesting niche styles like "Operatic" unless the genre is Classical or Metal.)

IMPORTANT: The suggestions must align WITH THE CURRENT GENRE. Do not suggest extreme style shifts. The response MUST be ONLY the JSON object. Do not include markdown code blocks.`;

  const resp = await geminiPostWithFallback(
    { contents: [{ parts: [{ text: prompt }] }] },
    "バズり予測分析",
    { temperature: 0.7 }
  );

  const data = await resp.json();
  let rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Clean potential markdown code blocks
  rawJson = rawJson.replace(/```json\n?|```/g, "").trim();

  try {
    return JSON.parse(rawJson);
  } catch (e) {
    console.error("Failed to parse viral analysis JSON:", rawJson);
    throw new Error("分析結果の解析に失敗しました。AIの回答形式が正しくありません。");
  }
}

/**
 * トレンドに合わせて楽曲全体を最適化する
 */
export async function optimizeForTrends(current: GeneratedPrompt): Promise<GeneratedPrompt> {
  const isInstrumental = current.lyrics.includes("[Instrumental");

  const prompt = `You are a world-class music producer aiming for a viral hit.
Based on the current song structure, optimize it to be MORE TRENDY and CATCHY.

${isInstrumental ? `CRITICAL: This is an INSTRUMENTAL/BGM track with NO VOCALS.
- Do NOT generate any lyrics, words, or readable text
- Do NOT translate anything to Japanese
- The [Lyrics] section MUST output ONLY "[Instrumental]"
- Focus optimization ONLY on Style Tags and Meta (BPM, Key, Instruments)
- Improve production quality tags and arrangement descriptors in English` : ""}

Current Data:
Style Tags: ${current.styleTags}
BPM: ${current.meta.bpm} | Key: ${current.meta.key} | Instruments: ${current.meta.instruments}
Lyrics:
"""
${isInstrumental ? "[Instrumental]" : current.lyrics}
"""

TASK:
${isInstrumental ? "Improve style tags to include trending BGM production tags, refine instruments and BPM for maximum impact. ALL tags must be in English." : "Improve the lyrics to be more emotional/relatable, refine style tags to include current popular sub-genres, and adjust meta info if needed."}

Output format REQUIREMENT:
Your response MUST strictly follow this structure:
[Style Tags]
(Comma separated tags — ALL IN ENGLISH)

[Meta]
BPM: (number)
Key: (string)
Instruments: (string)

[Lyrics]
${isInstrumental ? "[Instrumental]" : "(Updated lyrics)"}

Optimize for maximum viral potential now:`;

  const resp = await geminiPostWithFallback(
    { contents: [{ parts: [{ text: prompt }] }] },
    "トレンド最適化",
    { temperature: 0.8 }
  );

  const data = await resp.json();
  const fullText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Parse result
  const styleMatch = fullText.match(/\[STYLE(?:\s*TAGS?)?\]\s*([\s\S]*?)(?:\n\[|$)/i)
    || fullText.match(/Style\s*Tags?:\s*(.*?)(?:\n|$)/i);
  const bpmMatch = fullText.match(/BPM:\s*(\d+)/i);
  const keyMatch = fullText.match(/Key:\s*([A-Ga-g][#b]?\s*(?:major|minor|maj|min)?)/i);
  const instrMatch = fullText.match(/Instruments?:\s*(.*?)(?:\n|$)/i);
  const lyricsMatch = fullText.match(/\[LYRICS?\]\s*([\s\S]*)/i);

  return {
    ...current,
    styleTags: styleMatch?.[1]?.trim() || current.styleTags,
    meta: {
      bpm: bpmMatch ? parseInt(bpmMatch[1]) : current.meta.bpm,
      key: keyMatch?.[1]?.trim() || current.meta.key,
      instruments: instrMatch?.[1]?.trim() || current.meta.instruments,
    },
    // For instrumental, always preserve original lyrics
    lyrics: isInstrumental ? current.lyrics : (lyricsMatch?.[1]?.trim() || fullText),
  };
}
