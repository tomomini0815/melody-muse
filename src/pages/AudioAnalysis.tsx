
import { useState, useCallback, useMemo } from "react";
// Removed react-dropzone imports to use native handlers
import {
    ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ZAxis, Legend, ReferenceLine, ReferenceArea
} from "recharts";
import { motion } from "framer-motion";
import { analyzeAudioFile, AudioFeatures, performClustering } from "@/lib/audio-analysis";
import { Button } from "@/components/ui/button";
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
        <div className="min-h-screen bg-background relative overflow-hidden p-8">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/">
                            <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-3xl font-display font-bold gradient-text">Audio Analysis Studio</h1>
                            <p className="text-sm text-muted-foreground">楽曲ライブラリの音響特性を可視化します</p>
                        </div>
                    </div>

                    <div className="flex gap-3">
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
                    </div>
                </div>

                {/* Dropzone */}
                {results.length === 0 && (
                    <div
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        className={`border-2 border-dashed rounded-3xl p-20 text-center transition-all glass relative cursor-pointer
                    ${isDragActive ? "border-primary bg-primary/5" : "border-zinc-800 hover:border-zinc-600 hover:bg-white/5"}
                `}
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

                        <div className="flex flex-col items-center gap-6 z-10 relative pointer-events-none">
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-zinc-800 to-black border border-white/10 flex items-center justify-center shadow-2xl">
                                {analyzing ? <Loader2 className="w-10 h-10 animate-spin text-primary" /> : <Upload className="w-10 h-10 text-primary" />}
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-3xl font-bold tracking-tight">
                                    {analyzing ? `分析中... ${progress.current}/${progress.total}` : "フォルダをドロップ"}
                                </h3>
                                <p className="text-zinc-400 max-w-md mx-auto">
                                    音楽ファイルの入ったフォルダをドラッグ＆ドロップしてください。
                                    <br /><span className="text-xs opacity-50">MP3, WAV, FLAC 対応</span>
                                </p>
                            </div>

                            {!analyzing && (
                                <Button variant="outline" className="mt-4 border-white/20 hover:bg-white/10 pointer-events-none">
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
                        <Card className="glass border-white/5 bg-black/40 backdrop-blur-md overflow-hidden">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-xl font-light">
                                    <div className="flex items-center gap-2">
                                        <Music className="w-5 h-5 text-primary" />
                                        楽曲特性マップ (Sonic Landscape)
                                    </div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="h-[600px] w-full p-4 relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 30 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />

                                        <XAxis
                                            type="number" dataKey="brightness" name="Brightness" unit="%"
                                            label={{ value: 'Brightness (Timbre)', position: 'bottom', fill: '#666', offset: 0 }}
                                            stroke="#555" domain={[0, 100]} tick={{ fill: '#666' }}
                                        />
                                        <YAxis
                                            type="number" dataKey="energy" name="Energy" unit="%"
                                            label={{ value: 'Energy (Intensity)', angle: -90, position: 'insideLeft', fill: '#666' }}
                                            stroke="#555" domain={[0, 100]} tick={{ fill: '#666' }}
                                        />
                                        <ZAxis type="number" dataKey="size" range={[50, 400]} />

                                        <ReferenceLine x={50} stroke="#444" strokeDasharray="3 3" />
                                        <ReferenceLine y={50} stroke="#444" strokeDasharray="3 3" />

                                        <ReferenceArea x1={50} x2={100} y1={50} y2={100} fill="transparent" stroke="none" label={{ value: "Energetic & Bright", position: 'insideTopRight', fill: '#4ade80', fontSize: 12, opacity: 0.5 }} />
                                        <ReferenceArea x1={0} x2={50} y1={50} y2={100} fill="transparent" stroke="none" label={{ value: "Energetic & Dark", position: 'insideTopLeft', fill: '#ff4b4b', fontSize: 12, opacity: 0.5 }} />
                                        <ReferenceArea x1={50} x2={100} y1={0} y2={50} fill="transparent" stroke="none" label={{ value: "Calm & Bright", position: 'insideBottomRight', fill: '#00d4ff', fontSize: 12, opacity: 0.5 }} />
                                        <ReferenceArea x1={0} x2={50} y1={0} y2={50} fill="transparent" stroke="none" label={{ value: "Calm & Dark", position: 'insideBottomLeft', fill: '#a855f7', fontSize: 12, opacity: 0.5 }} />

                                        <Tooltip
                                            cursor={{ strokeDasharray: '3 3' }}
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const data = payload[0].payload as AudioFeatures;
                                                    return (
                                                        <div className="glass p-4 rounded-xl border border-white/10 bg-black/90 shadow-xl">
                                                            <p className="font-bold text-primary mb-2 text-sm">{data.name}</p>
                                                            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-zinc-400">
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
                                        <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />

                                        {Object.keys(groupedResults).map((clusterKey) => {
                                            const index = parseInt(clusterKey);
                                            return (
                                                <Scatter
                                                    key={index}
                                                    name={CLUSTER_NAMES[index] || `Cluster ${index + 1}`}
                                                    data={groupedResults[index]}
                                                    fill={CLUSTER_COLORS[index % CLUSTER_COLORS.length]}
                                                    fillOpacity={0.8}
                                                />
                                            );
                                        })}
                                    </ScatterChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Grouped Lists */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {Object.keys(groupedResults).map((clusterKey) => {
                                const index = parseInt(clusterKey);
                                const clusterName = CLUSTER_NAMES[index] || `Cluster ${index + 1}`;
                                const color = CLUSTER_COLORS[index % CLUSTER_COLORS.length];
                                const items = groupedResults[index];

                                return (
                                    <Card key={index} className="glass border-white/5 bg-transparent overflow-hidden flex flex-col h-full">
                                        <CardHeader className="pb-3 border-b border-white/5 bg-white/5">
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-base font-medium flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-full shadow-[0_0_10px]" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }} />
                                                    {clusterName}
                                                </CardTitle>
                                                <Badge variant="secondary" className="bg-black/20 text-xs">{items.length} 曲</Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-0 overflow-y-auto max-h-[400px]">
                                            <div className="divide-y divide-white/5">
                                                {items.map((file, i) => (
                                                    <div key={i} className="p-4 hover:bg-white/5 transition-colors flex items-center justify-between group">
                                                        <div className="min-w-0 pr-4">
                                                            <p className="text-sm font-medium truncate text-zinc-200 group-hover:text-white transition-colors">
                                                                {file.name}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                                テンポ: {Math.round(file.tempo)} • Energy: {Math.round(file.energy)}%
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
