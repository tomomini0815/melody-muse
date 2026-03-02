import { createClient } from "@libsql/client";

export default async function handler(req, res) {
    // CORS configuration for the API
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    const url = process.env.VITE_TURSO_URL;
    const authToken = process.env.VITE_TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
        return res.status(500).json({ error: "Turso credentials missing in environment variables" });
    }

    const turso = createClient({
        url,
        authToken,
    });

    try {
        if (req.method === "GET") {
            const rs = await turso.execute("SELECT * FROM lyrics_history ORDER BY created_at DESC");
            return res.status(200).json(rs.rows);
        }

        if (req.method === "POST") {
            const { prompt } = req.body;
            if (!prompt) return res.status(400).json({ error: "prompt is required" });

            await turso.execute({
                sql: `INSERT OR REPLACE INTO lyrics_history 
                      (id, lyrics, style_tags, bpm, musical_key, instruments, config, created_at, is_favorite, cover_url, original_prompt) 
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [
                    prompt.id,
                    prompt.lyrics,
                    prompt.styleTags,
                    prompt.meta.bpm,
                    prompt.meta.key,
                    prompt.meta.instruments,
                    JSON.stringify(prompt.config),
                    prompt.createdAt,
                    prompt.isFavorite ? 1 : 0,
                    prompt.coverUrl || null,
                    prompt.originalPrompt || null,
                ],
            });
            return res.status(200).json({ success: true });
        }

        if (req.method === "PUT") {
            const { id } = req.body;
            if (!id) return res.status(400).json({ error: "id is required" });

            const rs = await turso.execute({
                sql: "SELECT is_favorite FROM lyrics_history WHERE id = ?",
                args: [id]
            });

            if (rs.rows.length === 0) return res.status(404).json({ error: "Not found" });

            const newStatus = rs.rows[0].is_favorite ? 0 : 1;
            await turso.execute({
                sql: "UPDATE lyrics_history SET is_favorite = ? WHERE id = ?",
                args: [newStatus, id]
            });

            return res.status(200).json({ isFavorite: Boolean(newStatus) });
        }

        if (req.method === "DELETE") {
            const id = req.query.id;
            if (!id) return res.status(400).json({ error: "id is required" });

            await turso.execute({
                sql: "DELETE FROM lyrics_history WHERE id = ?",
                args: [id]
            });
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (e) {
        console.error("history API error:", e);
        return res.status(500).json({ error: e instanceof Error ? e.message : "Database error" });
    }
}
