import { motion } from "framer-motion";
import { Sparkles, Music, AudioWaveform } from "lucide-react";
import { Equalizer } from "./Equalizer";
import { cn } from "@/lib/utils";
import { GenerationStatus } from "@/lib/types";

interface LoadingOverlayProps {
    status: GenerationStatus;
    isVisible: boolean;
}

const statusMessages: Record<GenerationStatus, { title: string; subtitle: string; icon: any }> = {
    idle: { title: "", subtitle: "", icon: Sparkles },
    analyzing: {
        title: "スタイルを分析中...",
        subtitle: "ジャンルとムードを組み合わせています",
        icon: AudioWaveform
    },
    crafting: {
        title: "歌詞を構成中...",
        subtitle: "Gemini AIが響きとリズムを紡いでいます",
        icon: Music
    },
    styling: {
        title: "メタデータを生成中...",
        subtitle: "BPM、キー、楽器構成を決定しています",
        icon: Sparkles
    },
    finalizing: {
        title: "最終調整中...",
        subtitle: "最高の結果をお届けする準備をしています",
        icon: Sparkles
    }
};

export function LoadingOverlay({ status, isVisible }: LoadingOverlayProps) {
    if (!isVisible || status === "idle") return null;

    const current = statusMessages[status];
    const Icon = current.icon;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-md"
        >
            <div className="max-w-md w-full px-8 flex flex-col items-center text-center space-y-8">
                {/* Animated Icon Container */}
                <div className="relative">
                    <motion.div
                        animate={{
                            scale: [1, 1.1, 1],
                            rotate: [0, 5, -5, 0],
                        }}
                        transition={{
                            duration: 4,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="w-24 h-24 rounded-3xl gradient-primary flex items-center justify-center shadow-2xl shadow-primary/40 relative z-10"
                    >
                        <Icon className="w-12 h-12 text-primary-foreground" />
                    </motion.div>

                    {/* Decorative ripples */}
                    <div className="absolute inset-0 -z-10">
                        {[1, 2, 3].map((i) => (
                            <motion.div
                                key={i}
                                initial={{ scale: 0.8, opacity: 0.5 }}
                                animate={{ scale: 2.2, opacity: 0 }}
                                transition={{
                                    duration: 2,
                                    delay: i * 0.4,
                                    repeat: Infinity,
                                    ease: "easeOut"
                                }}
                                className="absolute inset-0 rounded-3xl bg-primary/20"
                            />
                        ))}
                    </div>
                </div>

                {/* Status Text Area */}
                <div className="space-y-3">
                    <motion.h2
                        key={current.title}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-2xl font-display font-bold gradient-text"
                    >
                        {current.title}
                    </motion.h2>
                    <motion.p
                        key={current.subtitle}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-muted-foreground text-sm"
                    >
                        {current.subtitle}
                    </motion.p>
                </div>

                {/* Dynamic Equalizer or Progress */}
                <div className="pt-4">
                    <Equalizer bars={8} className="scale-150 h-12" />
                </div>

                {/* Tips / Trivia (Randomized or Static) */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="p-4 rounded-2xl bg-secondary/50 border border-border/50 text-xs text-muted-foreground/80 italic max-w-sm"
                >
                    💡 Suno AIでは、[Style]タグを使って音楽性をより詳細に指定できます。
                </motion.div>
            </div>
        </motion.div>
    );
}
