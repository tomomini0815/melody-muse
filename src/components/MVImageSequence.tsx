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
    sceneCount?: number;
}

interface SceneImage {
    url: string;
    section: LyricsSection;
    loaded: boolean;
}

// Ken Burns camera motion types for variety
type CameraMotion = "zoomIn" | "zoomOut" | "panLeft" | "panRight" | "panUp" | "panDown" | "diagonalTL" | "diagonalBR";

const CAMERA_MOTIONS: CameraMotion[] = [
    "zoomIn", "zoomOut", "panLeft", "panRight", "panUp", "panDown", "diagonalTL", "diagonalBR"
];

function getCameraMotionForScene(index: number, sectionType: string): CameraMotion {
    // Chorus gets more dynamic motions, Verse gets subtle
    if (sectionType === "chorus" || sectionType === "hook") {
        const epicMotions: CameraMotion[] = ["zoomIn", "diagonalBR", "panUp", "diagonalTL"];
        return epicMotions[index % epicMotions.length];
    }
    if (sectionType === "bridge" || sectionType === "outro") {
        const smoothMotions: CameraMotion[] = ["zoomOut", "panLeft", "panDown"];
        return smoothMotions[index % smoothMotions.length];
    }
    return CAMERA_MOTIONS[index % CAMERA_MOTIONS.length];
}

function getMotionSpeed(sectionType: string): number {
    switch (sectionType) {
        case "chorus":
        case "hook":
            return 1.6;
        case "bridge":
            return 0.7;
        case "outro":
            return 0.5;
        case "intro":
            return 0.6;
        default:
            return 1.0;
    }
}

