import { useState, useEffect, useCallback } from "react";
import { GeneratedPrompt } from "@/lib/types";
import { getHistory, getFavorites, deleteFromHistory, toggleFavorite } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Clock, Star, Trash2, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  onLoad: (prompt: GeneratedPrompt) => void;
}

export function HistoryPanel({ open, onClose, onLoad }: Props) {
  const [tab, setTab] = useState<"history" | "favorites">("history");
  const [items, setItems] = useState<GeneratedPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = tab === "history" ? await getHistory() : await getFavorites();
      setItems(data);
    } catch (error) {
      console.error("Failed to load history data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, loadData]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border-l border-border h-full overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-display font-semibold">履歴</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex gap-2 mb-4">
          <Button
            variant={tab === "history" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("history")}
          >
            <Clock className="w-4 h-4 mr-1" /> 履歴
          </Button>
          <Button
            variant={tab === "favorites" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("favorites")}
          >
            <Star className="w-4 h-4 mr-1" /> お気に入り
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            {tab === "history" ? "まだ履歴がありません" : "お気に入りがありません"}
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="glass rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <p className="text-xs text-accent font-mono truncate flex-1">{item.styleTags}</p>
                  <div className="flex gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={async () => {
                        await toggleFavorite(item.id);
                        loadData();
                      }}
                    >
                      <Star className={cn("w-3 h-3", item.isFavorite && "fill-yellow-400 text-yellow-400")} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={async () => {
                        await deleteFromHistory(item.id);
                        loadData();
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{item.lyrics.slice(0, 100)}...</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { onLoad(item); onClose(); }}>
                    読み込む
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7"
                    onClick={() => {
                      navigator.clipboard.writeText(`${item.styleTags}\n\n${item.lyrics}`);
                      toast({ title: "コピーしました" });
                    }}
                  >
                    <Copy className="w-3 h-3 mr-1" /> コピー
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString("ja-JP")}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
