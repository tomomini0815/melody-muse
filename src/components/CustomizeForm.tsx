import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { MusicConfig, MOODS, THEMES, Tempo, Language, Duration, ARTISTS } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Sun, Moon, Zap, Feather, CloudRain, Sparkles, User, Globe, Languages, Search,
} from "lucide-react";

const moodIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Sun, Moon, Zap, Feather, CloudRain, Sparkles,
};

const tempoOptions: { id: Tempo; label: string }[] = [
  { id: "slow", label: "遅い" },
  { id: "normal", label: "普通" },
  { id: "fast", label: "速い" },
  { id: "custom", label: "BPM指定" },
];

const durationOptions: { id: Duration; label: string }[] = [
  { id: "30s", label: "30秒" },
  { id: "1min", label: "1分" },
  { id: "2min", label: "2分" },
  { id: "3min+", label: "3分以上" },
];

interface Props {
  config: MusicConfig;
  onChange: (config: MusicConfig) => void;
}

export function CustomizeForm({ config, onChange }: Props) {
  const [artistCategory, setArtistCategory] = useState<"japanese" | "global">("japanese");
  const [searchTerm, setSearchTerm] = useState("");
  const update = (partial: Partial<MusicConfig>) => onChange({ ...config, ...partial });

  return (
    <div className="space-y-8">
      {/* Mood */}
      <div>
        <h3 className="text-lg font-display font-semibold mb-3">ムード</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {MOODS.map((m) => {
            const Icon = moodIcons[m.icon] || Sun;
            return (
              <button
                key={m.id}
                onClick={() => update({ mood: m.id })}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                  config.mood === m.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/40"
                )}
              >
                <Icon className={cn("w-5 h-5", config.mood === m.id ? "text-primary" : "text-muted-foreground")} />
                <span className="text-xs">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tempo */}
      <div>
        <h3 className="text-lg font-display font-semibold mb-3">テンポ</h3>
        <div className="flex gap-2 flex-wrap mb-3">
          {tempoOptions.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                const bpmMap: Record<string, number> = { slow: 80, normal: 120, fast: 150 };
                update({ tempo: t.id, bpm: bpmMap[t.id] || config.bpm });
              }}
              className={cn(
                "px-4 py-2 rounded-lg border text-sm transition-all",
                config.tempo === t.id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {config.tempo === "custom" && (
          <div className="flex items-center gap-4">
            <Slider
              value={[config.bpm]}
              onValueChange={([v]) => update({ bpm: v })}
              min={60}
              max={200}
              step={1}
              className="flex-1"
            />
            <span className="text-sm font-mono text-primary w-16 text-right">{config.bpm} BPM</span>
          </div>
        )}
      </div>

      {/* Theme */}
      <div>
        <h3 className="text-lg font-display font-semibold mb-3">テーマ / トピック</h3>
        <div className="flex gap-2 flex-wrap mb-3">
          {THEMES.map((t) => {
            const isSelected = config.themes.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() =>
                  update({
                    themes: isSelected
                      ? config.themes.filter((x) => x !== t.id)
                      : [...config.themes, t.id],
                  })
                }
                className={cn(
                  "px-3 py-1.5 rounded-full border text-sm transition-all",
                  isSelected
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted-foreground hover:border-accent/40"
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <Input
          placeholder="自由にテーマを入力..."
          value={config.customTheme}
          onChange={(e) => update({ customTheme: e.target.value })}
          className="bg-secondary border-border"
        />
      </div>

      {/* Artists */}
      <div className="glass-card rounded-2xl p-6 border-primary/10 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-50" />

        <div className="relative z-10">
          <div className="flex flex-col gap-6 mb-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-lg font-display font-semibold flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  アーティストスタイル <span className="text-muted-foreground text-sm font-normal">(任意)</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  有名なアーティストのスタイルを参考にします（※あくまでスタイル模倣です）
                </p>
              </div>

              {/* Artist Category Tabs (Matching Requested Design) */}
              <div className="inline-flex p-1.5 bg-card/40 backdrop-blur-md rounded-[32px] border border-border/50 relative overflow-hidden h-[46px]">
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-y-1.5 bg-primary rounded-[28px]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  animate={{
                    left: artistCategory === "japanese" ? "6px" : "calc(50% + 1px)",
                  }}
                  style={{
                    width: "calc(50% - 7px)"
                  }}
                />
                <button
                  onClick={() => setArtistCategory("japanese")}
                  className={cn(
                    "relative z-10 px-6 py-2 flex items-center gap-2 text-sm font-medium transition-colors duration-300 rounded-[28px] min-w-[120px] justify-center",
                    artistCategory === "japanese" ? "text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Languages className="w-4 h-4" />
                  Japanese
                </button>
                <button
                  onClick={() => setArtistCategory("global")}
                  className={cn(
                    "relative z-10 px-6 py-2 flex items-center gap-2 text-sm font-medium transition-colors duration-300 rounded-[28px] min-w-[120px] justify-center",
                    artistCategory === "global" ? "text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Globe className="w-4 h-4" />
                  Global
                </button>
              </div>
            </div>

            {/* Custom Input (Search box removed, this is the free input field) */}
            <div className="relative group/custom w-full max-w-2xl mx-auto">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-accent/20 rounded-xl blur opacity-0 group-focus-within/custom:opacity-100 transition duration-500" />
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/70" />
                <Input
                  placeholder="その他のアーティスト名・スタイルを自由入力..."
                  value={config.customArtist}
                  onChange={(e) => {
                    update({
                      customArtist: e.target.value,
                      artist: e.target.value ? "" : config.artist
                    });
                  }}
                  className="pl-10 bg-card/50 border-primary/20 focus:border-primary/50 transition-all placeholder:text-muted-foreground/50"
                />
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`${artistCategory}-${searchTerm}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex gap-2.5 flex-wrap min-h-[60px]"
            >
              {ARTISTS.filter(a =>
                a.category === artistCategory &&
                (searchTerm === "" || a.label.toLowerCase().includes(searchTerm.toLowerCase()))
              ).map((artist) => {
                const isSelected = config.artist === artist.id;
                return (
                  <button
                    key={artist.id}
                    onClick={() => update({
                      artist: isSelected ? "" : artist.id,
                      customArtist: ""
                    })}
                    className={cn(
                      "px-4 py-2 rounded-xl border text-sm transition-all relative overflow-hidden group/btn",
                      isSelected
                        ? "border-primary bg-primary/20 text-primary font-bold shadow-[0_0_20px_rgba(251,191,36,0.2)]"
                        : "border-border/50 bg-card/40 backdrop-blur-md text-muted-foreground hover:border-primary/40 hover:bg-card/60 hover:text-foreground"
                    )}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="selectedArtist"
                        className="absolute inset-0 bg-primary/5"
                        initial={false}
                      />
                    )}
                    <span className="relative z-10">{artist.label}</span>
                  </button>
                );
              })}
              {searchTerm !== "" && ARTISTS.filter(a =>
                a.category === artistCategory &&
                a.label.toLowerCase().includes(searchTerm.toLowerCase())
              ).length === 0 && (
                  <div className="w-full py-4 text-center space-y-3">
                    <p className="text-sm text-muted-foreground italic">一致するアーティストが見つかりません</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        update({ customArtist: searchTerm, artist: "" });
                        setSearchTerm("");
                      }}
                      className="border-primary/30 hover:bg-primary/10 gap-2"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      「{searchTerm}」をカスタムスタイルとして登録する
                    </Button>
                  </div>
                )}
            </motion.div>
          </AnimatePresence>

          {/* Active Status for Custom Artist */}
          {config.customArtist && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-4 p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-bold text-primary">カスタムスタイル有効:</span>
                <span className="text-xs text-foreground truncate max-w-[150px]">{config.customArtist}</span>
              </div>
              <button
                onClick={() => update({ customArtist: "" })}
                className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
              >
                解除
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Language & Duration */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-display font-semibold mb-3">言語</h3>
          <div className="flex gap-2">
            {(["ja", "en"] as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => update({ language: lang })}
                className={cn(
                  "flex-1 py-2 rounded-lg border text-sm transition-all",
                  config.language === lang
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/40"
                )}
              >
                {lang === "ja" ? "🇯🇵 日本語" : "🇺🇸 English"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-lg font-display font-semibold mb-3">曲の長さ</h3>
          <div className="flex gap-2">
            {durationOptions.map((d) => (
              <button
                key={d.id}
                onClick={() => update({ duration: d.id })}
                className={cn(
                  "flex-1 py-2 rounded-lg border text-xs sm:text-sm transition-all",
                  config.duration === d.id
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/40"
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
