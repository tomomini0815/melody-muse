import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
        return new Response("ok", {
            status: 200,
            headers: corsHeaders
        });
    }

    try {
        const { lyrics, styleTags } = await req.json();
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

        if (!LOVABLE_API_KEY) {
            console.error("LOVABLE_API_KEY is not configured");
            throw new Error("APIキーが設定されていません");
        }

        console.log("Generating visual prompt for lyrics and style...");

        // Generate a visual prompt based on lyrics and style
        const promptResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "google/gemini-3-flash-preview", // Changed back to match working functions
                messages: [
                    {
                        role: "system",
                        content: "You are an expert art director. Create a detailed, artistic image generation prompt for a music cover based on the provided lyrics and style tags. Output ONLY the absolute core image prompt text. Keep it around 40-50 words, focusing on artistic style, mood, and key visual elements. Avoid meta-text or labels."
                    },
                    {
                        role: "user",
                        content: `Style: ${styleTags}\n\nLyrics Snapshot: ${lyrics.slice(0, 500)}`
                    },
                ],
            }),
        });

        if (!promptResponse.ok) {
            const errorText = await promptResponse.text();
            console.error("Prompt generation failed:", promptResponse.status, errorText);
            throw new Error(`プロンプト生成エラー (${promptResponse.status})`);
        }

        const promptData = await promptResponse.json();
        const visualPrompt = promptData.choices[0].message.content.trim();
        console.log("Visual Prompt generated:", visualPrompt);

        console.log("Requesting image generation from DALL-E 3...");

        // Now generate the actual image
        const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "openai/dall-e-3",
                prompt: visualPrompt,
                size: "1024x1024",
                quality: "standard",
                n: 1,
            }),
        });

        if (!imageResponse.ok) {
            const errorText = await imageResponse.text();
            console.error("DALL-E 3 generation failed:", imageResponse.status, errorText);
            throw new Error(`画像生成エンジンエラー (${imageResponse.status})`);
        }

        const imageData = await imageResponse.json();
        const imageUrl = imageData.data[0].url;
        console.log("Image successfully generated:", imageUrl);

        return new Response(JSON.stringify({ imageUrl }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Unknown error";
        console.error("generate-cover-art function error:", errMsg);
        return new Response(JSON.stringify({ error: errMsg }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