export function MVImageSequence({ lyrics, mood, bpm, styleTags, coverUrl, artStyle = "cinematic", sceneCount: requestedSceneCount }: Props) {
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
    // Film grain noise canvas
    const grainCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const theme = getVisualTheme(mood);
    const sections = parseLyrics(lyrics, bpm);
    const totalDuration = sections.length > 0 ? sections[sections.length - 1].endTime : 60;
    const effectiveSceneCount = requestedSceneCount || sections.length;

    // Initialize grain canvas once
    useEffect(() => {
        const grain = document.createElement("canvas");
        grain.width = 256;
        grain.height = 256;
        const gCtx = grain.getContext("2d");
        if (gCtx) {
            const imageData = gCtx.createImageData(256, 256);
            for (let i = 0; i < imageData.data.length; i += 4) {
                const v = Math.random() * 50;
                imageData.data[i] = v;
                imageData.data[i + 1] = v;
                imageData.data[i + 2] = v;
                imageData.data[i + 3] = 18; // Subtle grain
            }
            gCtx.putImageData(imageData, 0, 0);
        }
        grainCanvasRef.current = grain;
    }, []);

    // Load a single image with timeout and retry
    const loadImageWithRetry = async (url: string, maxRetries = 2, timeoutMs = 30000): Promise<HTMLImageElement | null> => {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                    const image = new Image();
                    image.crossOrigin = "anonymous";
                    const timer = setTimeout(() => {
                        image.src = "";
                        reject(new Error("timeout"));
                    }, timeoutMs);
                    image.onload = () => {
                        clearTimeout(timer);
                        resolve(image);
                    };
                    image.onerror = () => {
                        clearTimeout(timer);
                        reject(new Error("load error"));
                    };
                    // Add cache-busting on retry to force fresh request
                    image.src = attempt > 0 ? `${url}&retry=${attempt}` : url;
                });
                return img;
            } catch {
                if (attempt < maxRetries) {
                    console.warn(`Image load failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying...`);
                    await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                }
            }
        }
        return null;
    };

    // Generate scene images
    const handleGenerate = async () => {
        setIsGenerating(true);
        setProgress(0);
        try {
            const imageUrls = await generateMVSceneImages(
                lyrics,
                styleTags,
                mood,
                effectiveSceneCount,
                artStyle,
                (p) => setProgress(Math.min(p, 50)) // Cap at 50% for URL generation phase
            );

            const newScenes: SceneImage[] = sections.map((sec, i) => ({
                url: imageUrls[i] || imageUrls[imageUrls.length - 1] || "",
                section: sec,
                loaded: false,
            }));

            // Preload images with retry and timeout
            const loadedImages = new Map<number, HTMLImageElement>();
            const totalToLoad = newScenes.length;

            await Promise.all(
                newScenes.map(async (scene, i) => {
                    const img = await loadImageWithRetry(scene.url);
                    if (img) {
                        loadedImages.set(i, img);
                        newScenes[i].loaded = true;
                    }
                    setProgress(50 + (50 * (i + 1)) / totalToLoad);
                })
            );

            imagesRef.current = loadedImages;
            setScenes(newScenes);

            const loadedCount = loadedImages.size;
            if (loadedCount < totalToLoad) {
                toast({
                    title: "一部のシーン画像の読み込みに失敗",
                    description: `${loadedCount}/${totalToLoad} シーンが正常に読み込まれました。失敗したシーンはグラデーション背景で表示されます。`,
                    variant: loadedCount === 0 ? "destructive" : "default",
                });
            }
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

    // ─── Draw a single frame ───
    function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number, timeSec: number, _elapsed: number) {
        // ── Background gradient ──
        const grd = ctx.createLinearGradient(0, 0, w * 0.3, h);
        grd.addColorStop(0, theme.bgGradient[0]);
        grd.addColorStop(0.5, theme.bgGradient[1]);
        grd.addColorStop(1, theme.bgGradient[2]);
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);

        // ── Find current & next scene ──
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
        const section = sections[currentIdx];
        const motion = getCameraMotionForScene(currentIdx, section?.type || "verse");
        const speed = getMotionSpeed(section?.type || "verse");

        // ── Ken Burns effect with diverse camera motions ──
        if (currentImg) {
            ctx.save();
            const t = sectionProgress * speed;

            let scale = 1.0;
            let panX = 0;
            let panY = 0;

            switch (motion) {
                case "zoomIn":
                    scale = 1.05 + t * 0.18;
                    panX = Math.sin(timeSec * 0.08) * 20;
                    panY = Math.cos(timeSec * 0.06) * 15;
                    break;
                case "zoomOut":
                    scale = 1.25 - t * 0.15;
                    panX = Math.cos(timeSec * 0.09) * 18;
                    panY = Math.sin(timeSec * 0.07) * 12;
                    break;
                case "panLeft":
                    scale = 1.15;
                    panX = 60 - t * 120;
                    panY = Math.sin(timeSec * 0.05) * 10;
                    break;
                case "panRight":
                    scale = 1.15;
                    panX = -60 + t * 120;
                    panY = Math.cos(timeSec * 0.05) * 10;
                    break;
                case "panUp":
                    scale = 1.12;
                    panX = Math.sin(timeSec * 0.06) * 12;
                    panY = 40 - t * 80;
                    break;
                case "panDown":
                    scale = 1.12;
                    panX = Math.cos(timeSec * 0.06) * 12;
                    panY = -40 + t * 80;
                    break;
                case "diagonalTL":
                    scale = 1.08 + t * 0.12;
                    panX = 50 - t * 100;
                    panY = 30 - t * 60;
                    break;
                case "diagonalBR":
                    scale = 1.08 + t * 0.12;
                    panX = -50 + t * 100;
                    panY = -30 + t * 60;
                    break;
            }

            // Cross-fade near section boundary (expanded to 25%)
            const fadeZone = 0.25;
            let alpha = 1;
            if (sectionProgress > (1 - fadeZone) && nextImg && nextIdx !== currentIdx) {
                const fadeProgress = (sectionProgress - (1 - fadeZone)) / fadeZone;
                // Smooth ease-in-out
                alpha = 1 - (fadeProgress * fadeProgress * (3 - 2 * fadeProgress));
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
                const nextMotion = getCameraMotionForScene(nextIdx, sections[nextIdx]?.type || "verse");
                let nextScale = 1.02;
                if (nextMotion === "zoomOut") nextScale = 1.12;
                const nw = w * nextScale;
                const nh = h * nextScale;
                ctx.drawImage(nextImg, (w - nw) / 2, (h - nh) / 2, nw, nh);
            }

            ctx.restore();

            // ── White flash on Chorus entry ──
            if (section?.type === "chorus" && sectionProgress < 0.06) {
                ctx.save();
                const flashAlpha = (1 - sectionProgress / 0.06) * 0.5;
                ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
                ctx.fillRect(0, 0, w, h);
                ctx.restore();
            }
        }

        // ── Vignette effect ──
        const vignetteGrd = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.75);
        vignetteGrd.addColorStop(0, "rgba(0,0,0,0)");
        vignetteGrd.addColorStop(0.7, "rgba(0,0,0,0)");
        vignetteGrd.addColorStop(1, "rgba(0,0,0,0.55)");
        ctx.fillStyle = vignetteGrd;
        ctx.fillRect(0, 0, w, h);

        // ── Film grain overlay ──
        if (grainCanvasRef.current) {
            ctx.save();
            ctx.globalAlpha = 0.08;
            ctx.globalCompositeOperation = "overlay";
            // Tile the grain pattern with random offset for animation
            const offX = Math.random() * 256;
            const offY = Math.random() * 256;
            for (let gx = -256; gx < w + 256; gx += 256) {
                for (let gy = -256; gy < h + 256; gy += 256) {
                    ctx.drawImage(grainCanvasRef.current, gx + offX, gy + offY);
                }
            }
            ctx.restore();
        }

        // ── Cinematic letterbox bars ──
        const barH = h * 0.065;
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.fillRect(0, 0, w, barH);
        ctx.fillRect(0, h - barH, w, barH);

        // ── Lyrics overlay ──
        if (section) {
            const lineCount = section.lines.length;
            const isChorus = section.type === "chorus" || section.type === "hook";
            const baseFontSize = isChorus
                ? Math.min(34, Math.max(22, 600 / lineCount))
                : Math.min(28, Math.max(16, 500 / lineCount));
            const lineHeight = baseFontSize * 1.8;
            const startY = h * 0.72 - (lineCount * lineHeight) / 2;

            // Semi-transparent text background (softer)
            ctx.save();
            const textBgGrd = ctx.createLinearGradient(0, startY - baseFontSize * 2, 0, startY + lineCount * lineHeight + baseFontSize);
            textBgGrd.addColorStop(0, "rgba(0,0,0,0)");
            textBgGrd.addColorStop(0.15, "rgba(0,0,0,0.55)");
            textBgGrd.addColorStop(0.85, "rgba(0,0,0,0.55)");
            textBgGrd.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = textBgGrd;
            ctx.fillRect(0, startY - baseFontSize * 2, w, lineCount * lineHeight + baseFontSize * 3);
            ctx.restore();

            for (let i = 0; i < lineCount; i++) {
                if (section.lines[0] === "[Instrumental]") continue;

                const lineProgress = Math.max(0, Math.min(1, (sectionProgress * lineCount - i) * 1.8));
                if (lineProgress <= 0) continue;

                const y = startY + i * lineHeight;
                // Cubic ease-out
                const ease = 1 - Math.pow(1 - lineProgress, 3);
                // Slide-up from below
                const slideOffset = (1 - ease) * 25;

                ctx.save();
                ctx.globalAlpha = ease;
                ctx.fillStyle = "#ffffff";
                const fontWeight = isChorus ? "800" : "bold";
                ctx.font = `${fontWeight} ${baseFontSize}px 'Inter', 'Noto Sans JP', sans-serif`;
                ctx.textAlign = "center";

                // Glow effect matching mood accent color
                ctx.shadowColor = isChorus ? theme.accentColor : "rgba(0,0,0,0.95)";
                ctx.shadowBlur = isChorus ? 25 : 12;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 2;

                // Text stroke for readability
                ctx.strokeStyle = "rgba(0,0,0,0.6)";
                ctx.lineWidth = isChorus ? 2.5 : 1.5;
                ctx.strokeText(section.lines[i], w / 2, y + slideOffset);

                ctx.fillText(section.lines[i], w / 2, y + slideOffset);

                // Secondary glow pass for Chorus
                if (isChorus && lineProgress > 0.5) {
                    ctx.globalAlpha = ease * 0.3;
                    ctx.shadowBlur = 40;
                    ctx.shadowColor = theme.accentColor;
                    ctx.fillText(section.lines[i], w / 2, y + slideOffset);
                }

                ctx.restore();
            }

            // ── Section label (top-left) ──
            ctx.save();
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = theme.accentColor;
            ctx.font = `600 11px 'Inter', sans-serif`;
            ctx.textAlign = "left";
            ctx.letterSpacing = "2px";
            ctx.fillText(`▸ ${section.label.toUpperCase()}`, 24, barH + 18);
            ctx.restore();
        }

        // ── Progress bar ──
        ctx.save();
        const progressY = h - 2;
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(0, progressY, w, 2);
        // Gradient progress
        const progressGrd = ctx.createLinearGradient(0, 0, w * (timeSec / totalDuration), 0);
        progressGrd.addColorStop(0, theme.accentColor);
        progressGrd.addColorStop(1, "#ffffff");
        ctx.fillStyle = progressGrd;
        ctx.fillRect(0, progressY, w * (timeSec / totalDuration), 2);
        ctx.restore();

        // ── Watermark ──
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = "#ffffff";
        ctx.font = "10px 'Inter', sans-serif";
        ctx.textAlign = "right";
        ctx.fillText("Melody Muse ♪", w - 20, barH - 4);
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
                videoBitsPerSecond: 12_000_000,
            });
            const chunks: Blob[] = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: "video/webm" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `melody-muse-cinematic-mv-${Date.now()}.webm`;
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
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext("2d");
        if (ctx) {
            const grd = ctx.createLinearGradient(0, 0, 1280 * 0.3, 720);
            grd.addColorStop(0, theme.bgGradient[0]);
            grd.addColorStop(0.5, theme.bgGradient[1]);
            grd.addColorStop(1, theme.bgGradient[2]);
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, 1280, 720);

            // Placeholder text
            ctx.fillStyle = "rgba(255,255,255,0.3)";
            ctx.font = "18px 'Inter', sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(scenes.length > 0 ? "▶ 再生ボタンを押してください" : "🎨 「シーン生成」でAI画像を作成", 640, 360);
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

                {/* Scene thumbnails */}
                {scenes.length > 0 && !isPlaying && !isGenerating && (
                    <div className="absolute bottom-14 left-0 right-0 px-3">
                        <div className="flex gap-1 justify-center overflow-x-auto pb-1">
                            {scenes.filter(s => s.loaded).slice(0, 10).map((scene, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "w-14 h-8 rounded border overflow-hidden shrink-0 opacity-70 hover:opacity-100 transition-opacity cursor-pointer",
                                        currentIdx(i, currentTime) ? "border-primary opacity-100 ring-1 ring-primary" : "border-white/20"
                                    )}
                                    title={scene.section.label}
                                >
                                    <img src={scene.url} alt="" className="w-full h-full object-cover" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Play button */}
                {!isPlaying && !isGenerating && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm transition-all cursor-pointer" onClick={() => play()}>
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

    // Helper: check if scene index is current
    function currentIdx(idx: number, time: number): boolean {
        const sec = sections[idx];
        if (!sec) return false;
        return time >= sec.startTime && time < sec.endTime;
    }
}
