import { GeneratedPrompt } from "./types";
import { turso } from "./turso";

const HISTORY_KEY = "suno-prompt-history";
const MIGRATION_DONE_KEY = "turso-migration-complete";

// Migration helper: Move data from localStorage to Turso
export async function migrateToTurso() {
  const isMigrated = localStorage.getItem(MIGRATION_DONE_KEY);
  if (isMigrated) return;

  try {
    const localData = localStorage.getItem(HISTORY_KEY);
    if (!localData) {
      localStorage.setItem(MIGRATION_DONE_KEY, "true");
      return;
    }

    const history: GeneratedPrompt[] = JSON.parse(localData);
    console.log(`Migrating ${history.length} items to Turso...`);

    for (const item of history) {
      await saveToHistory(item);
    }

    localStorage.setItem(MIGRATION_DONE_KEY, "true");
    console.log("Migration to Turso complete.");
  } catch (error) {
    console.error("Migration to Turso failed:", error);
  }
}

export async function getHistory(): Promise<GeneratedPrompt[]> {
  try {
    const rs = await turso.execute("SELECT * FROM lyrics_history ORDER BY created_at DESC");
    return rs.rows.map(row => ({
      id: row.id as string,
      lyrics: row.lyrics as string,
      styleTags: row.style_tags as string,
      meta: {
        bpm: Number(row.bpm),
        key: row.musical_key as string,
        instruments: row.instruments as string,
      },
      config: JSON.parse(row.config as string),
      createdAt: Number(row.created_at),
      isFavorite: Boolean(row.is_favorite),
      coverUrl: row.cover_url as string | undefined,
      originalPrompt: row.original_prompt as string | undefined,
    }));
  } catch (error) {
    console.error("Failed to fetch history from Turso:", error);
    return [];
  }
}

export async function saveToHistory(prompt: GeneratedPrompt) {
  try {
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
  } catch (error) {
    console.error("Failed to save to Turso:", error);
    // Fallback back to localStorage if Turso is not configured? 
    // For now, just log the error.
  }
}

export async function toggleFavorite(id: string): Promise<boolean> {
  try {
    const rs = await turso.execute({
      sql: "SELECT is_favorite FROM lyrics_history WHERE id = ?",
      args: [id]
    });

    if (rs.rows.length === 0) return false;

    const newStatus = rs.rows[0].is_favorite ? 0 : 1;
    await turso.execute({
      sql: "UPDATE lyrics_history SET is_favorite = ? WHERE id = ?",
      args: [newStatus, id]
    });

    return Boolean(newStatus);
  } catch (error) {
    console.error("Failed to toggle favorite in Turso:", error);
    return false;
  }
}

export async function getFavorites(): Promise<GeneratedPrompt[]> {
  const history = await getHistory();
  return history.filter((h) => h.isFavorite);
}

export async function deleteFromHistory(id: string) {
  try {
    await turso.execute({
      sql: "DELETE FROM lyrics_history WHERE id = ?",
      args: [id]
    });
  } catch (error) {
    console.error("Failed to delete from Turso:", error);
  }
}
