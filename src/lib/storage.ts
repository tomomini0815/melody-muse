import { GeneratedPrompt } from "./types";

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
    const res = await fetch("/api/history");
    if (!res.ok) throw new Error("Failed to fetch history");
    const rows = await res.json();

    return rows.map((row: any) => ({
      id: row.id,
      lyrics: row.lyrics,
      styleTags: row.style_tags,
      meta: {
        bpm: Number(row.bpm),
        key: row.musical_key,
        instruments: row.instruments,
      },
      config: JSON.parse(row.config),
      createdAt: Number(row.created_at),
      isFavorite: Boolean(row.is_favorite),
      coverUrl: row.cover_url || undefined,
      originalPrompt: row.original_prompt || undefined,
    }));
  } catch (error) {
    console.error("Failed to fetch history:", error);
    return [];
  }
}

export async function saveToHistory(prompt: GeneratedPrompt) {
  try {
    await fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });
  } catch (error) {
    console.error("Failed to save to history API:", error);
  }
}

export async function toggleFavorite(id: string): Promise<boolean> {
  try {
    const res = await fetch("/api/history", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.isFavorite;
  } catch (error) {
    console.error("Failed to toggle favorite:", error);
    return false;
  }
}

export async function getFavorites(): Promise<GeneratedPrompt[]> {
  const history = await getHistory();
  return history.filter((h) => h.isFavorite);
}

export async function deleteFromHistory(id: string) {
  try {
    await fetch(`/api/history?id=${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
  } catch (error) {
    console.error("Failed to delete from history API:", error);
  }
}
