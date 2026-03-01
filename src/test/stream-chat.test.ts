import { describe, it, expect, vi } from "vitest";
import { generateLyrics } from "../lib/stream-chat";

// Mock fetch globally
global.fetch = vi.fn();

import { GEMINI_MODELS, GEMINI_API_KEYS } from "../lib/stream-chat";

describe("stream-chat.ts error handling", () => {
    it("should throw a clear Japanese message on 429 error after retries", async () => {
        (global.fetch as any).mockResolvedValue({
            status: 429,
            ok: false,
            text: async () => "Quota exceeded",
            clone: function () { return this; },
            json: async () => ({ error: { details: [] } })
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
            duration: "3min+",
            instrumental: false
        }, mockDelta, mockDone)).rejects.toThrow("APIの利用制限（レートリミット）に達しました。");
    });
    it("should retry on 429 error and hit all combinations", async () => {
        vi.clearAllMocks();
        const fetchMock = vi.fn().mockImplementation(async () => ({
            status: 429,
            ok: false,
            text: async () => "Quota exceeded",
            clone: function () { return this; }
        }));
        global.fetch = fetchMock;

        const mockDelta = vi.fn();
        const mockDone = vi.fn();

        await expect(generateLyrics({
            genres: ["Pop"],
            mood: "Happy",
            tempo: "Fast",
            bpm: 120,
            themes: ["Love"],
            customTheme: "",
            customArtist: "",
            language: "ja",
            duration: "3min+",
            instrumental: false
        }, mockDelta, mockDone)).rejects.toThrow("APIの利用制限（レートリミット）に達しました。");

        // Calculate expected calls:
        // keys * models * 2 (initial + 1 retry)
        const expectedCalls = GEMINI_API_KEYS.length * GEMINI_MODELS.length * 2;
        expect(fetchMock).toHaveBeenCalledTimes(expectedCalls);
    });
});
