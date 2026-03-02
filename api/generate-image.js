export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const AI_HORDE_API = "https://aihorde.net/api/v2";
    const ANON_KEY = "0000000000";

    try {
        const { prompt, width, height } = req.body;
        if (!prompt) return res.status(400).json({ error: "prompt is required" });

        // Submit async generation request to AI Horde and return the job ID immediately
        const submitResp = await fetch(`${AI_HORDE_API}/generate/async`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: ANON_KEY },
            body: JSON.stringify({
                prompt: prompt.substring(0, 1000),
                params: {
                    width: Math.min(width || 1024, 1024),
                    height: Math.min(height || 1024, 1024),
                    steps: 25,
                    cfg_scale: 7,
                    n: 1,
                },
                nsfw: false,
                censor_nsfw: true,
                r2: true,
            }),
        });

        if (!submitResp.ok) {
            const errText = await submitResp.text();
            return res.status(502).json({ error: `AI Horde submit failed (${submitResp.status}): ${errText}` });
        }

        const data = await submitResp.json();
        if (!data.id) return res.status(502).json({ error: "No job ID returned" });

        return res.status(200).json({ jobId: data.id });
    } catch (e) {
        console.error("generate-image error:", e);
        return res.status(500).json({ error: e instanceof Error ? e.message : "Unknown error" });
    }
}
