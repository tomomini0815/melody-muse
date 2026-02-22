import { useState } from "react";
import { GeneratedPrompt } from "@/lib/types";
import { MVCanvasPreview } from "./MVCanvasPreview";
import { MVImageSequence } from "./MVImageSequence";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Film, Palette } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface Props {
    prompt: GeneratedPrompt;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const MV_STYLES = [
    { id: "cinematic", label: "シネマティック", icon: "🎬" },
    { id: "anime", label: "アニメーション", icon: "✨" },
    { id: "cyberpunk", label: "サイバーパンク", icon: "🌃" },
    { id: "3d-render", label: "3Dレンダー", icon: "🧊" },
    { id: "oil-painting", label: "油絵風", icon: "🎨" },
    { id: "pixel-art", label: "ピクセルアート", icon: "👾" },
    { id: "vaporwave", label: "ヴェイパーウェイヴ", icon: "🌸" },
];

export function MVGeneratorModal({ prompt, open, onOpenChange }: Props) {
    const [activeTab, setActiveTab] = useState("animation");
    const [artStyle, setArtStyle] = useState("cinematic");

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto glass border-primary/20 p-0">
                <DialogHeader className="p-5 pb-0">
                    <DialogTitle className="flex items-center gap-2 text-lg font-display">
                        <Film className="w-5 h-5 text-primary" />
                        MV ジェネレーター
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="px-5 pb-5">
                    <TabsList className="grid w-full grid-cols-2 mb-4 glass border-primary/20">
                        <TabsTrigger value="animation" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/20">
                            <Sparkles className="w-4 h-4" />
                            歌詞アニメーション
                        </TabsTrigger>
                        <TabsTrigger value="cinematic" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/20">
                            <Film className="w-4 h-4" />
                            シネマティックMV（開発中）
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="animation" className="mt-0">
                        <p className="text-xs text-muted-foreground mb-3">
                            歌詞にパーティクルエフェクトとアニメーションを付けたMVを生成します。即座にプレビュー＆ダウンロード可能です。
                        </p>
                        <MVCanvasPreview
                            lyrics={prompt.lyrics}
                            mood={prompt.config.mood}
                            bpm={prompt.meta.bpm}
                            coverUrl={prompt.coverUrl}
                            styleTags={prompt.styleTags}
                        />
                    </TabsContent>

                    <TabsContent value="cinematic" className="mt-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                            <p className="text-xs text-muted-foreground">
                                各セクションごとにAI画像を生成し、映画的なMVを作ります。
                            </p>

                            <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 uppercase tracking-wider">
                                    <Palette className="w-3 h-3" />
                                    スタイル:
                                </span>
                                <Select value={artStyle} onValueChange={setArtStyle}>
                                    <SelectTrigger className="w-[140px] h-8 text-xs glass border-primary/20">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="glass border-primary/20">
                                        {MV_STYLES.map((style) => (
                                            <SelectItem key={style.id} value={style.id} className="text-xs focus:bg-primary/20 cursor-pointer">
                                                {style.icon} {style.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <MVImageSequence
                            lyrics={prompt.lyrics}
                            mood={prompt.config.mood}
                            bpm={prompt.meta.bpm}
                            styleTags={prompt.styleTags}
                            coverUrl={prompt.coverUrl}
                            artStyle={artStyle}
                        />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
