import { Language, LANGUAGES } from "./types";

/**
 * Helper to fetch with exponential backoff for 429 errors
 */
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 5): Promise<Response> {
  let retries = 0;
  while (true) {
    const resp = await fetch(url, options);

    if (resp.status === 429 && retries < maxRetries) {
      // Starting with 5s backoff for standard rate limits.
      const waitTime = Math.pow(2, retries) * 5000 + Math.random() * 1000;
      console.warn(`Gemini API 429 detected. Retrying in ${Math.round(waitTime / 1000)}s... (Attempt ${retries + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      retries++;
      continue;
    }

    return resp;
  }
}

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_STREAM_URL = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`;
const GEMINI_POST_URL = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

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

  const successDatabase = `
    SUCCESS PATTERNS (Trends 2024-2025):
    - J-Pop: High-pitched catchy hooks, piano-driven fast tempo (160-180 BPM), emotional "bridge" transitions.
    - Anime Style: Story-driven lyrics, fast rhythmic articulation (YOASOBI/Ado style), mix of orchestral strings and rock.
    - Chill/Lo-Fi: Relatable, intimate "daily life" lyrics, slow grooves, nostalgic chord progressions.
    - Viral TikTok: 15-30s powerful "hook" sections, danceable beats, simple but catchy repetition.
  `;

  const prompt = `You are a world-class music producer and viral content strategist. 
Based on successful trends from SunoAI and Udio, generate a song that has high viral potential.

${successDatabase}

Configuration:
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

[Viral Analysis]
(Breakdown your prediction in JSON-like format:)
Score: (Total 0-100)
Melody: (0-100)
Empathy: (0-100)
Trend: (0-100)
Market: (One sentence about current trend)
Suggestions: (List 2-3 specific ways to increase the score)

Generate the song and analysis now:`;

  const resp = await fetchWithRetry(GEMINI_STREAM_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096,
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

  const resp = await fetchWithRetry(GEMINI_POST_URL, {
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

  const resp = await fetchWithRetry(GEMINI_POST_URL, {
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

/**
 * アートスタイル別のプロンプト補強マッピング
 */
const ART_STYLE_PROMPTS: Record<string, string> = {
  "cinematic": "cinematic film still, 35mm anamorphic lens, shallow depth of field, dramatic volumetric lighting, filmic color grading, lens flare",
  "anime": "anime art style, Studio Ghibli inspired, vibrant cel shading, detailed anime background, soft ambient lighting, beautiful anime scenery",
  "cyberpunk": "cyberpunk aesthetic, neon-lit cityscape, holographic displays, rain-slicked streets, cyan and magenta lighting, blade runner style",
  "3d-render": "high quality 3D render, octane render, unreal engine 5, volumetric fog, ray-traced global illumination, photorealistic materials, subsurface scattering",
  "oil-painting": "masterful oil painting style, visible brushstrokes, rich impasto texture, classical composition, chiaroscuro lighting, museum quality fine art",
  "pixel-art": "detailed pixel art, 16-bit retro game aesthetic, dithering effects, limited color palette, nostalgic video game scene, crisp pixels",
  "vaporwave": "vaporwave aesthetic, pastel pink and cyan gradient, retro 80s, marble statues, palm trees, grid landscape, VHS glitch effect, sunset hues",
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
  const geminiPrompt = `You are an award-winning music video director and cinematographer.
Create ${sceneCount} breathtaking visual scene descriptions for a premium music video.

ARTISTIC DIRECTION:
- Art Style: ${artStyle} — ${styleBoost}
- Music Genre & Style: ${styleTags}
- Emotional Mood: ${mood}

LYRICS:
"""
${lyrics.substring(0, 2000)}
"""

INSTRUCTIONS:
- Each scene description should be 40-60 words, highly detailed and vivid.
- Describe the VISUAL COMPOSITION precisely: camera angle (close-up, wide shot, aerial, dutch angle), lighting (golden hour, neon, moonlight, backlit silhouette), color palette, atmosphere, and key visual elements.
- Match emotional intensity to the lyrics: Verses should feel intimate and atmospheric, Choruses should feel epic and expansive, Bridges should feel transformative.
- Create visual CONTINUITY between scenes — they should feel like one cohesive story.
- Do NOT include any text, letters, words, or typography in ANY scene.
- Each scene must be unique — no repeated compositions.

Output format — each scene on its own line, numbered 1-${sceneCount}:
1. [detailed visual description]
2. [detailed visual description]
...`;

  onProgress?.(5);

  const resp = await fetchWithRetry(GEMINI_POST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: geminiPrompt }] }],
      generationConfig: { temperature: 0.85 }
    }),
  });

  if (!resp.ok) throw new Error("シーン記述の生成に失敗しました。");
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

  // 2. Generate image URLs with fallback strategy
  //    Primary: Pollinations.ai (AI-generated from prompt)
  //    Fallback: picsum.photos (curated photography, mood-matched)
  const imageUrls: string[] = [];
  let pollinationsAvailable = true;

  // Quick availability check for Pollinations.ai
  try {
    const testResp = await fetch(
      `https://image.pollinations.ai/prompt/${encodeURIComponent("test")}?width=64&height=64&nologo=true`,
      { method: "HEAD", signal: AbortSignal.timeout(5000) }
    );
    if (!testResp.ok) pollinationsAvailable = false;
  } catch {
    pollinationsAvailable = false;
  }

  console.log(`[MV] Image provider: ${pollinationsAvailable ? "Pollinations.ai" : "picsum.photos (fallback)"}`);

  for (let i = 0; i < Math.min(sceneDescs.length, sceneCount); i++) {
    const cleanPrompt = sceneDescs[i]
      .replace(/^["'`\s]+|["'`\s]+$/g, "")
      .replace(/```[a-z]*\n?|```/g, "")
      .trim();

    let url: string;
    if (pollinationsAvailable) {
      // Primary: Pollinations.ai with enhanced prompt
      const fullPrompt = `${styleBoost}, ${cleanPrompt}, masterpiece, best quality, ultra detailed, 8k resolution, no text, no watermark`;
      const encodedPrompt = encodeURIComponent(fullPrompt);
      const seed = Math.floor(Math.random() * 1000000);
      url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1280&height=720&seed=${seed}&nologo=true`;
    } else {
      // Fallback: picsum.photos — random curated photography
      // Use a unique seed per scene for variety
      const picsumId = 100 + (i * 73 + Math.floor(Math.random() * 50)) % 900;
      url = `https://picsum.photos/id/${picsumId}/1280/720`;
    }
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

  const resp = await fetchWithRetry(GEMINI_POST_URL, {
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

  const resp = await fetchWithRetry(GEMINI_POST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: geminiPrompt }] }],
      generationConfig: {
        temperature: 0.8,
      }
    }),
  });

  if (!resp.ok) {
    const errorBody = await resp.text();
    console.error("Gemini API Error (Refine):", resp.status, errorBody);
    throw new Error(`ブラッシュアップに失敗しました: ${resp.status}`);
  }
  const data = await resp.json();
  const refined = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!refined) throw new Error("ブラッシュアップ結果が空です。");
  return refined;
}
/**
 * バズ予測の解析結果を基に、歌詞を「バズる方向」へ自動調整する
 */
