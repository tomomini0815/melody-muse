import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music, Shuffle, ArrowLeft, ArrowRight, Clock, Sparkles, AudioWaveform } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { StepIndicator } from "@/components/StepIndicator";
import { GenreSelector } from "@/components/GenreSelector";
import { CustomizeForm } from "@/components/CustomizeForm";
import { ResultView } from "@/components/ResultView";
import { HistoryPanel } from "@/components/HistoryPanel";
import { Equalizer } from "@/components/Equalizer";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import {
  MusicConfig, GeneratedPrompt, DEFAULT_CONFIG, GENRES, MOODS, THEMES, ARTISTS, GenerationStatus
} from "@/lib/types";
import { generateLyrics, analyzeViralPotential } from "@/lib/stream-chat";
import { saveToHistory, toggleFavorite, migrateToTurso } from "@/lib/storage";

export default function Index() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    migrateToTurso();
  }, []);
  const [config, setConfig] = useState<MusicConfig>({ ...DEFAULT_CONFIG });
  const [result, setResult] = useState<GeneratedPrompt | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [genStatus, setGenStatus] = useState<GenerationStatus>("idle");
  const [historyOpen, setHistoryOpen] = useState(false);

  // Scroll to top on step change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const randomize = () => {
    const shuffled = [...GENRES].sort(() => Math.random() - 0.5);
    const rGenres = shuffled.slice(0, 1 + Math.floor(Math.random() * 3)).map((g) => g.id);
    const rMood = MOODS[Math.floor(Math.random() * MOODS.length)].id;
    const rThemes = [...THEMES].sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 2)).map((t) => t.id);
    const bpm = 70 + Math.floor(Math.random() * 110);
    setConfig({
      genres: rGenres,
      mood: rMood,
      tempo: "custom",
      bpm,
      themes: rThemes,
      customTheme: "",
      customArtist: "",
      language: Math.random() > 0.5 ? "ja" : "en",
      duration: (["30s", "1min", "2min", "3min+"] as const)[Math.floor(Math.random() * 4)],
      instrumental: false,
    });
    setStep(2);
    handleGenerate({
      genres: rGenres, mood: rMood, tempo: "custom", bpm,
      themes: rThemes, customTheme: "", customArtist: "", language: Math.random() > 0.5 ? "ja" : "en",
      duration: (["30s", "1min", "2min", "3min+"] as const)[Math.floor(Math.random() * 4)],
      instrumental: false,
    });
  };

  const handleGenerate = useCallback(async (cfg?: MusicConfig) => {
    const c = cfg || config;
    if (c.genres.length === 0) {
      toast({ title: "ジャンルを1つ以上選択してください", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    setIsStreaming(true);
    setGenStatus("analyzing");
    setStep(2);
    window.scrollTo(0, 0);

    const id = crypto.randomUUID();
    const newPrompt: GeneratedPrompt = {
      id,
      lyrics: "",
      styleTags: "",
      meta: { bpm: c.bpm, key: "", instruments: "" },
      config: c,
      createdAt: Date.now(),
      isFavorite: false,
    };
    setResult(newPrompt);

    try {
      const artistStyle = c.customArtist
        ? c.customArtist
        : (c.artist ? ARTISTS.find(a => a.id === c.artist)?.style || "" : "");

      const fullText = await generateLyrics(
        {
          genres: c.genres,
          mood: c.mood,
          tempo: c.tempo,
          bpm: c.bpm,
          themes: c.themes,
          customTheme: c.customTheme,
          customArtist: c.customArtist,
          language: c.language,
          duration: c.duration,
          artist: artistStyle,
          instrumental: c.instrumental,
        },
        (delta) => {
          setGenStatus("crafting");
          setResult((prev) => prev ? { ...prev, lyrics: prev.lyrics + delta } : prev);
        },
        () => setIsStreaming(false)
      );

      setGenStatus("styling");

      // Parse the full text to extract structured data
      const parsed = parseGeneratedText(fullText, c);
      setResult((prev) => prev ? { ...prev, ...parsed } : prev);

      setGenStatus("finalizing");

      // Auto-analyze viral potential after generation
      try {
        const analysis = await analyzeViralPotential(parsed.lyrics || fullText, parsed.styleTags || "");
        parsed.viralAnalysis = analysis;
        setResult((prev) => prev ? { ...prev, viralAnalysis: analysis } : prev);
      } catch (err) {
        console.error("Auto viral analysis failed:", err);
      }

      await saveToHistory({ ...newPrompt, ...parsed });
    } catch (e) {
      toast({ title: "エラー", description: (e as Error).message, variant: "destructive" });
      setIsStreaming(false);
    } finally {
      setIsGenerating(false);
      setGenStatus("idle");
    }
  }, [config]);

  const parseGeneratedText = (text: string, cfg: MusicConfig): Partial<GeneratedPrompt> => {
    // Try to extract style tags (consolidated or individual), meta, and lyrics from AI output
    const combinedStyleMatch = text.match(/\[STYLE\s*&\s*META\]\s*([\s\S]*?)(?:\n\[|$)/i);
    const styleMatch = text.match(/\[STYLE(?:\s*TAGS?)?\]\s*([\s\S]*?)(?:\n\[|$)/i)
      || text.match(/Style\s*Tags?:\s*(.*?)(?:\n|$)/i);
    const bpmMatch = text.match(/BPM:\s*(\d+)/i);
    const keyMatch = text.match(/Key:\s*([A-Ga-g][#b]?\s*(?:major|minor|maj|min)?)/i);
    const instrMatch = text.match(/Instruments?:\s*(.*?)(?:\n|$)/i);
    const lyricsMatch = text.match(/\[LYRICS?\]\s*([\s\S]*)/i)
      || text.match(/歌詞[：:]\s*([\s\S]*)/i);

    // Parse Viral Analysis section
    const viralMatch = text.match(/\[VIRAL(?:\s*ANALYSIS)?\]\s*([\s\S]*?)(?:\n\[|$)/i);
    let viralAnalysis = undefined;

    if (viralMatch) {
      const vText = viralMatch[1];
      const scoreM = vText.match(/Score:\s*(\d+)/i);
      const breakdownM = vText.match(/Breakdown:\s*Melody:(\d+),\s*Empathy:(\d+),\s*Trend:(\d+)/i);
      const marketM = vText.match(/Market:\s*(.*?)(?:\n|$)/i);
      const suggM = vText.match(/Suggestions:\s*([\s\S]*?)(?:\n\w+:|$)/i);

      viralAnalysis = {
        score: scoreM ? parseInt(scoreM[1]) : 0,
        breakdown: {
          melody: breakdownM ? parseInt(breakdownM[1]) : 0,
          empathy: breakdownM ? parseInt(breakdownM[2]) : 0,
          trend: breakdownM ? parseInt(breakdownM[3]) : 0,
        },
        marketTrend: marketM?.[1]?.trim() || "Analyzing market trends...",
        suggestions: suggM?.[1]?.trim().split("\n").map(s => s.replace(/^[-\s*•]+/, "").trim()).filter(Boolean) || [],
      };
    }

    const genreLabels = cfg.genres.map((g) => GENRES.find((x) => x.id === g)?.labelEn || g);
    const moodLabel = MOODS.find((m) => m.id === cfg.mood)?.labelEn || cfg.mood;

    const styleTags = styleMatch?.[1]?.trim() || `[${genreLabels.join(", ")}, ${moodLabel.toLowerCase()}]`;
    const bpm = bpmMatch ? parseInt(bpmMatch[1]) : cfg.bpm;
    const key = keyMatch?.[1]?.trim() || "C major";
    const instruments = instrMatch?.[1]?.trim() || genreLabels.join(", ") + " instruments";

    // Explicit combined prompt if specified by AI, otherwise build it
    const fullStyle = combinedStyleMatch?.[1]?.trim() || `${styleTags}, ${bpm}BPM, ${key}, ${instruments}`;

    return {
      styleTags,
      fullStyle,
      meta: { bpm, key, instruments },
      lyrics: lyricsMatch?.[1]?.trim() || text,
      viralAnalysis,
    };
  };

  const loadFromHistory = (prompt: GeneratedPrompt) => {
    setResult(prompt);
    setConfig(prompt.config);
    setStep(2);
    window.scrollTo(0, 0);
    setHistoryOpen(false); // Close history panel after loading
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: "1.5s" }} />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border bg-background/50 backdrop-blur-md sticky top-0 w-full">
        <div className="w-full px-4 sm:px-6">
          <div className="max-w-4xl mx-auto py-3 flex items-center justify-between gap-2">
            <div
              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity shrink min-w-0"
              onClick={() => {
                setStep(0);
                setResult(null);
                setConfig({ ...DEFAULT_CONFIG });
              }}
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl gradient-primary flex items-center justify-center shrink-0">
                <Music className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg font-display font-bold gradient-text truncate">MusicAI Prompt Studio</h1>
                <p className="text-[9px] sm:text-xs text-muted-foreground whitespace-nowrap">音楽プロンプトジェネレーター</p>
              </div>
            </div>
            <div className="flex gap-1 sm:gap-2 ml-auto shrink-0">
              <Link to="/analysis">
                <Button variant="ghost" size="sm" className="flex flex-col items-center h-auto py-1 px-2 hover:bg-primary/10 transition-colors group">
                  <AudioWaveform className="w-4 h-4 sm:w-5 sm:h-5 text-white group-hover:text-primary transition-colors" />
                  <span className="text-[8px] sm:text-[10px] font-medium text-muted-foreground group-hover:text-foreground">分析</span>
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={randomize} disabled={isGenerating} className="flex flex-col items-center h-auto py-1 px-2 hover:bg-primary/10 transition-colors group">
                <Shuffle className="w-4 h-4 sm:w-5 sm:h-5 text-white group-hover:text-primary transition-colors" />
                <span className="text-[8px] sm:text-[10px] font-medium text-muted-foreground group-hover:text-foreground">お任せ</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} className="flex flex-col items-center h-auto py-1 px-2 hover:bg-primary/10 transition-colors group">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-white group-hover:text-primary transition-colors" />
                <span className="text-[8px] sm:text-[10px] font-medium text-muted-foreground group-hover:text-foreground">履歴</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 w-full px-4 sm:px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <StepIndicator current={step} isGenreSelected={config.genres.length > 0} />

          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="s0" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
                <GenreSelector selected={config.genres} onChange={(genres) => setConfig((c) => ({ ...c, genres }))} />
                <div className="mt-8 flex justify-end">
                  <Button onClick={() => {
                    if (config.genres.length === 0) {
                      toast({ title: "ジャンルを1つ以上選択してください", variant: "destructive" });
                      return;
                    }
                    setStep(1);
                  }} className="gradient-primary">
                    次へ <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
                <CustomizeForm config={config} onChange={setConfig} />
                <div className="mt-4 flex justify-between">
                  <Button variant="outline" onClick={() => setStep(0)}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> 戻る
                  </Button>
                  <Button onClick={() => handleGenerate()} className="gradient-primary" disabled={isGenerating}>
                    {isGenerating ? (
                      <><Equalizer bars={3} className="mr-2" /> 生成中...</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-1" /> 生成する</>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 2 && result && (
              <motion.div key="s2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
                <ResultView
                  prompt={result}
                  isStreaming={isStreaming}
                  onUpdateLyrics={async (lyrics) => {
                    const updated = { ...result, lyrics };
                    setResult(updated);
                    await saveToHistory(updated);
                  }}
                  onToggleFavorite={async () => {
                    const newFavStatus = await toggleFavorite(result.id);
                    setResult((p) => p ? { ...p, isFavorite: newFavStatus } : p);
                  }}
                  onUpdatePrompt={async (updated) => {
                    setResult(updated);
                    await saveToHistory(updated);
                  }}
                />
                <div className="mt-4 flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> 設定に戻る
                  </Button>
                  <Button onClick={() => handleGenerate()} className="gradient-primary" disabled={isGenerating}>
                    <Sparkles className="w-4 h-4 mr-1" /> 再生成
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <HistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} onLoad={loadFromHistory} />

      <LoadingOverlay isVisible={isGenerating && !isStreaming} status={genStatus} />
    </div>
  );
}
