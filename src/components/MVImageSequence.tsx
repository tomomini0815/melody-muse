import { useState, useRef, useEffect, useCallback } from "react";
import { parseLyrics, getVisualTheme, LyricsSection } from "@/lib/lyrics-parser";
import { generateMVSceneImages } from "@/lib/stream-chat";
import { Mood } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Download, Loader2, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface Props {
    lyrics: string;
    mood: Mood;
    bpm: number;
    styleTags: string;
    coverUrl?: string;
    artStyle?: string;
}

interface SceneImage {
    url: string;
    section: LyricsSection;
    loaded: boolean;
}

export function MVImageSequence({ lyrics, mood, bpm, styleTags, coverUrl, artStyle = "cinematic" }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animFrameRef = useRef<number>(0);
    const startTimeRef = useRef<number>(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [scenes, setScenes] = useState<SceneImage[]>([]);
    const [progress, setProgress] = useState(0);
    const imagesRef = useRef<Map<number, HTMLImageElement>>(new Map());

    const theme = getVisualTheme(mood);
    const sections = parseLyrics(lyrics, bpm);
    const totalDuration = sections.length > 0 ? sections[sections.length - 1].endTime : 60;

    // Generate scene images
    const handleGenerate = async () => {
        setIsGenerating(true);
        setProgress(0);
        try {
            const imageUrls = await generateMVSceneImages(
                lyrics,
                styleTags,
                mood,
                sections.length,
                artStyle,
                (p) => setProgress(p)
            );

            const newScenes: SceneImage[] = sections.map((sec, i) => ({
                url: imageUrls[i] || imageUrls[imageUrls.length - 1] || "",
                section: sec,
                loaded: false,
            }));

            // Preload images
            const loadedImages = new Map<number, HTMLImageElement>();
            await Promise.all(
                newScenes.map((scene, i) =>
                    new Promise<void>((resolve) => {
                        const img = new Image();
                        img.crossOrigin = "anonymous";
                        img.onload = () => {
                            loadedImages.set(i, img);
                            newScenes[i].loaded = true;
                            resolve();
                        };
                        img.onerror = () => resolve();
                        img.src = scene.url;
                    })
                )
            );

            imagesRef.current = loadedImages;
            setScenes(newScenes);
        } catch (e) {
            console.error("Scene generation failed:", e);
            toast({
                title: "シーン生成エラー",
                description: (e as Error).message,
                variant: "destructive",
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePlayClick = () => {
        if (scenes.length === 0) {
            toast({
                title: "シーンを生成してください",
                description: "「シーン生成」ボタンを押してAI画像を作成してから再生してください。",
            });
            return;
        }
        play();
    };

    // Draw frame
    function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number, timeSec: number, elapsed: number) {
        // Background gradient
        const grd = ctx.createLinearGradient(0, 0, w * 0.3, h);
        grd.addColorStop(0, theme.bgGradient[0]);
        grd.addColorStop(0.5, theme.bgGradient[1]);
        grd.addColorStop(1, theme.bgGradient[2]);
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);

        // Find current and next scene
        let currentIdx = -1;
        let sectionProgress = 0;
        for (let i = 0; i < sections.length; i++) {
            if (timeSec >= sections[i].startTime && timeSec < sections[i].endTime) {
                currentIdx = i;
                sectionProgress = (timeSec - sections[i].startTime) / (sections[i].endTime - sections[i].startTime);
                break;
            }
        }
        if (currentIdx === -1) currentIdx = sections.length - 1;

        const currentImg = imagesRef.current.get(currentIdx);
        const nextIdx = Math.min(currentIdx + 1, sections.length - 1);
        const nextImg = imagesRef.current.get(nextIdx);

        // Ken Burns effect: slow zoom + pan
        if (currentImg) {
            ctx.save();
            const scale = 1.05 + sectionProgress * 0.1;
            const panX = Math.sin(timeSec * 0.1 + currentIdx) * 30;
            const panY = Math.cos(timeSec * 0.08 + currentIdx) * 20;

            // Cross-fade near section boundary
            const fadeZone = 0.15; // last 15% of section
            let alpha = 1;
            if (sectionProgress > (1 - fadeZone) && nextImg && nextIdx !== currentIdx) {
                alpha = 1 - (sectionProgress - (1 - fadeZone)) / fadeZone;
            }

            ctx.globalAlpha = alpha;
            const imgW = w * scale;
            const imgH = h * scale;
            const ox = (w - imgW) / 2 + panX;
            const oy = (h - imgH) / 2 + panY;
            ctx.drawImage(currentImg, ox, oy, imgW, imgH);

            // Draw next image with fade-in
            if (nextImg && alpha < 1) {
                ctx.globalAlpha = 1 - alpha;
                const nextScale = 1.0 + (1 - alpha) * 0.05;
                const nw = w * nextScale;
                const nh = h * nextScale;
                ctx.drawImage(nextImg, (w - nw) / 2, (h - nh) / 2, nw, nh);
            }

            ctx.restore();
        }

        // Cinematic top/bottom bars
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(0, 0, w, h * 0.08);
        ctx.fillRect(0, h * 0.92, w, h * 0.08);

        // Lyrics overlay
        const section = sections[currentIdx];
        if (section) {
            const lineCount = section.lines.length;
            const fontSize = Math.min(26, Math.max(16, 500 / lineCount));
            const lineHeight = fontSize * 1.7;
            const startY = h * 0.75 - (lineCount * lineHeight) / 2;

            // Semi-transparent background for text (enhanced for readability)
            ctx.save();
            ctx.fillStyle = "rgba(0,0,0,0.6)";
            const textAreaTop = startY - fontSize * 1.5;
            const textAreaHeight = lineCount * lineHeight + fontSize * 2.5;
            ctx.fillRect(0, textAreaTop, w, textAreaHeight);
            ctx.restore();

            for (let i = 0; i < lineCount; i++) {
                const lineProgress = Math.max(0, Math.min(1, (sectionProgress * lineCount - i) * 2));
                if (lineProgress <= 0) continue;

                const y = startY + i * lineHeight;
                const ease = 1 - Math.pow(1 - lineProgress, 3);

                ctx.save();
                ctx.globalAlpha = ease;
                ctx.fillStyle = "#ffffff";
                ctx.font = `bold ${fontSize}px 'Inter', 'Noto Sans JP', sans-serif`;
                ctx.textAlign = "center";

                // Enhanced text visibility
                ctx.shadowColor = "rgba(0,0,0,0.95)";
                ctx.shadowBlur = 15;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                // Subtle outline
                ctx.strokeStyle = "rgba(0,0,0,0.5)";
                ctx.lineWidth = 1.5;
                ctx.strokeText(section.lines[i], w / 2, y);

                ctx.fillText(section.lines[i], w / 2, y);
                ctx.restore();
            }

            // Section label
            ctx.save();
            ctx.globalAlpha = 0.6;
            ctx.fillStyle = theme.accentColor;
            ctx.font = `bold 12px 'Inter', sans-serif`;
            ctx.textAlign = "left";
            ctx.fillText(section.label.toUpperCase(), 20, h * 0.06);
            ctx.restore();
        }

        // Progress bar
        ctx.save();
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fillRect(0, h - 3, w, 3);
        ctx.fillStyle = theme.accentColor;
        ctx.fillRect(0, h - 3, w * (timeSec / totalDuration), 3);
        ctx.restore();

        // Watermark
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = "#ffffff";
        ctx.font = "11px 'Inter', sans-serif";
        ctx.textAlign = "right";
        ctx.fillText("Melody Muse ♪", w - 15, h * 0.05);
        ctx.restore();
    }

    const animate = useCallback((timestamp: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const elapsed = timestamp - startTimeRef.current;
        const t = (elapsed / 1000) % (totalDuration + 2);
        setCurrentTime(t);
        drawFrame(ctx, canvas.width, canvas.height, t, elapsed);
        animFrameRef.current = requestAnimationFrame(animate);
    }, [totalDuration, sections, theme]);

    const play = useCallback(() => {
        startTimeRef.current = performance.now();
        setIsPlaying(true);
        animFrameRef.current = requestAnimationFrame(animate);
    }, [animate]);

    const pause = useCallback(() => {
        cancelAnimationFrame(animFrameRef.current);
        setIsPlaying(false);
    }, []);

    const reset = useCallback(() => {
        cancelAnimationFrame(animFrameRef.current);
        setIsPlaying(false);
        setCurrentTime(0);
    }, []);

    // Export
    const handleExport = useCallback(async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        setIsExporting(true);
        try {
            // @ts-ignore
            const stream = canvas.captureStream(30);
            const recorder = new MediaRecorder(stream, {
                mimeType: "video/webm;codecs=vp9",
                videoBitsPerSecond: 8_000_000,
            });
            const chunks: Blob[] = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: "video/webm" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `melody-muse-mv-cinematic-${Date.now()}.webm`;
                a.click();
                URL.revokeObjectURL(url);
                setIsExporting(false);
            };

            startTimeRef.current = performance.now();
            setIsPlaying(true);
            recorder.start();

            const recordAnimate = (timestamp: number) => {
                const elapsed = timestamp - startTimeRef.current;
                const t = elapsed / 1000;
                const ctx = canvas.getContext("2d")!;
                drawFrame(ctx, canvas.width, canvas.height, t, elapsed);
                if (t < totalDuration + 1) {
                    requestAnimationFrame(recordAnimate);
                } else {
                    recorder.stop();
                    setIsPlaying(false);
                }
            };
            requestAnimationFrame(recordAnimate);
        } catch {
            setIsExporting(false);
        }
    }, [totalDuration, sections, theme]);

    // Init canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = 960;
        canvas.height = 540;
        const ctx = canvas.getContext("2d");
        if (ctx) {
            const grd = ctx.createLinearGradient(0, 0, 960 * 0.3, 540);
            grd.addColorStop(0, theme.bgGradient[0]);
            grd.addColorStop(0.5, theme.bgGradient[1]);
            grd.addColorStop(1, theme.bgGradient[2]);
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, 960, 540);

            // Placeholder text
            ctx.fillStyle = "rgba(255,255,255,0.3)";
            ctx.font = "16px 'Inter', sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(scenes.length > 0 ? "▶ 再生ボタンを押してください" : "🎨 「シーン生成」でAI画像を作成", 480, 270);
        }
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [theme, scenes.length]);

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    return (
        <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden border border-primary/20 shadow-2xl bg-black">
                <canvas ref={canvasRef} className="w-full aspect-video" style={{ imageRendering: "auto" }} />

                {/* Loading overlay */}
                {isGenerating && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
                        <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
                        <p className="text-sm text-white/80 mb-2">AIシーンを生成中...</p>
                        <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-xs text-white/50 mt-1">{Math.round(progress)}%</p>
                    </div>
                )}

                {/* Play button */}
                {!isPlaying && !isGenerating && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm transition-all cursor-pointer" onClick={handlePlayClick}>
                        <div className={cn(
                            "w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110",
                            scenes.length > 0 ? "bg-primary/80 shadow-primary/30" : "bg-muted/50 border border-white/20"
                        )}>
                            <Play className={cn("w-7 h-7 text-white ml-1", scenes.length === 0 && "opacity-50")} />
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                    {scenes.length === 0 ? (
                        <Button
                            variant="secondary"
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 gap-2 px-6"
                        >
                            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                            <span>シーン（AI画像）を生成</span>
                        </Button>
                    ) : (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={isPlaying ? pause : play}
                                className="h-9 glass gap-1.5 px-3"
                            >
                                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                <span className="text-xs">{isPlaying ? "一時停止" : "再生"}</span>
                            </Button>
                            <Button variant="ghost" size="sm" onClick={reset} className="h-9 glass gap-1.5 px-3">
                                <RotateCcw className="w-4 h-4" />
                                <span className="text-xs">リセット</span>
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className="h-9 glass gap-1.5 px-3 text-muted-foreground"
                            >
                                <ImageIcon className="w-4 h-4" />
                                <span className="text-xs">再生成</span>
                            </Button>
                        </>
                    )}
                </div>

                <span className="text-xs font-mono text-muted-foreground tabular-nums">
                    {formatTime(currentTime)} / {formatTime(totalDuration)}
                </span>

                {scenes.length > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleExport}
                        disabled={isExporting}
                        className="h-9 glass gap-1.5 px-3 text-primary"
                    >
                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        <span className="text-xs">{isExporting ? "録画中..." : "ダウンロード"}</span>
                    </Button>
                )}
            </div>
        </div>
    );
}
