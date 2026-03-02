export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");

    if (req.method === "OPTIONS") return res.status(200).end();

    const AI_HORDE_API = "https://aihorde.net/api/v2";
    const jobId = req.query.id;

    if (!jobId) return res.status(400).json({ error: "id query param is required" });

    try {
        // Check job status
        const checkResp = await fetch(`${AI_HORDE_API}/generate/check/${jobId}`);
        const checkData = await checkResp.json();

        if (checkData.faulted) {
            return res.status(502).json({ error: "Generation faulted", done: false, faulted: true });
        }

        if (checkData.done) {
            // Get the result
            const resultResp = await fetch(`${AI_HORDE_API}/generate/status/${jobId}`);
            const resultData = await resultResp.json();
            const imgUrl = resultData.generations?.[0]?.img;

            if (!imgUrl) return res.status(502).json({ error: "No image URL", done: true });

            return res.status(200).json({ done: true, imageUrl: imgUrl });
        }

        // Not done yet
        return res.status(200).json({
            done: false,
            queue_position: checkData.queue_position,
            wait_time: checkData.wait_time,
        });
    } catch (e) {
        console.error("check-image error:", e);
        return res.status(500).json({ error: e instanceof Error ? e.message : "Unknown error" });
    }
}
