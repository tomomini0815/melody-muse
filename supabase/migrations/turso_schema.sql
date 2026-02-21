-- lyrics_history table matches the GeneratedPrompt type
CREATE TABLE IF NOT EXISTS lyrics_history (
    id TEXT PRIMARY KEY,
    lyrics TEXT NOT NULL,
    style_tags TEXT NOT NULL,
    bpm INTEGER NOT NULL,
    musical_key TEXT NOT NULL,
    instruments TEXT NOT NULL,
    config TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    is_favorite BOOLEAN NOT NULL DEFAULT 0,
    cover_url TEXT,
    original_prompt TEXT
);
