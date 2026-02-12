import { useState, useCallback } from "react";
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
import {
  MusicConfig, GeneratedPrompt, DEFAULT_CONFIG, GENRES, MOODS, THEMES,
} from "@/lib/types";
import { generateLyrics } from "@/lib/stream-chat";
import { saveToHistory, toggleFavorite } from "@/lib/storage";

export default function Index() {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<MusicConfig>({ ...DEFAULT_CONFIG });
  const [result, setResult] = useState<GeneratedPrompt | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

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
      language: Math.random() > 0.5 ? "ja" : "en",
      duration: (["30s", "1min", "2min", "3min+"] as const)[Math.floor(Math.random() * 4)],
    });
    setStep(2);
    handleGenerate({
      genres: rGenres, mood: rMood, tempo: "custom", bpm,
      themes: rThemes, customTheme: "", language: Math.random() > 0.5 ? "ja" : "en",
      duration: (["30s", "1min", "2min", "3min+"] as const)[Math.floor(Math.random() * 4)],
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
    setStep(2);

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
      const fullText = await generateLyrics(
        {
          genres: c.genres,
          mood: c.mood,
          tempo: c.tempo,
          bpm: c.bpm,
          themes: c.themes,
          customTheme: c.customTheme,
          language: c.language,
          duration: c.duration,
        },
        (delta) => {
          setResult((prev) => prev ? { ...prev, lyrics: prev.lyrics + delta } : prev);
        },
        () => setIsStreaming(false)
      );

      // Parse the full text to extract structured data
      const parsed = parseGeneratedText(fullText, c);
      setResult((prev) => prev ? { ...prev, ...parsed } : prev);
      saveToHistory({ ...newPrompt, ...parsed });
    } catch (e) {
      toast({ title: "エラー", description: (e as Error).message, variant: "destructive" });
      setIsStreaming(false);
    } finally {
      setIsGenerating(false);
    }
  }, [config]);

  const parseGeneratedText = (text: string, cfg: MusicConfig): Partial<GeneratedPrompt> => {
    // Try to extract style tags, meta, and lyrics from AI output
    const styleMatch = text.match(/\[STYLE(?:\s*TAGS?)?\]\s*([\s\S]*?)(?:\n\[|$)/i)
      || text.match(/Style\s*Tags?:\s*(.*?)(?:\n|$)/i);
    const bpmMatch = text.match(/BPM:\s*(\d+)/i);
    const keyMatch = text.match(/Key:\s*([A-Ga-g][#b]?\s*(?:major|minor|maj|min)?)/i);
    const instrMatch = text.match(/Instruments?:\s*(.*?)(?:\n|$)/i);
    const lyricsMatch = text.match(/\[LYRICS?\]\s*([\s\S]*)/i)
      || text.match(/歌詞[：:]\s*([\s\S]*)/i);

    const genreLabels = cfg.genres.map((g) => GENRES.find((x) => x.id === g)?.labelEn || g);
    const moodLabel = MOODS.find((m) => m.id === cfg.mood)?.labelEn || cfg.mood;

    return {
      styleTags: styleMatch?.[1]?.trim() || `[${genreLabels.join(", ")}, ${moodLabel.toLowerCase()}]`,
      meta: {
        bpm: bpmMatch ? parseInt(bpmMatch[1]) : cfg.bpm,
        key: keyMatch?.[1]?.trim() || "C major",
        instruments: instrMatch?.[1]?.trim() || genreLabels.join(", ") + " instruments",
      },
      lyrics: lyricsMatch?.[1]?.trim() || text,
    };
  };

  const loadFromHistory = (prompt: GeneratedPrompt) => {
    setResult(prompt);
    setConfig(prompt.config);
    setStep(2);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: "1.5s" }} />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border">
        <div className="container max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl gradient-primary flex items-center justify-center shrink-0">
              <Music className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm sm:text-lg font-display font-bold gradient-text">MusicAI Prompt Studio</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">音楽プロンプトジェネレーター</p>
            </div>
          </div>
          <div className="flex gap-1 sm:gap-2">
            <Link to="/analysis">
              <Button variant="ghost" size="sm" className="px-2 sm:px-3 h-8 sm:h-9">
                <AudioWaveform className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1" />
                <span className="hidden sm:inline">分析スタジオ</span>
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={randomize} disabled={isGenerating} className="px-2 sm:px-3 h-8 sm:h-9">
              <Shuffle className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1" />
              <span className="hidden sm:inline">ランダム</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} className="px-2 sm:px-3 h-8 sm:h-9">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1" />
              <span className="hidden sm:inline">履歴</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 container max-w-4xl mx-auto px-4 py-8">
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
              <div className="mt-8 flex justify-between">
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
                onUpdateLyrics={(lyrics) => setResult((p) => p ? { ...p, lyrics } : p)}
                onToggleFavorite={() => {
                  const newFav = toggleFavorite(result.id);
                  setResult((p) => p ? { ...p, isFavorite: newFav } : p);
                }}
              />
              <div className="mt-8 flex justify-between">
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
      </main>

      <HistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} onLoad={loadFromHistory} />
    </div>
  );
}