export async function optimizeLyricsForVirality(
  currentLyrics: string,
  analysis: any,
  styleTags: string,
  targetLang: string = "Japanese"
): Promise<string> {
  const geminiPrompt = `You are a world-class music producer and viral marketing विशेषज्ञ.
TASK: Optimize the provided lyrics to maximize its viral potential based on the following analysis.

CURRENT LYRICS:
"""
${currentLyrics}
"""

CURRENT VIRAL ANALYSIS:
- Overall Score: ${analysis.score}%
- Melody/Catchiness: ${analysis.breakdown.melody}
- Empathy/Relatability: ${analysis.breakdown.empathy}
- Trend Alignment: ${analysis.breakdown.trend}
- Market Trend: ${analysis.marketTrend}
- AI Suggestions: ${analysis.suggestions.join(", ")}

INSTRUCTIONS:
1. Rewrite the lyrics to specifically address the "AI Suggestions" and improve the scores.
2. If Empathy is low, add more relatable, emotional, or "human" storytelling.
3. If Trend is low, incorporate modern slang, viral-friendly structures (short punchy hooks), or genre-specific keywords (e.g., J-Pop tropes).
4. Maintain the overall theme and language (${targetLang}).
5. Output your response in the SAME format as the original generation, including [Style Tags], [Meta], [Lyrics], and a NEW [Viral Analysis].
6. The NEW Viral Analysis should reflect the improvements you've made. It should aim for 90%+ score.

Generate the OPTIMIZED song and new analysis now:`;

  const resp = await fetchWithRetry(GEMINI_POST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: geminiPrompt }] }],
      generationConfig: {
        temperature: 0.85,
      }
    }),
  });

  if (!resp.ok) {
    const errorBody = await resp.text();
    console.error("Gemini API Error (Optimize):", resp.status, errorBody);
    throw new Error(`最適化に失敗しました: ${resp.status}`);
  }
  const data = await resp.json();
  const optimizedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!optimizedText) throw new Error("最適化結果が空です。");
  return optimizedText;
}
