import { cn } from "@/lib/utils";
import { GENRES } from "@/lib/types";
import { motion } from "framer-motion";
import {
  Music, Music2, Disc3, Mic, Guitar, Coffee, Heart, Sun, Zap, Flame,
  Skull, AlertTriangle, TreePine, Leaf, Cloud, Triangle, Drum, Building2,
  Headphones, Waves, Church, CloudRain, Piano
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Music, Music2, Disc3, Mic, Guitar, Coffee, Heart, Sun, Zap, Flame,
  Skull, AlertTriangle, TreePine, Leaf, Cloud, Triangle, Drum, Building2,
  Headphones, Waves, Church, CloudRain, Piano,
};

interface Props {
  selected: string[];
  onChange: (genres: string[]) => void;
}

export function GenreSelector({ selected, onChange }: Props) {
  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((g) => g !== id)
        : [...selected, id]
    );
  };

  return (
    <div>
      <h2 className="text-xl font-display font-semibold mb-2">ジャンルを選択</h2>
      <p className="text-muted-foreground text-sm mb-6">複数選択でジャンル融合も可能です</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {GENRES.map((genre, i) => {
          const Icon = iconMap[genre.icon] || Music;
          const isSelected = selected.includes(genre.id);
          return (
            <motion.button
              key={genre.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => toggle(genre.id)}
              className={cn(
                "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all cursor-pointer",
                isSelected
                  ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                  : "border-border bg-card hover:border-primary/40 hover:bg-secondary"
              )}
            >
              <Icon className={cn("w-6 h-6", isSelected ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-xs font-medium", isSelected ? "text-foreground" : "text-muted-foreground")}>
                {genre.label}
              </span>
            </motion.button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p className="mt-4 text-sm text-primary">
          {selected.length}ジャンル選択中
        </p>
      )}
    </div>
  );
}
