
import { useState, useCallback, useMemo } from "react";
// Removed react-dropzone imports to use native handlers
import {
    ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ZAxis, Legend, ReferenceLine, ReferenceArea
} from "recharts";
import { motion } from "framer-motion";
import { analyzeAudioFile, AudioFeatures, performClustering } from "@/lib/audio-analysis";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, Loader2, Music, Upload, Info, Download, Sparkles, Copy, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const CLUSTER_COLORS = ["#FFD700", "#00d4ff", "#ff4b4b", "#4ade80", "#a855f7"];
// English names for internal/display
const CLUSTER_NAMES = ["Energetic / Bright", "Mellow / Dark", "Rhythmic", "Atmospheric", "Other"];
// Japanese names for Export/Display
const CLUSTER_NAMES_JA = ["エネルギッシュ / 明るい", "メロウ / 暗め", "リズミカル", "アトモスフェリック (雰囲気重視)", "その他"];

// Helper: Check if file looks like audio
const isAudioFile = (file: File) => {
    if (file.type.startsWith('audio/')) return true;
    return /\.(mp3|wav|ogg|m4a|flac|aac|wma|aiff|alac)$/i.test(file.name);
};

export default function AudioAnalysis() {
    const [files, setFiles] = useState<File[]>([]);
    const [analyzing, setAnalyzing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [results, setResults] = useState<AudioFeatures[]>([]);
    const [isDragActive, setIsDragActive] = useState(false);

    // Native Drag Handlers
    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(true);
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        // Only set to false if we actually leave the drop target, not just enter a child
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        e.stopPropagation();
        setIsDragActive(false);
    }, []);

    const onDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);

        const items = e.dataTransfer.items;
        if (!items) return;

        const droppedFiles: File[] = [];
        const queue: any[] = [];

        // Enqueue items
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
            if (entry) {
                queue.push(entry);
            } else if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) droppedFiles.push(file);
            }
        }

        // Process queue (Recursive)
        const processEntry = async (entry: any) => {
            if (entry.isFile) {
                try {
                    const file = await new Promise<File>((resolve, reject) => entry.file(resolve, reject));
                    // Strict check: Must be audio AND have content
                    if (isAudioFile(file) && file.size > 0) droppedFiles.push(file);
                } catch (err) { console.error("Error reading file", err); }
            } else if (entry.isDirectory) {
                const dirReader = entry.createReader();
                const readEntries = async () => {
                    try {
                        const entries = await new Promise<any[]>((resolve, reject) => dirReader.readEntries(resolve, reject));
                        if (entries.length > 0) {
                            for (const child of entries) {
                                await processEntry(child);
                            }
                            await readEntries(); // Continue reading until empty
                        }
                    } catch (err) { console.error("Error reading dir", err); }
                }
                await readEntries();
            }
        };

        for (const entry of queue) {
            await processEntry(entry);
        }

        // Final Filter to strictly ensure no 0-byte or non-audio files slip through
        const validFiles = droppedFiles.filter(f => isAudioFile(f) && f.size > 0);

        // Handle Files
        if (validFiles.length === 0) {
            toast({
                title: "No valid audio files found",
                description: "Ensure files are not empty and are supported audio formats (MP3/WAV, etc).",
                variant: "destructive"
            });
            return;
        }

        startAnalysis(validFiles);
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files).filter(isAudioFile);
            if (selectedFiles.length > 0) {
                startAnalysis(selectedFiles);
            } else {
                toast({ title: "No audio files selected", variant: "destructive" });
            }
        }
    };

    const startAnalysis = async (filesToAnalyze: File[]) => {
        setFiles(filesToAnalyze);
        setAnalyzing(true);
        setResults([]);
        setProgress({ current: 0, total: filesToAnalyze.length });

        const analyzed: AudioFeatures[] = [];
        let failedCount = 0;

        for (let i = 0; i < filesToAnalyze.length; i++) {
            // Extra safety check
            if (filesToAnalyze[i].size === 0) {
                console.warn(`Skipping empty file: ${filesToAnalyze[i].name}`);
                continue;
            }

            try {
                const feat = await analyzeAudioFile(filesToAnalyze[i]);
                analyzed.push(feat);
            } catch (e) {
                console.error(`Error analyzing ${filesToAnalyze[i].name}:`, e);
                failedCount++;
            }
            setProgress({ current: i + 1, total: filesToAnalyze.length });
        }

        if (analyzed.length === 0) {
            setAnalyzing(false);
            toast({ title: "Analysis Failed", description: "Could not decode any audio files.", variant: "destructive" });
            return;
        }

        const clustered = performClustering(analyzed, 3);
        setResults(clustered);
        setAnalyzing(false);

        if (failedCount > 0) {
            toast({ title: "Analysis Complete", description: `Processed ${analyzed.length}/${filesToAnalyze.length} files.`, variant: "default" });
        }
    };


    const handleExport = () => {
        if (results.length === 0) return;

        // Enrich data with Japanese descriptions for JSON export
        const exportData = results.map(r => ({
            ...r,
            cluster_name_en: CLUSTER_NAMES[r.cluster || 0],
            cluster_name_ja: CLUSTER_NAMES_JA[r.cluster || 0],
            features_desc_ja: {
                tempo: "テンポ (BPM)",
                brightness: "明るさ (音色)",
                energy: "エネルギッシュさ (音圧)",
                duration: "再生時間 (秒)"
            }
        }));

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "music_analysis_results.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        toast({ title: "エクスポート完了", description: "分析結果をJSONファイルとして保存しました。" });
    };

    const handleExportCSV = () => {
        if (results.length === 0) return;

        // CSV Header
        const headers = ["ファイル名", "テンポ (BPM)", "明るさ (%)", "エネルギー (%)", "長さ (秒)", "クラスターID", "クラスター名"];

        // CSV Rows
        const rows = results.map(r => [
            `"${r.name}"`,
            r.tempo,
            r.brightness,
            r.energy,
            r.duration.toFixed(2),
            r.cluster,
            `"${CLUSTER_NAMES_JA[r.cluster || 0]}"`
        ]);

        const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");

        // Build blob with BOM for UTF-8 (to prevent Excel garbling)
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "music_analysis_results.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({ title: "CSV出力完了", description: "Spreadsheet形式で保存しました。" });
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                if (Array.isArray(json) && json.length > 0) {
                    setResults(json);
                    setFiles([]); // Clear local files since we're viewing imported data
                    toast({ title: "インポート完了", description: `${json.length}件の分析データを読み込みました。` });
                } else {
                    throw new Error("Invalid format");
                }
            } catch (err) {
                toast({ title: "インポート失敗", description: "ファイルの形式が正しくありません。", variant: "destructive" });
            }
        };
        reader.readAsText(file);
    };

    const groupedResults = useMemo(() => {
        const groups: { [key: number]: AudioFeatures[] } = {};
        results.forEach(r => {
            const c = r.cluster || 0;
            if (!groups[c]) groups[c] = [];
            groups[c].push(r);
        });
        return groups;
    }, [results]);

    const generateSunoPrompt = (file: AudioFeatures) => {
        const tempoType = file.tempo > 120 ? "Fast" : file.tempo > 85 ? "Mid-tempo" : "Slow";
        const brightnessType = file.brightness > 70 ? "Bright, Sparkling" : file.brightness > 40 ? "Balanced" : "Warm, Mellow";
        const energyType = file.energy > 70 ? "Intense, High-energy" : file.energy > 40 ? "Moderate" : "Calm, Soft";

        return `${tempoType}, ${energyType}, ${brightnessType}, ${Math.round(file.tempo)} BPM, high quality audio`;
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "コピーしました", description: "プロンプトをクリップボードに保存しました。" });
    };

    return (
        <div className="min-h-screen bg-background relative overflow-hidden p-4 sm:p-8">
            <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <Link to="/">
                            <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10 h-9 w-9">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-xl sm:text-3xl font-display font-bold gradient-text">Audio Analysis Studio</h1>
                            <p className="text-xs sm:text-sm text-muted-foreground">楽曲ライブラリの音響特性を可視化します</p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 sm:gap-3 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
                        {results.length > 0 && (
                            <>
                                <Button onClick={handleExportCSV} variant="outline" className="border-primary/30 hover:bg-primary/5 gap-2">
                                    <Download className="w-4 h-4" /> CSV書き出し
                                </Button>
                                <Button onClick={handleExport} variant="outline" className="border-primary/50 hover:bg-primary/10 gap-2">
                                    <Download className="w-4 h-4" /> JSON書き出し
                                </Button>
                            </>
                        )}
                        <input
                            type="file"
                            id="import-json"
                            accept=".json"
                            className="hidden"
                            onChange={handleImport}
                        />
                        <Button
                            variant="outline"
                            className="border-white/20 hover:bg-white/10 gap-2"
                            onClick={() => document.getElementById('import-json')?.click()}
                        >
                            <Upload className="w-4 h-4" /> インポート (JSON)
                        </Button>
                    </div>
                </div>

                {/* Dropzone */}
                {results.length === 0 && (
                    <div
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        className={cn(
                            "glass-card rounded-3xl p-6 sm:p-12 border-2 border-dashed transition-all cursor-pointer group",
                            isDragActive
                                ? "border-primary bg-primary/10 scale-[0.99]"
                                : "border-white/10 hover:border-primary/30"
                        )}
                        onClick={() => document.getElementById('file-upload')?.click()}
                    >
                        <input
                            id="file-upload"
                            type="file"
                            multiple
                            accept="audio/*"
                            className="hidden"
                            onChange={handleFileSelect}
                            // @ts-ignore
                            webkitdirectory=""
                        />

                        <div className="flex flex-col items-center gap-4 sm:gap-6 text-center">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                {analyzing ? <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-primary animate-spin" /> : <Upload className="w-8 h-8 sm:w-10 sm:h-10 text-primary animate-pulse" />}
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-xl sm:text-2xl font-display font-bold">
                                    {analyzing ? `分析中... ${progress.current}/${progress.total}` : "ドロップして分析を開始"}
                                </h2>
                                <p className="text-xs sm:text-sm text-muted-foreground max-w-xs mx-auto">
                                    楽曲ファイルまたは<span className="text-primary font-bold">フォルダごと</span>ドロップしてください
                                </p>
                            </div>
                            {!analyzing && (
                                <Button className="gradient-primary h-10 sm:h-12 px-6 sm:px-8 rounded-full text-sm sm:text-base">
                                    ファイルを選択
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* Results View */}
                {results.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">

                        {/* Chart Section */}
                        <Card className="glass-card border-white/5 overflow-hidden">
                            <CardHeader className="p-4 sm:p-6 pb-2">
                                <div className="space-y-4">
                                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                                        楽曲特性マップ (Sonic Landscape)
                                    </CardTitle>

                                    {/* Custom Legend moved to header for better mobile layout */}
                                    <div className="flex flex-wrap gap-x-4 gap-y-2 px-1">
                                        {Object.keys(groupedResults).map((clusterKey) => {
                                            const index = parseInt(clusterKey);
                                            return (
                                                <div key={index} className="flex items-center gap-1.5 min-w-fit">
                                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CLUSTER_COLORS[index % CLUSTER_COLORS.length] }} />
                                                    <span
                                                        className="text-[10px] sm:text-xs font-medium whitespace-nowrap"
                                                        style={{ color: CLUSTER_COLORS[index % CLUSTER_COLORS.length] }}
                                                    >
                                                        {CLUSTER_NAMES_JA[index]}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-2 sm:p-6 pt-0">
                                <div className="h-[400px] sm:h-[500px] md:h-[600px] w-full relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: -20 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} vertical={false} />

                                            <XAxis
                                                type="number" dataKey="brightness" name="Brightness" unit="%"
                                                label={{ value: 'Brightness (%)', position: 'insideBottomRight', fill: '#666', offset: -5, fontSize: 10, opacity: 0.6 }}
                                                stroke="#444" domain={[0, 100]} tick={{ fill: '#666', fontSize: 10 }}
                                            />
                                            <YAxis
                                                type="number" dataKey="energy" name="Energy" unit="%"
                                                label={{ value: 'Energy (%)', angle: -90, position: 'insideTopLeft', fill: '#666', fontSize: 10, opacity: 0.6 }}
                                                stroke="#444" domain={[0, 100]} tick={{ fill: '#666', fontSize: 10 }}
                                            />
                                            <ZAxis type="number" dataKey="size" range={[60, 400]} />

                                            <ReferenceLine x={50} stroke="#333" strokeDasharray="3 3" />
                                            <ReferenceLine y={50} stroke="#333" strokeDasharray="3 3" />

                                            <ReferenceArea x1={50} x2={100} y1={50} y2={100} fill="transparent" stroke="none" label={{ value: "Energetic & Bright", position: 'insideTopRight', fill: '#4ade80', fontSize: 10, opacity: 0.3 }} />
                                            <ReferenceArea x1={0} x2={50} y1={50} y2={100} fill="transparent" stroke="none" label={{ value: "Energetic & Dark", position: 'insideTopLeft', fill: '#ff4b4b', fontSize: 10, opacity: 0.3 }} />
                                            <ReferenceArea x1={50} x2={100} y1={0} y2={50} fill="transparent" stroke="none" label={{ value: "Calm & Bright", position: 'insideBottomRight', fill: '#00d4ff', fontSize: 10, opacity: 0.3 }} />
                                            <ReferenceArea x1={0} x2={50} y1={0} y2={50} fill="transparent" stroke="none" label={{ value: "Calm & Dark", position: 'insideBottomLeft', fill: '#a855f7', fontSize: 10, opacity: 0.3 }} />

                                            <Tooltip
                                                cursor={{ strokeDasharray: '3 3', stroke: '#ff4d4d' }}
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        const data = payload[0].payload as AudioFeatures;
                                                        return (
                                                            <div className="glass p-3 rounded-xl border border-white/10 bg-black/90 shadow-xl max-w-[180px]">
                                                                <p className="font-bold text-primary mb-1 text-[11px] truncate">{data.name}</p>
                                                                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px] text-zinc-400">
                                                                    <span>Tempo:</span> <span className="text-white">~{Math.round(data.tempo)} BPM</span>
                                                                    <span>Bright:</span> <span className="text-white">{Math.round(data.brightness)}%</span>
                                                                    <span>Energy:</span> <span className="text-white">{Math.round(data.energy)}%</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />

                                            {Object.keys(groupedResults).map((clusterKey) => {
                                                const index = parseInt(clusterKey);
                                                return (
                                                    <Scatter
                                                        key={index}
                                                        data={groupedResults[index]}
                                                        fill={CLUSTER_COLORS[index % CLUSTER_COLORS.length]}
                                                        fillOpacity={0.8}
                                                        animationDuration={1000}
                                                        animationEasing="ease-out"
                                                    />
                                                );
                                            })}
                                        </ScatterChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Grouped Lists */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                            {Object.keys(groupedResults).map((clusterKey) => {
                                const index = parseInt(clusterKey);
                                const clusterFiles = groupedResults[index];
                                return (
                                    <Card key={index} className="glass-card border-white/5 bg-black/20">
                                        <CardHeader className="p-4 sm:p-6">
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CLUSTER_COLORS[index % CLUSTER_COLORS.length] }} />
                                                    {CLUSTER_NAMES_JA[index]}
                                                </CardTitle>
                                                <Badge variant="secondary" className="bg-white/5 text-[10px] sm:text-xs">
                                                    {clusterFiles.length} 曲
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-2 sm:p-4 pt-0">
                                            <div className="space-y-1 max-h-[300px] sm:max-h-[400px] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
                                                {clusterFiles.map((file, i) => (
                                                    <div key={i} className="group flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                                                        <div className="flex-1 min-w-0 mr-2">
                                                            <p className="text-xs sm:text-sm font-medium truncate">{file.name}</p>
                                                            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                                                                <span className="shrink-0">テンポ: {Math.round(file.tempo)}</span>
                                                                <span className="text-zinc-700">•</span>
                                                                <span className="truncate">Energy: {Math.round(file.energy)}%</span>
                                                            </p>
                                                        </div>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/20 hover:text-primary">
                                                                    <Sparkles className="w-4 h-4" />
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-80 glass border-white/10 p-4 space-y-4">
                                                                <div className="space-y-1">
                                                                    <h4 className="text-sm font-bold flex items-center gap-2">
                                                                        <Sparkles className="w-4 h-4 text-primary" />
                                                                        Suno AI プロンプト生成
                                                                    </h4>
                                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">この曲を元にしたスタイル提案</p>
                                                                </div>

                                                                <div className="bg-black/40 rounded-lg p-3 border border-white/5 space-y-2">
                                                                    <p className="text-xs italic text-zinc-300 leading-relaxed line-clamp-3">
                                                                        {generateSunoPrompt(file)}
                                                                    </p>
                                                                    <Button
                                                                        size="sm"
                                                                        className="w-full h-8 text-[11px] gap-2 bg-primary/20 hover:bg-primary/40 text-primary border border-primary/30"
                                                                        onClick={() => copyToClipboard(generateSunoPrompt(file))}
                                                                    >
                                                                        <Copy className="w-3 h-3" /> プロンプトをコピー
                                                                    </Button>
                                                                </div>

                                                                <div className="grid grid-cols-3 gap-2">
                                                                    <div className="glass p-2 rounded text-center">
                                                                        <p className="text-[8px] text-muted-foreground uppercase">BPM</p>
                                                                        <p className="text-xs font-bold">{Math.round(file.tempo)}</p>
                                                                    </div>
                                                                    <div className="glass p-2 rounded text-center">
                                                                        <p className="text-[8px] text-muted-foreground uppercase">Energy</p>
                                                                        <p className="text-xs font-bold">{Math.round(file.energy)}%</p>
                                                                    </div>
                                                                    <div className="glass p-2 rounded text-center">
                                                                        <p className="text-[8px] text-muted-foreground uppercase">Bright</p>
                                                                        <p className="text-xs font-bold">{Math.round(file.brightness)}%</p>
                                                                    </div>
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>

                        <div className="text-center pt-8">
                            <Button variant="outline" onClick={() => {
                                setFiles([]);
                                setResults([]);
                            }} className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-white/5">
                                新しく分析を開始する
                            </Button>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
