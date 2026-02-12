import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { genres, mood, tempo, bpm, themes, customTheme, language, duration, artist } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const lang = language === "ja" ? "Japanese" : "English";
    const durationMap: Record<string, string> = {
      "30s": "very short (about 4-6 lines)",
      "1min": "short (about 8-12 lines)",
      "2min": "medium (about 16-24 lines with verse/chorus structure)",
      "3min+": "full length (about 30+ lines with verse/chorus/bridge structure)",
    };
    const lengthDesc = durationMap[duration] || durationMap["2min"];

    const systemPrompt = `You are a professional songwriter and music producer who creates lyrics and SunoAI prompts. You output structured results in a specific format.

CRITICAL: Always output in this exact format:

[STYLE TAGS]
[style tags here, e.g. upbeat pop rock, energetic, catchy melody]

[META]
BPM: <number>
Key: <key, e.g. C major, A minor>
Instruments: <comma-separated instrument list>

[LYRICS]
<song lyrics with section markers like [Verse 1], [Chorus], [Bridge], etc.>

Rules:
- Write lyrics in ${lang}
- ${language === "ja" ? "Use natural, poetic Japanese. Consider rhyming patterns (韻) and rhythmic flow." : "Write natural, native-sounding English with good rhyme schemes."}
- Include musical structure markers: [Intro], [Verse], [Chorus], [Bridge], [Outro] as appropriate
- Song length: ${lengthDesc}
- Make style tags specific and useful for SunoAI (comma-separated descriptors inside brackets)
- Choose an appropriate musical key based on the mood
- List specific instruments that would suit the genre/mood combination`;

    const userPrompt = `Create a song with these specifications:
    ${artist ? `- Style/Artist Influence: **${artist}**\n  - **CRITICAL**: The generated "Style Tags" and "Lyrcis" MUST reflect the specific **Vocal Characteristics** and **Atmosphere** defined in the prompt. Use exact musical terms (e.g. "whistle register", "vocal fry", "falsetto") in the style tags.\n  - **Vocal Target**: ${artist === 'ado' ? "Powerful, growling, theatrical, changing tone rapidly." : artist === 'yoasobi' ? "Crystal clear, flat (non-vibrato), rapid rhythmic popping." : "Mimic the specific vocal texture described in the style definition."}` : ""}
- Genres: ${genres.join(", ")}
- Mood: ${mood}
- Tempo: ${tempo === "custom" ? `${bpm} BPM` : tempo}
- Themes: ${themes.join(", ")}${customTheme ? `, ${customTheme}` : ""}
- Language: ${lang}
- Duration: ${duration}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-lyrics error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
