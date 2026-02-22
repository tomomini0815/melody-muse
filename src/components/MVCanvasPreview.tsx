import { useRef, useEffect, useState, useCallback } from "react";
import { parseLyrics, getVisualTheme, LyricsSection, VisualTheme } from "@/lib/lyrics-parser";
import { Mood } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Download, Loader2 } from "lucide-react";

interface Props {
    lyrics: string;
    mood: Mood;
    bpm: number;
    coverUrl?: string;
    styleTags: string;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    alpha: number;
    life: number;
    maxLife: number;
}

export function MVCanvasPreview({ lyrics, mood, bpm, coverUrl, styleTags }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animFrameRef = useRef<number>(0);
    const startTimeRef = useRef<number>(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [isExporting, setIsExporting] = useState(false);
    const particlesRef = useRef<Particle[]>([]);
    const coverImgRef = useRef<HTMLImageElement | null>(null);
    const sectionsRef = useRef<LyricsSection[]>([]);

    const theme = getVisualTheme(mood);
    const sections = parseLyrics(lyrics, bpm);
    sectionsRef.current = sections;
    const totalDuration = sections.length > 0 ? sections[sections.length - 1].endTime : 60;

    // Load cover image
    useEffect(() => {
        if (coverUrl) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = coverUrl;
            img.onload = () => { coverImgRef.current = img; };
        }
    }, [coverUrl]);

    // Initialize particles
    const initParticles = useCallback((canvas: HTMLCanvasElement, theme: VisualTheme) => {
        const particles: Particle[] = [];
        const count = theme.particleStyle === "burst" ? 60 : 40;
        for (let i = 0; i < count; i++) {
            particles.push(createParticle(canvas.width, canvas.height, theme));
        }
        particlesRef.current = particles;
    }, []);

    function createParticle(w: number, h: number, theme: VisualTheme): Particle {
        const style = theme.particleStyle;
        return {
            x: Math.random() * w,
            y: style === "rain" ? -10 : Math.random() * h,
            vx: style === "spiral" ? (Math.random() - 0.5) * 2 : (Math.random() - 0.5) * 0.8,
            vy: style === "rain" ? 1 + Math.random() * 2 : style === "float" ? -0.3 - Math.random() * 0.5 : (Math.random() - 0.5) * 0.5,
            size: 1 + Math.random() * 3,
            alpha: 0.2 + Math.random() * 0.6,
            life: 0,
            maxLife: 200 + Math.random() * 300,
        };
    }

    // Draw background
    function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, theme: VisualTheme, time: number) {
        const grd = ctx.createLinearGradient(0, 0, w * 0.3, h);
        grd.addColorStop(0, theme.bgGradient[0]);
        grd.addColorStop(0.5, theme.bgGradient[1]);
        grd.addColorStop(1, theme.bgGradient[2]);
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);

        // Draw cover image with parallax + vignette
        if (coverImgRef.current) {
            ctx.save();
            ctx.globalAlpha = 0.15;
            const scale = 1.1 + Math.sin(time * 0.0003) * 0.05;
            const imgW = w * scale;
            const imgH = h * scale;
            const ox = (w - imgW) / 2 + Math.sin(time * 0.0002) * 20;
            const oy = (h - imgH) / 2;
            ctx.drawImage(coverImgRef.current, ox, oy, imgW, imgH);
            ctx.restore();
        }

        // Background pattern
        drawPattern(ctx, w, h, theme, time);

        // Vignette
        const vignette = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.7);
        vignette.addColorStop(0, "transparent");
        vignette.addColorStop(1, "rgba(0,0,0,0.6)");
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, w, h);
    }

    function drawPattern(ctx: CanvasRenderingContext2D, w: number, h: number, theme: VisualTheme, time: number) {
        ctx.save();
        ctx.globalAlpha = 0.08;
        const t = time * 0.001;

        switch (theme.bgPattern) {
            case "stars":
                for (let i = 0; i < 60; i++) {
                    const sx = ((i * 137.5 + t * 10) % w);
                    const sy = ((i * 97.3 + Math.sin(t + i) * 5) % h);
                    const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(t * 2 + i));
                    ctx.globalAlpha = 0.08 * twinkle;
                    ctx.fillStyle = theme.particleColor;
                    ctx.beginPath();
                    ctx.arc(sx, sy, 1 + twinkle, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            case "waves":
                ctx.strokeStyle = theme.particleColor;
                ctx.lineWidth = 1;
                for (let wave = 0; wave < 3; wave++) {
                    ctx.beginPath();
                    for (let x = 0; x < w; x += 4) {
                        const y = h * (0.6 + wave * 0.1) + Math.sin(x * 0.01 + t + wave) * 20;
                        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                }
                break;
            case "grid":
                ctx.strokeStyle = theme.particleColor;
                ctx.lineWidth = 0.5;
                const spacing = 40;
                for (let x = 0; x < w; x += spacing) {
                    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
                }
                for (let y = 0; y < h; y += spacing) {
                    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
                }
                break;
            case "circles":
                ctx.strokeStyle = theme.particleColor;
                ctx.lineWidth = 0.5;
                for (let i = 0; i < 5; i++) {
                    const r = 50 + i * 60 + Math.sin(t + i) * 10;
                    ctx.beginPath();
                    ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
                    ctx.stroke();
                }
                break;
        }
        ctx.restore();
    }

    // Draw particles
    function drawParticles(ctx: CanvasRenderingContext2D, w: number, h: number, theme: VisualTheme, time: number) {
        const particles = particlesRef.current;
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life++;

            if (theme.particleStyle === "spiral") {
                const angle = p.life * 0.02;
                p.x += Math.cos(angle) * 0.5;
                p.y += Math.sin(angle) * 0.5;
            }

            const lifeRatio = p.life / p.maxLife;
            const fadeAlpha = lifeRatio < 0.1 ? lifeRatio * 10 : lifeRatio > 0.8 ? (1 - lifeRatio) * 5 : 1;

            ctx.save();
            ctx.globalAlpha = p.alpha * fadeAlpha;
            ctx.fillStyle = theme.particleColor;
            ctx.shadowColor = theme.glowColor;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            if (p.life >= p.maxLife || p.x < -10 || p.x > w + 10 || p.y < -10 || p.y > h + 10) {
                particles[i] = createParticle(w, h, theme);
            }
        }
    }

    // Draw lyrics with animation
    function drawLyrics(ctx: CanvasRenderingContext2D, w: number, h: number, theme: VisualTheme, timeSec: number) {
        const sections = sectionsRef.current;
        // Find current section
        let currentSec: LyricsSection | null = null;
        let sectionProgress = 0;
        for (const sec of sections) {
            if (timeSec >= sec.startTime && timeSec < sec.endTime) {
                currentSec = sec;
                sectionProgress = (timeSec - sec.startTime) / (sec.endTime - sec.startTime);
                break;
            }
        }

        if (!currentSec) return;

        // Section label
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = theme.accentColor;
        ctx.font = `bold 14px 'Inter', 'Noto Sans JP', sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(currentSec.label.toUpperCase(), w / 2, h * 0.15);
        ctx.restore();

        // Draw lyrics lines with staggered reveal
        const lineCount = currentSec.lines.length;
        const fontSize = Math.min(28, Math.max(18, 600 / lineCount));
        const lineHeight = fontSize * 1.8;
        const startY = h / 2 - (lineCount * lineHeight) / 2 + lineHeight / 2;

        for (let i = 0; i < lineCount; i++) {
            const lineProgress = Math.max(0, Math.min(1, (sectionProgress * lineCount - i) * 1.5));
            if (lineProgress <= 0) continue;

            const y = startY + i * lineHeight;
            const slideOffset = (1 - easeOutCubic(lineProgress)) * 30;

            ctx.save();
            ctx.globalAlpha = easeOutCubic(lineProgress);
            ctx.fillStyle = theme.textColor;
            ctx.font = `bold ${fontSize}px 'Inter', 'Noto Sans JP', sans-serif`;
            ctx.textAlign = "center";
            ctx.shadowColor = theme.glowColor;
            ctx.shadowBlur = lineProgress > 0.5 ? 15 : 5;

            // Active line glow
            const isCurrentLine = Math.floor(sectionProgress * lineCount) === i;
            if (isCurrentLine) {
                ctx.shadowBlur = 25;
                ctx.shadowColor = theme.accentColor;
            }

            ctx.fillText(currentSec.lines[i], w / 2, y + slideOffset);
            ctx.restore();
        }

        // Progress bar at bottom
        ctx.save();
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.fillRect(w * 0.1, h - 30, w * 0.8, 3);
        ctx.fillStyle = theme.accentColor;
        ctx.fillRect(w * 0.1, h - 30, w * 0.8 * (timeSec / (sections[sections.length - 1]?.endTime || 1)), 3);
        ctx.restore();
    }

    function easeOutCubic(t: number): number {
        return 1 - Math.pow(1 - t, 3);
    }

    // Main animation loop
    const animate = useCallback((timestamp: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const elapsed = timestamp - startTimeRef.current;
        const currentTimeSec = (elapsed / 1000) % (totalDuration + 2); // loop with 2s gap

        setCurrentTime(currentTimeSec);

        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);
        drawBackground(ctx, w, h, theme, elapsed);
        drawParticles(ctx, w, h, theme, elapsed);
        drawLyrics(ctx, w, h, theme, currentTimeSec);

        // Title watermark
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = theme.textColor;
        ctx.font = `11px 'Inter', sans-serif`;
        ctx.textAlign = "right";
        ctx.fillText("Melody Muse ♪", w - 15, h - 12);
        ctx.restore();

        animFrameRef.current = requestAnimationFrame(animate);
    }, [theme, totalDuration]);

    const play = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        initParticles(canvas, theme);
        startTimeRef.current = performance.now();
        setIsPlaying(true);
        animFrameRef.current = requestAnimationFrame(animate);
    }, [animate, initParticles, theme]);

    const pause = useCallback(() => {
        cancelAnimationFrame(animFrameRef.current);
        setIsPlaying(false);
    }, []);

    const reset = useCallback(() => {
        cancelAnimationFrame(animFrameRef.current);
        setIsPlaying(false);
        setCurrentTime(0);
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext("2d");
            if (ctx) {
                drawBackground(ctx, canvas.width, canvas.height, theme, 0);
            }
        }
    }, [theme]);

    // Initial draw
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        // Set canvas dimensions
        canvas.width = 960;
        canvas.height = 540;
        const ctx = canvas.getContext("2d");
        if (ctx) {
            drawBackground(ctx, canvas.width, canvas.height, theme, 0);
        }
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [theme]);

    // Export as WebM video using MediaRecorder
    const handleExport = useCallback(async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        setIsExporting(true);
        try {
            // @ts-ignore - captureStream is available in modern browsers
            const stream = canvas.captureStream(30); // 30fps
            const recorder = new MediaRecorder(stream, {
                mimeType: "video/webm;codecs=vp9",
                videoBitsPerSecond: 5_000_000,
            });

            const chunks: Blob[] = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: "video/webm" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `melody-muse-mv-${Date.now()}.webm`;
                a.click();
                URL.revokeObjectURL(url);
                setIsExporting(false);
            };

            // Start recording & play
            initParticles(canvas, theme);
            startTimeRef.current = performance.now();
            setIsPlaying(true);
            recorder.start();

            const recordAnimate = (timestamp: number) => {
                const elapsed = timestamp - startTimeRef.current;
                const currentTimeSec = elapsed / 1000;
                const ctx = canvas.getContext("2d")!;
                const w = canvas.width;
                const h = canvas.height;

                ctx.clearRect(0, 0, w, h);
                drawBackground(ctx, w, h, theme, elapsed);
                drawParticles(ctx, w, h, theme, elapsed);
                drawLyrics(ctx, w, h, theme, currentTimeSec);

                if (currentTimeSec < totalDuration + 1) {
                    requestAnimationFrame(recordAnimate);
                } else {
                    recorder.stop();
                    setIsPlaying(false);
                }
            };

            requestAnimationFrame(recordAnimate);
        } catch (e) {
            console.error("Export failed:", e);
            setIsExporting(false);
        }
    }, [theme, totalDuration, initParticles]);

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    return (
        <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden border border-primary/20 shadow-2xl bg-black">
                <canvas
                    ref={canvasRef}
                    className="w-full aspect-video"
                    style={{ imageRendering: "auto" }}
                />
                {/* Overlay controls */}
                {!isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm transition-all cursor-pointer" onClick={play}>
                        <div className="w-16 h-16 rounded-full bg-primary/80 backdrop-blur flex items-center justify-center shadow-lg shadow-primary/30 hover:scale-110 transition-transform">
                            <Play className="w-7 h-7 text-white ml-1" />
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
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
                </div>

                <span className="text-xs font-mono text-muted-foreground tabular-nums">
                    {formatTime(currentTime)} / {formatTime(totalDuration)}
                </span>

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
            </div>
        </div>
    );
}
