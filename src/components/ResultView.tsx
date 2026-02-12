import { cn } from "@/lib/utils";
import { useState } from "react";
import { Copy, Check, Languages, Star, ExternalLink, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GeneratedPrompt } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { translateLyrics, generateCoverArt } from "@/lib/stream-chat";
import { Equalizer } from "./Equalizer";

interface Props {
  prompt: GeneratedPrompt;
  isStreaming: boolean;
  onUpdateLyrics: (lyrics: string) => void;
  onToggleFavorite: () => void;
  onUpdatePrompt: (prompt: GeneratedPrompt) => void;
}

export function ResultView({ prompt, isStreaming, onUpdateLyrics, onToggleFavorite, onUpdatePrompt }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);

  const copyText = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    toast({ title: `${label} をコピーしました` });
    setTimeout(() => setCopied(null), 2000);
  };

  const copyAll = () => {
    const full = `Style Tags: ${prompt.styleTags} \n\nBPM: ${prompt.meta.bpm} | Key: ${prompt.meta.key} | Instruments: ${prompt.meta.instruments} \n\n${prompt.lyrics} `;
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


  const handleOpenSuno = async () => {
    const full = `Style Tags: ${prompt.styleTags} \n\n[Lyrics]\n${prompt.lyrics} `;
    await navigator.clipboard.writeText(full);
    toast({ title: "プロンプトをコピーしてSuno AIを開きます" });
    window.open("https://suno.com/create", "_blank");
  };

  const handleGenerateCover = async () => {
    setIsGeneratingCover(true);
    try {
      const imageUrl = await generateCoverArt(prompt.lyrics, prompt.styleTags);
      onUpdatePrompt({ ...prompt, coverUrl: imageUrl });
      toast({ title: "カバー画像を生成しました" });
    } catch (e) {
      toast({ title: "画像生成エラー", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIsGeneratingCover(false);
    }
  };

  const CopyBtn = ({ text, label }: { text: string; label: string }) => (
    <Button variant="ghost" size="icon" onClick={() => copyText(text, label)} className="h-8 w-8">
      {copied === label ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
    </Button>
  );

  return (
    <div className="space-y-6 pb-2">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2 overflow-hidden">
            <div className="flex items-center gap-2 shrink-0">
              <h2 className="text-lg sm:text-xl font-display font-semibold text-foreground">生成結果</h2>
              {isStreaming && <Equalizer bars={3} />}
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <Button variant="ghost" size="icon" onClick={handleTranslate} disabled={isTranslating || isStreaming} className="h-8 w-8 sm:h-9 sm:w-9 glass shrink-0" title={prompt.config.language === "ja" ? "英訳" : "和訳"}>
                <Languages className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onToggleFavorite} className="h-8 w-8 sm:h-9 sm:w-9 glass shrink-0">
                <Star className={cn("w-4 h-4", prompt.isFavorite && "fill-yellow-400 text-yellow-400")} />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 justify-end">
            <Button variant="ghost" size="sm" onClick={handleGenerateCover} disabled={isGeneratingCover || isStreaming} className="h-8 sm:h-9 glass px-2 sm:px-3 text-[10px] sm:text-xs">
              {isGeneratingCover ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5 mr-1.5" />}
              <span>画像生成</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={copyAll} className="h-8 sm:h-9 glass px-2 sm:px-3 text-[10px] sm:text-xs" title="一括コピー">
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              <span>コピー</span>
            </Button>
            <Button size="sm" onClick={handleOpenSuno} className="marble-suno text-[10px] sm:text-xs h-8 sm:h-9 shrink-0 px-2.5 sm:px-4 rounded-full shadow-lg">
              <ExternalLink className="w-3.5 h-3.5 mr-1" />
              <span>Sunoで作る</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Cover Art Section */}
          {prompt.coverUrl && (
            <div className="glass rounded-2xl overflow-hidden aspect-square relative group">
              <img src={prompt.coverUrl} alt="Cover Art" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                <Button variant="secondary" size="sm" className="glass" onClick={() => window.open(prompt.coverUrl, "_blank")}>
                  <ExternalLink className="w-4 h-4 mr-2" /> 拡大
                </Button>
              </div>
            </div>
          )}

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
              <CopyBtn text={`BPM: ${prompt.meta.bpm} | Key: ${prompt.meta.key} | Instruments: ${prompt.meta.instruments} `} label="メタ情報" />
            </div>
            <div className="flex gap-4 text-sm">
              <span className="text-muted-foreground">BPM: <span className="text-foreground">{prompt.meta.bpm}</span></span>
              <span className="text-muted-foreground">Key: <span className="text-foreground">{prompt.meta.key}</span></span>
              <span className="text-muted-foreground">楽器: <span className="text-foreground">{prompt.meta.instruments}</span></span>
            </div>
          </div>
        </div>

        {/* Lyrics */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-primary">歌詞</h3>
            <div className="flex items-center gap-1">
              <CopyBtn text={prompt.lyrics} label="歌詞" />
            </div>
          </div>
          <Textarea
            value={prompt.lyrics}
            onChange={(e) => onUpdateLyrics(e.target.value)}
            className="min-h-[500px] bg-transparent border-none resize-none text-sm leading-relaxed focus-visible:ring-0 text-foreground/90 font-sans"
            disabled={isStreaming}
          />
        </div>
      </div>
    </div>
  );
}
