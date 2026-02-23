import { ViralAnalysis } from "@/lib/types";
import { Zap, TrendingUp, Lightbulb, Star, Sparkles, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { Button } from "./ui/button";

interface Props {
    analysis: ViralAnalysis;
    onOptimize?: () => Promise<void>;
    isOptimizing?: boolean;
}

export function ViralPredictor({ analysis, onOptimize, isOptimizing }: Props) {
    const stars = Math.round(analysis.score / 20);

    return (
        <div className="glass rounded-xl p-5 border-primary/20 bg-secondary/10 space-y-6 relative overflow-hidden">
            {/* Decorative background element */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-sm font-semibold text-primary flex items-center gap-2 mb-1">
                        <Zap className="w-4 h-4 fill-primary" />
                        バズ予測スコア
                    </h3>
                    <div className="flex items-center gap-3">
                        <span className="text-3xl font-display font-bold gradient-text">
                            {analysis.score}%
                        </span>
                        <div className="flex gap-0.5">
                            {[...Array(5)].map((_, i) => (
                                <Star
                                    key={i}
                                    className={`w-4 h-4 ${i < stars ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {onOptimize && (
                        <Button
                            size="sm"
                            onClick={onOptimize}
                            disabled={isOptimizing}
                            className="gradient-primary h-9 px-4 rounded-full shadow-lg border-none hover:scale-105 transition-transform group"
                        >
                            {isOptimizing ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Sparkles className="w-4 h-4 mr-2 group-hover:animate-pulse" />
                            )}
                            <span className="text-xs font-bold tracking-tight text-white">バズり最適化を実行</span>
                        </Button>
                    )}

                    <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        <p className="text-[10px] font-medium leading-tight text-foreground">
                            <span className="text-primary block uppercase text-[8px] tracking-wider mb-0.5 font-bold">Market View</span>
                            {analysis.marketTrend}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                    <div className="flex justify-between text-[11px] font-medium">
                        <span className="text-muted-foreground font-display">キャッチーメロディ</span>
                        <span className="text-foreground">{analysis.breakdown.melody}点</span>
                    </div>
                    <Progress value={analysis.breakdown.melody} className="h-1.5 bg-background/50" />
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between text-[11px] font-medium">
                        <span className="text-muted-foreground font-display">歌詞の共感性</span>
                        <span className="text-foreground">{analysis.breakdown.empathy}点</span>
                    </div>
                    <Progress value={analysis.breakdown.empathy} className="h-1.5 bg-background/50" />
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between text-[11px] font-medium">
                        <span className="text-muted-foreground font-display">トレンド適合</span>
                        <span className="text-foreground">{analysis.breakdown.trend}点</span>
                    </div>
                    <Progress value={analysis.breakdown.trend} className="h-1.5 bg-background/50" />
                </div>
            </div>

            <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-primary flex items-center gap-2">
                    <Lightbulb className="w-3.5 h-3.5" />
                    AIからの改善提案
                </h4>
                <div className="space-y-2">
                    {analysis.suggestions.map((suggestion, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="flex items-start gap-2.5 bg-background/40 p-2.5 rounded-lg border border-primary/10"
                        >
                            <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {suggestion}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
            <p className="text-[10px] text-muted-foreground italic mt-4 opacity-70">
                *Based on Suno, Udio, and Mureka success patterns.
            </p>
        </div>
    );
}
