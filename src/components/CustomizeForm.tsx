import { cn } from "@/lib/utils";
import { MusicConfig, MOODS, THEMES, Tempo, Language, Duration, ARTISTS } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Sun, Moon, Zap, Feather, CloudRain, Sparkles, User,
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
      <div>
        <h3 className="text-lg font-display font-semibold mb-3">
          <span className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            アーティストスタイル (任意)
          </span>
        </h3>
        <p className="text-sm text-muted-foreground mb-3">
          有名なアーティストのスタイルを参考にします（※あくまでスタイル模倣です）
        </p>

        <div className="space-y-4">
          {/* Global Artists */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Global</h4>
            <div className="flex gap-2 flex-wrap">
              {ARTISTS.filter(a => a.category === "global").map((artist) => {
                const isSelected = config.artist === artist.id;
                return (
                  <button
                    key={artist.id}
                    onClick={() => update({ artist: isSelected ? "" : artist.id })}
                    className={cn(
                      "px-3 py-1.5 rounded-full border text-sm transition-all relative overflow-hidden",
                      isSelected
                        ? "border-primary bg-primary/20 text-primary-foreground font-medium shadow-[0_0_15px_rgba(251,191,36,0.3)]"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    {isSelected && (
                      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" style={{ transform: 'skewX(-20deg)' }} />
                    )}
                    {artist.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Japanese Artists */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Japanese</h4>
            <div className="flex gap-2 flex-wrap">
              {ARTISTS.filter(a => a.category === "japanese").map((artist) => {
                const isSelected = config.artist === artist.id;
                return (
                  <button
                    key={artist.id}
                    onClick={() => update({ artist: isSelected ? "" : artist.id })}
                    className={cn(
                      "px-3 py-1.5 rounded-full border text-sm transition-all relative overflow-hidden",
                      isSelected
                        ? "border-primary bg-primary/20 text-primary-foreground font-medium shadow-[0_0_15px_rgba(251,191,36,0.3)]"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    {isSelected && (
                      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" style={{ transform: 'skewX(-20deg)' }} />
                    )}
                    {artist.label}
                  </button>
                );
              })}
            </div>
          </div>
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
