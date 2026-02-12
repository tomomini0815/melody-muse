import { Check, Music, Sliders, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { label: "ジャンル", icon: Music },
  { label: "カスタマイズ", icon: Sliders },
  { label: "生成", icon: Sparkles },
];

export function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, i) => {
        const Icon = i < current ? Check : step.icon;
        const isActive = i === current;
        const isDone = i < current;
        return (
          <div key={i} className="flex items-center gap-2">
            {i > 0 && (
              <div className={cn("h-px w-8 md:w-16", isDone ? "bg-primary" : "bg-border")} />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                  isActive && "gradient-primary text-primary-foreground shadow-lg shadow-primary/30",
                  isDone && "bg-primary/20 text-primary",
                  !isActive && !isDone && "bg-secondary text-muted-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className={cn("text-xs", isActive ? "text-foreground" : "text-muted-foreground")}>
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
