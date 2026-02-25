import { Language, LANGUAGES, ViralAnalysis, GeneratedPrompt } from "./types";
import { CREATOR_CATEGORIES } from "./creator-templates";

/**
 * Helper to fetch with exponential backoff for 429 errors
 */
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 5): Promise<Response> {
  let retries = 0;
  while (true) {
    const resp = await fetch(url, options);

    const retryCodes = [429, 503];
    if (retryCodes.includes(resp.status) && retries < maxRetries) {
      // Starting with standard backoff, but allowing override for tests if needed (via world state or similar)
      // For now, let's keep it simple and just reduce the base if it's a test environment
      const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
      const baseWait = isTest ? 10 : 8000; // 5sから8sに拡張
      const waitTime = Math.pow(2, retries) * baseWait + Math.random() * (isTest ? 5 : 2000);

      const displayWait = Math.round(waitTime / 1000);
      console.warn(`Gemini API ${resp.status} detected. Retrying in ${displayWait}s... (Attempt ${retries + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      retries++;
      continue;
    }

    return resp;
  }
}

// 利用可能なモデル候補を定義（ListModels API で確認済み）
// ※ gemini-1.5-flash 系は全て廃止済み、使用不可
const GEMINI_MODELS = [
  "gemini-2.5-flash",       // 最新・最速・推奨
  "gemini-2.0-flash",       // 安定バックアップ
  "gemini-2.0-flash-001",   // バージョン固定バックアップ
];

function getGeminiConfig(modelIndex = 0) {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  const model = GEMINI_MODELS[Math.min(modelIndex, GEMINI_MODELS.length - 1)];

  return {
    key,
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
  configOverride?: Partial<{ temperature: number }>
): Promise<Response> {
  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const config = getGeminiConfig(i);
    const resp = await fetchWithRetry(config.postUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        ...(configOverride ? { generationConfig: configOverride } : {})
      }),
    });

    if (resp.ok) {
      console.log(`${context}: success with ${config.model}`);
      return resp;
    }
    console.warn(`${context}: ${config.model} failed (${resp.status}). Trying next...`);
  }

  // 最後のモデルのレスポンスを使ってエラーハンドリング
  const lastConfig = getGeminiConfig(GEMINI_MODELS.length - 1);
  const lastResp = await fetch(lastConfig.postUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await handleApiError(lastResp, context);
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

  // 利用可能なモデルを順番に試行
  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const currentConfig = getGeminiConfig(i);
    if (!currentConfig.key) {
      console.warn(`API key not set for model ${currentConfig.model}. Skipping.`);
      continue;
    }
    try {
      resp = await fetchWithRetry(currentConfig.streamUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          }
        }),
      });

      if (resp.ok) {
        console.log(`Generation started successfully using ${currentConfig.model}`);
        break;
      } else {
        console.warn(`Model ${currentConfig.model} failed with status ${resp.status}. Trying next...`);
        lastErrorModel = currentConfig.model;
      }
    } catch (err) {
      console.error(`Attempt with ${currentConfig.model} threw error:`, err);
      lastErrorModel = currentConfig.model;
    }
  }

  if (!resp || !resp.ok || !resp.body) {
    await handleApiError(resp!, `歌詞の生成 (${lastErrorModel || "全モデル失敗"})`);
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

  // 2. Return Pollinations.ai URL with stability fallback
  const cleanPrompt = visualPrompt
    .replace(/^["'`\s]+|["'`\s]+$/g, "") // Remove surrounding quotes or whitespace
    .replace(/```[a-z]*\n?|```/g, "") // Remove markdown code blocks if any
    .trim();

  const encodedPrompt = encodeURIComponent(cleanPrompt);
  const seed = Math.floor(Math.random() * 1000000);

  // Return the AI generated image URL. 
  // If Pollinations is down, the frontend will fail to load it, 
  // but it won't crash the logic here.
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true`;
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
  onProgress?: (percent: number) => void
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
   - CAMERA ANGLE: Choose from: extreme close-up (eyes/hands), medium close-up (face/shoulders), medium shot (waist up), wide shot (full body in environment), extreme wide/aerial (landscape dominant)
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

  onProgress?.(5);

  const resp = await geminiPostWithFallback(
    { contents: [{ parts: [{ text: geminiPrompt }] }] },
    "シーン記述の生成",
    { temperature: 0.85 }
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

  // 2. Generate image URLs for each scene
  const imageUrls: string[] = [];
  onProgress?.(20);

  for (let i = 0; i < Math.min(sceneDescs.length, sceneCount); i++) {
    const cleanPrompt = sceneDescs[i]
      .replace(/^["'`\s]+|["'`\s]+$/g, "")
      .replace(/```[a-z]*\n?|```/g, "")
      .trim();

    // Build prompt with style boost and quality keywords, but keep it concise for URL limits
    const qualityTail = "photorealistic, sharp focus, cinematic lighting, masterpiece, no text, no watermark";
    let fullPrompt = `${styleBoost}, ${cleanPrompt}, ${qualityTail}`;

    // Truncate to ~900 chars to keep the encoded URL under browser limits (~2048 chars)
    if (fullPrompt.length > 900) {
      fullPrompt = fullPrompt.substring(0, 900);
    }

    const encodedPrompt = encodeURIComponent(fullPrompt);
    const seed = Math.floor(Math.random() * 1000000);

    // Pollinations.ai free tier (flux is default, no enhance needed)
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1280&height=720&seed=${seed}&nologo=true`;
    imageUrls.push(url);

    onProgress?.(20 + (80 * (i + 1)) / sceneCount);
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
