import { describe, it, expect, vi } from "vitest";
import { generateLyrics } from "../lib/stream-chat";

// Mock fetch globally
global.fetch = vi.fn();

describe("stream-chat.ts error handling", () => {
    it("should throw a clear Japanese message on 429 error after retries", async () => {
        (global.fetch as any).mockResolvedValue({
            status: 429,
            ok: false,
            text: async () => "Quota exceeded",
        });

        const mockDelta = vi.fn();
        const mockDone = vi.fn();

        // The test should now pass quickly because fetchWithRetry detects NODE_ENV === 'test'
        await expect(generateLyrics({
            genres: ["Pop"],
            mood: "Happy",
            tempo: "Fast",
            bpm: 120,
            themes: ["Love"],
            customTheme: "",
            customArtist: "",
            language: "ja",
            duration: "3min+"
        }, mockDelta, mockDone)).rejects.toThrow("APIの利用制限（レートリミット）に達しました。");
    });
});
