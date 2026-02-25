import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    CREATOR_CATEGORIES,
    CreatorCategory,
    Step2Option,
    Step3Option
} from "@/lib/creator-templates";
import { MusicConfig } from "@/lib/types";
import {
    Video, Gamepad2, Mic, Briefcase, PartyPopper, Heart, GraduationCap, Palette, Tv, Radio,
    ChevronRight, ArrowLeft, Check, Sparkles
} from "lucide-react";

// Map icon strings to components
const iconMap: Record<string, any> = {
    Video, Gamepad2, Mic, Briefcase, PartyPopper, Heart, GraduationCap, Palette, Tv, Radio
};

interface Props {
    config: MusicConfig;
    onChange: (config: MusicConfig) => void;
}

export function CreatorWorkflow({ config, onChange }: Props) {
    const [step, setStep] = useState(1);
    const [selectedCat, setSelectedCat] = useState<CreatorCategory | null>(
        CREATOR_CATEGORIES.find(c => c.id === config.creatorCategory) || null
    );

    const update = (partial: Partial<MusicConfig>) => onChange({ ...config, ...partial });

    const handleSelectCategory = (cat: CreatorCategory) => {
        setSelectedCat(cat);
        update({
            creatorCategory: cat.id,
            creatorSubCategory: undefined,
            creatorScene: undefined
        });
        setStep(2);
    };

    const handleSelectSubCategory = (opt: Step2Option) => {
        update({
            creatorSubCategory: opt.id,
            ...opt.defaultConfig
        });
        setStep(3);
    };

    const handleSelectScene = (opt: Step3Option) => {
        update({
            creatorScene: opt.id,
            ...opt.defaultConfig
        });
        // Stay on step 3 for final adjustments or provide feedback
    };

    const reset = () => {
        setStep(1);
        setSelectedCat(null);
        update({
            creatorCategory: undefined,
            creatorSubCategory: undefined,
            creatorScene: undefined
        });
    };

    return (
        <div className="glass-card rounded-2xl p-6 border-accent/20 bg-accent/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
                <Sparkles className="w-5 h-5 text-accent opacity-30" />
            </div>

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl font-display font-bold flex items-center gap-2">
                        <Target className="w-5 h-5 text-accent" />
                        ターゲット・用途選択
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">用途に合わせて AI が最適値を自動セットします</p>
                </div>
                {step > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)} className="text-accent">
                        <ArrowLeft className="w-4 h-4 mr-1" /> 戻る
                    </Button>
                )}
            </div>

            <AnimatePresence mode="wait">
                {step === 1 && (
                    <motion.div
                        key="step1"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-3"
                    >
                        {CREATOR_CATEGORIES.map((cat) => {
                            const Icon = iconMap[cat.icon] || Video;
                            const isSelected = config.creatorCategory === cat.id;
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => handleSelectCategory(cat)}
                                    className={cn(
                                        "flex flex-col items-center gap-3 p-4 rounded-xl border transition-all h-[100px] justify-center",
                                        isSelected
                                            ? "border-accent bg-accent/20 ring-1 ring-accent/50"
                                            : "border-border/50 bg-card/40 hover:border-accent/40"
                                    )}
                                >
                                    <Icon className={cn("w-6 h-6", isSelected ? "text-accent" : "text-muted-foreground")} />
                                    <span className="text-sm font-bold">{cat.label}</span>
                                </button>
                            );
                        })}
                    </motion.div>
                )}

                {step === 2 && selectedCat && (
                    <motion.div
                        key="step2"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                    >
                        <div className="flex items-center gap-2 text-accent bg-accent/10 px-3 py-1.5 rounded-full w-fit mb-4">
                            <span className="text-xs font-bold uppercase tracking-wider">Step 2</span>
                            <span className="text-sm">{selectedCat.step2Label}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {selectedCat.step2Options.map((opt) => {
                                const isSelected = config.creatorSubCategory === opt.id;
                                return (
                                    <button
                                        key={opt.id}
                                        onClick={() => handleSelectSubCategory(opt)}
                                        className={cn(
                                            "flex items-center justify-between p-4 rounded-xl border transition-all text-left group",
                                            isSelected
                                                ? "border-accent bg-accent/20"
                                                : "border-border/50 bg-card/40 hover:border-accent/30"
                                        )}
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold">{opt.label}</span>
                                            {opt.description && <span className="text-[10px] text-muted-foreground">{opt.description}</span>}
                                        </div>
                                        <ChevronRight className={cn("w-4 h-4 transition-transform group-hover:translate-x-1", isSelected ? "text-accent" : "text-muted-foreground")} />
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {step === 3 && selectedCat && (
                    <motion.div
                        key="step3"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                    >
                        <div className="flex items-center gap-2 text-accent bg-accent/10 px-3 py-1.5 rounded-full w-fit mb-4">
                            <span className="text-xs font-bold uppercase tracking-wider">Final Step</span>
                            <span className="text-sm">{selectedCat.step3Label}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {selectedCat.step3Options.map((opt) => {
                                const isSelected = config.creatorScene === opt.id;
                                return (
                                    <button
                                        key={opt.id}
                                        onClick={() => handleSelectScene(opt)}
                                        className={cn(
                                            "flex items-center justify-between p-4 rounded-xl border transition-all text-left",
                                            isSelected
                                                ? "border-accent bg-accent/20 ring-1 ring-accent"
                                                : "border-border/50 bg-card/40 hover:border-accent/30"
                                        )}
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold flex items-center gap-2">
                                                {isSelected && <Check className="w-3.5 h-3.5 text-accent" />}
                                                {opt.label}
                                            </span>
                                            {opt.description && <span className="text-[10px] text-muted-foreground">{opt.description}</span>}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-6 p-4 rounded-xl bg-accent/5 border border-accent/20 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                                <span className="text-xs font-bold text-accent">設定完了:</span>
                                <span className="text-xs text-muted-foreground">
                                    {CREATOR_CATEGORIES.find(c => c.id === config.creatorCategory)?.label}
                                    {">"} {selectedCat.step2Options.find(o => o.id === config.creatorSubCategory)?.label}
                                    {config.creatorScene && ` > ${selectedCat.step3Options.find(o => o.id === config.creatorScene)?.label}`}
                                </span>
                            </div>
                            <button onClick={reset} className="text-xs text-muted-foreground hover:text-accent underline">最初からやり直す</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Add Target icon since it was missing in lucide-react list above
import { Target } from "lucide-react";
import { Button } from "./ui/button";
