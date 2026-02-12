import { useState } from "react";
import { Copy, Check, Languages, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GeneratedPrompt } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { translateLyrics } from "@/lib/stream-chat";
import { Equalizer } from "./Equalizer";

interface Props {
  prompt: GeneratedPrompt;
  isStreaming: boolean;
  onUpdateLyrics: (lyrics: string) => void;
  onToggleFavorite: () => void;
}

export function ResultView({ prompt, isStreaming, onUpdateLyrics, onToggleFavorite }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const copyText = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    toast({ title: `${label}をコピーしました` });
    setTimeout(() => setCopied(null), 2000);
  };

  const copyAll = () => {
    const full = `Style Tags: ${prompt.styleTags}\n\nBPM: ${prompt.meta.bpm} | Key: ${prompt.meta.key} | Instruments: ${prompt.meta.instruments}\n\n${prompt.lyrics}`;
    copyText(full, "全体");
  };

  const handleTranslate = async () => {
    setIsTranslating(true);
    try {
      const targetLang = prompt.config.language === "ja" ? "en" : "ja";
      const translation = await translateLyrics(prompt.lyrics, targetLang);
      onUpdateLyrics(translation);
      toast({ title: "翻訳完了" });
    } catch (e) {
      toast({ title: "翻訳エラー", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIsTranslating(false);
    }
  };

  const CopyBtn = ({ text, label }: { text: string; label: string }) => (
    <Button variant="ghost" size="icon" onClick={() => copyText(text, label)} className="h-8 w-8">
      {copied === label ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-display font-semibold">生成結果</h2>
          {isStreaming && <Equalizer bars={4} />}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleTranslate} disabled={isTranslating || isStreaming}>
            <Languages className="w-4 h-4 mr-1" />
            {isTranslating ? "翻訳中..." : prompt.config.language === "ja" ? "英訳" : "和訳"}
          </Button>
          <Button variant="outline" size="sm" onClick={onToggleFavorite}>
            <Star className={`w-4 h-4 mr-1 ${prompt.isFavorite ? "fill-yellow-400 text-yellow-400" : ""}`} />
            {prompt.isFavorite ? "お気に入り済" : "お気に入り"}
          </Button>
          <Button size="sm" onClick={copyAll} className="gradient-primary">
            <Copy className="w-4 h-4 mr-1" /> 一括コピー
          </Button>
        </div>
      </div>

      {/* Style Tags */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-primary">Style Tags</h3>
          <CopyBtn text={prompt.styleTags} label="スタイルタグ" />
        </div>
        <p className="font-mono text-sm text-accent">{prompt.styleTags}</p>
      </div>

      {/* Meta */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-primary">メタ情報</h3>
          <CopyBtn text={`BPM: ${prompt.meta.bpm} | Key: ${prompt.meta.key} | Instruments: ${prompt.meta.instruments}`} label="メタ情報" />
        </div>
        <div className="flex gap-4 text-sm">
          <span className="text-muted-foreground">BPM: <span className="text-foreground">{prompt.meta.bpm}</span></span>
          <span className="text-muted-foreground">Key: <span className="text-foreground">{prompt.meta.key}</span></span>
          <span className="text-muted-foreground">楽器: <span className="text-foreground">{prompt.meta.instruments}</span></span>
        </div>
      </div>

      {/* Lyrics */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-primary">歌詞</h3>
          <CopyBtn text={prompt.lyrics} label="歌詞" />
        </div>
        <Textarea
          value={prompt.lyrics}
          onChange={(e) => onUpdateLyrics(e.target.value)}
          className="min-h-[300px] bg-transparent border-none resize-none text-sm leading-relaxed focus-visible:ring-0"
          disabled={isStreaming}
        />
      </div>
    </div>
  );
}
