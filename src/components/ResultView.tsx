import { cn } from "@/lib/utils";
import { useState } from "react";
import { Copy, Check, Languages as LanguagesIcon, Star, ExternalLink, Image as ImageIcon, Loader2, Sparkles, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GeneratedPrompt, LANGUAGES, Language } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { translateLyrics, generateCoverArt, refineStyleTags } from "@/lib/stream-chat";
import { Equalizer } from "./Equalizer";
import { MVGeneratorModal } from "./MVGeneratorModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { refineLyrics as refineLyricsApi } from "@/lib/stream-chat";
import { ViralPredictor } from "./ViralPredictor";

interface Props {
  prompt: GeneratedPrompt;
  isStreaming: boolean;
  onUpdateLyrics: (lyrics: string) => Promise<void>;
  onToggleFavorite: () => Promise<void>;
  onUpdatePrompt: (prompt: GeneratedPrompt) => Promise<void>;
}

export function ResultView({ prompt, isStreaming, onUpdateLyrics, onToggleFavorite, onUpdatePrompt }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isRefiningLyrics, setIsRefiningLyrics] = useState(false);
  const [refinementFeedback, setRefinementFeedback] = useState("");
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isMVOpen, setIsMVOpen] = useState(false);
  const [isRefinePopoverOpen, setIsRefinePopoverOpen] = useState(false);

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

  const handleTranslate = async (targetLang: Language) => {
    setIsTranslating(true);
    try {
      const translation = await translateLyrics(prompt.lyrics, targetLang);
      await onUpdateLyrics(translation);
      toast({ title: "翻訳完了" });
    } catch (e) {
      toast({ title: "翻訳エラー", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIsTranslating(false);
    }
  };

  const handleRefineLyrics = async () => {
    if (!refinementFeedback.trim()) {
      toast({ title: "指示を入力してください", variant: "destructive" });
      return;
    }
    setIsRefiningLyrics(true);
    setIsRefinePopoverOpen(false);
    try {
      const refined = await refineLyricsApi(prompt.lyrics, refinementFeedback);
      await onUpdateLyrics(refined);
      toast({ title: "ブラッシュアップ完了" });
      setRefinementFeedback("");
    } catch (e) {
      toast({ title: "ブラッシュアップエラー", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIsRefiningLyrics(false);
    }
  };


  const handleOpenSuno = async () => {
    const styleWithMeta = `${prompt.styleTags}, ${prompt.meta.bpm}BPM, Key: ${prompt.meta.key}, ${prompt.meta.instruments}`;
    const full = `Style Tags: ${styleWithMeta} \n\n[Lyrics]\n${prompt.lyrics} `;
    await navigator.clipboard.writeText(full);
    toast({ title: "プロンプトをコピーしてSuno AIを開きます" });
    window.open("https://suno.com/create", "_blank");
  };

  const handleOpenMureka = async () => {
    const styleWithMeta = `${prompt.styleTags}, ${prompt.meta.bpm}BPM, Key: ${prompt.meta.key}, ${prompt.meta.instruments}`;
    const full = `Style Tags: ${styleWithMeta} \n\n[Lyrics]\n${prompt.lyrics} `;
    await navigator.clipboard.writeText(full);
    toast({ title: "プロンプトをコピーしてMureka AIを開きます" });
    window.open("https://mureka.ai/create", "_blank");
  };

  const [isImageLoading, setIsImageLoading] = useState(false);

  const handleGenerateCover = async () => {
    setIsGeneratingCover(true);
    setIsImageLoading(true);
    try {
      const imageUrl = await generateCoverArt(prompt.lyrics, prompt.styleTags);
      await onUpdatePrompt({ ...prompt, coverUrl: imageUrl });
      toast({ title: "カバー画像を生成開始しました" });
    } catch (e) {
      toast({ title: "画像生成エラー", description: (e as Error).message, variant: "destructive" });
      setIsImageLoading(false);
    } finally {
      setIsGeneratingCover(false);
    }
  };

  const handleRefinePrompt = async () => {
    if (!prompt.originalPrompt) {
      toast({ title: "説明を入力してください", variant: "destructive" });
      return;
    }
    setIsRefining(true);
    try {
      const refinedRaw = await refineStyleTags(prompt.originalPrompt);

      // ブラケット [] を除去し、カンマで分割してクリーンアップ
      const cleanTags = (text: string) => text.replace(/[[\]]/g, '').split(',').map(t => t.trim()).filter(t => t !== "");

      const existingTags = cleanTags(prompt.styleTags);
      const newTags = cleanTags(refinedRaw);

      // 結合して重複を排除
      const mergedTags = Array.from(new Set([...existingTags, ...newTags]));
      const finalStyleTags = mergedTags.join(", ");

      await onUpdatePrompt({ ...prompt, styleTags: finalStyleTags });
      toast({ title: "プロンプトをブラッシュアップしました" });
    } catch (e) {
      toast({ title: "変換エラー", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIsRefining(false);
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
          <div className="flex items-center justify-between gap-2 overflow-hidden bg-secondary/20 p-2 rounded-lg">
            <div className="flex items-center gap-2 shrink-0">
              <h2 className="text-lg sm:text-xl font-display font-semibold text-foreground">生成結果</h2>
              {isStreaming && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 animate-pulse">
                  <Equalizer bars={3} />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider">AI 執筆中...</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              <Button variant="ghost" size="sm" onClick={() => setIsMVOpen(true)} disabled={isStreaming} className="h-8 sm:h-9 glass px-2 sm:px-3 text-[10px] sm:text-xs text-primary border border-primary/30">
                <Film className="w-3.5 h-3.5 mr-1.5" />
                <span className="hidden xs:inline">MV生成</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleGenerateCover} disabled={isGeneratingCover || isStreaming} className="h-8 sm:h-9 glass px-2 sm:px-3 text-[10px] sm:text-xs">
                {isGeneratingCover ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5 mr-1.5" />}
                <span className="hidden xs:inline">画像生成</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={copyAll} className="h-8 sm:h-9 glass px-2 sm:px-3 text-[10px] sm:text-xs" title="一括コピー">
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                <span className="hidden xs:inline">コピー</span>
              </Button>
              <Button variant="ghost" size="icon" onClick={onToggleFavorite} className="h-8 w-8 sm:h-9 glass shrink-0">
                <Star className={cn("w-3.5 h-3.5", prompt.isFavorite && "fill-yellow-400 text-yellow-400")} />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end mt-1">
            <Button size="sm" onClick={handleOpenMureka} className="marble-mureka text-[10px] sm:text-xs h-8 sm:h-9 shrink-0 px-2.5 sm:px-4 rounded-full shadow-lg border-none">
              <ExternalLink className="w-3.5 h-3.5 mr-1" />
              <span>Murekaで作る</span>
            </Button>
            <Button size="sm" onClick={handleOpenSuno} className="marble-suno text-[10px] sm:text-xs h-8 sm:h-9 shrink-0 px-2.5 sm:px-4 rounded-full shadow-lg border-none">
              <ExternalLink className="w-3.5 h-3.5 mr-1" />
              <span>Sunoで作る</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Original Prompt Card (New) */}
          <div className="glass rounded-xl p-4 border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                オリジナルプロンプト
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefinePrompt}
                disabled={isRefining || isStreaming}
                className="h-8 text-[10px] sm:text-xs gap-1.5 hover:bg-primary/10 text-primary font-bold border border-primary/50 rounded-full px-4"
              >
                {isRefining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>ブラッシュアップ</span>
              </Button>
            </div>
            <Textarea
              placeholder="楽曲の雰囲気や構成を文章で入力してください... (例: 疾走感のある切ないボカロ曲、ピアノと重いベースの融合)"
              value={prompt.originalPrompt || ""}
              onChange={(e) => onUpdatePrompt({ ...prompt, originalPrompt: e.target.value })}
              className="min-h-[80px] bg-background/30 border-primary/10 text-sm focus-visible:ring-primary/30"
              disabled={isStreaming}
            />
          </div>

          {/* Cover Art Section */}
          {prompt.coverUrl && (
            <div className="glass rounded-2xl overflow-hidden aspect-square relative group">
              {isImageLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm">
                  <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                  <p className="text-[10px] font-medium text-muted-foreground animate-pulse">画像を読み込み中...</p>
                </div>
              )}
              <img
                src={prompt.coverUrl}
                alt="Cover Art"
                className={cn(
                  "w-full h-full object-cover transition-all duration-500 group-hover:scale-105",
                  isImageLoading ? "opacity-0 scale-95" : "opacity-100 scale-100"
                )}
                onLoad={() => setIsImageLoading(false)}
                onError={() => {
                  setIsImageLoading(false);
                  toast({ title: "画像の読み込みに失敗しました", variant: "destructive" });
                }}
              />
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
            <p className="font-mono text-sm text-accent leading-relaxed">{prompt.styleTags}</p>
          </div>

          {/* Meta */}
          <div className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-primary">メタ情報</h3>
              <CopyBtn text={`BPM: ${prompt.meta.bpm} | Key: ${prompt.meta.key} | Instruments: ${prompt.meta.instruments} `} label="メタ情報" />
            </div>
            <div className="flex gap-4 text-sm flex-wrap">
              <span className="text-muted-foreground">BPM: <span className="text-foreground font-mono">{prompt.meta.bpm}</span></span>
              <span className="text-muted-foreground">Key: <span className="text-foreground font-mono">{prompt.meta.key}</span></span>
              <span className="text-muted-foreground">楽器: <span className="text-foreground">{prompt.meta.instruments}</span></span>
            </div>
          </div>
        </div>

        {/* Lyrics */}
        <div className="space-y-6">
          {prompt.viralAnalysis && (
            <ViralPredictor analysis={prompt.viralAnalysis} />
          )}

          <div className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-primary">歌詞</h3>
              <div className="flex items-center gap-1">
                <Popover open={isRefinePopoverOpen} onOpenChange={setIsRefinePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" disabled={isRefiningLyrics || isStreaming} className="h-8 px-2 glass gap-1.5" title="歌詞をブラッシュアップ">
                      {isRefiningLyrics ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      <span className="text-[10px] sm:text-xs">ブラッシュアップ</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 glass border-primary/20 p-4">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm leading-none">歌詞への指示</h4>
                        <p className="text-xs text-muted-foreground">
                          「もっと韻を踏んで」「サビをドラマチックに」など、AIへの要望を入力してください。
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="例：もっとエモーショナルにして"
                          value={refinementFeedback}
                          onChange={(e) => setRefinementFeedback(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleRefineLyrics()}
                          className="bg-transparent border-primary/20 h-9"
                        />
                        <Button size="sm" onClick={handleRefineLyrics} disabled={isRefiningLyrics}>
                          実行
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" disabled={isTranslating || isStreaming} className="h-8 px-2 glass gap-1.5" title="言語を変更">
                      {isTranslating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LanguagesIcon className="w-3.5 h-3.5" />}
                      <span className="text-[10px] sm:text-xs">翻訳</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40 glass border-primary/20">
                    {LANGUAGES.map((lang) => (
                      <DropdownMenuItem
                        key={lang.id}
                        onClick={() => handleTranslate(lang.id)}
                        className="gap-2 cursor-pointer hover:bg-primary/10"
                      >
                        <span>{lang.icon}</span>
                        <span>{lang.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
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

        {/* MV Generator Modal */}
        <MVGeneratorModal prompt={prompt} open={isMVOpen} onOpenChange={setIsMVOpen} />
      </div>
    </div>
  );
}
