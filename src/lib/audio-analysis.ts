
export interface AudioFeatures {
    name: string;
    size: number;
    duration: number;
    brightness: number; // Spectral Centroid (ZCR Proxy)
    energy: number;     // RMS
    tempo: number;      // BPM (Peak Density)
    cluster?: number;
}

// Singleton AudioContext to prevent resource exhaustion
let sharedAudioContext: AudioContext | null = null;

const getAudioContext = () => {
    if (!sharedAudioContext) {
        sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return sharedAudioContext;
};

/**
 * Polished Simple Audio Analysis
 * Based on user preference for the "feel" of initial results.
 */
export const analyzeAudioFile = async (file: File): Promise<AudioFeatures> => {
    if (file.size === 0) throw new Error("File is empty");

    const arrayBuffer = await file.arrayBuffer();
    const audioContext = getAudioContext();

    if (audioContext.state === 'suspended') await audioContext.resume();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const channelData = audioBuffer.getChannelData(0); // Use first channel
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;

    // 1. RMS Energy (Polished normalization for better contrast)
    let sumSquares = 0;
    const step = Math.max(1, Math.floor(channelData.length / 20000)); // Sample 20k points for speed
    let count = 0;
    for (let i = 0; i < channelData.length; i += step) {
        sumSquares += channelData[i] * channelData[i];
        count++;
    }
    const rms = Math.sqrt(sumSquares / count);
    // Emotional scaling: Push typical mastered music (0.12 - 0.25 RMS) to fill 10% - 90%
    // This makes "relatively quiet" tracks feel "Calm" in the context of a library.
    const energy = Math.min(100, Math.max(0, (rms - 0.08) * 650 + 20));

    // 2. Brightness (Zero Crossing Rate weighted by Energy)
    // High ZCR = high frequency content / noise / brightness
    // High contrast scaling for ZCR: 0.02 -> 0%, 0.12 -> 100%
    let zeroCrossings = 0;
    const zcrWindow = 1024;
    let zcrFrames = 0;

    // Analyze chunks distributed across the track
    const numZcrChunks = 60;
    const zcrHop = Math.floor(channelData.length / numZcrChunks);

    for (let i = 0; i < numZcrChunks; i++) {
        const start = i * zcrHop;
        if (start + zcrWindow > channelData.length) break;

        for (let j = start + 1; j < start + zcrWindow; j++) {
            if ((channelData[j] >= 0 && channelData[j - 1] < 0) || (channelData[j] < 0 && channelData[j - 1] >= 0)) {
                zeroCrossings++;
            }
        }
        zcrFrames++;
    }

    const avgZCR = zcrFrames > 0 ? zeroCrossings / (zcrFrames * zcrWindow) : 0;
    const brightness = Math.min(100, Math.max(0, (avgZCR - 0.02) * 1000));

    // 3. Tempo (Refined peak density)
    // Count "beats" where energy jumps significantly
    const peakHop = 2048;
    let peaks = 0;
    let prevE = 0;
    for (let i = 0; i < channelData.length; i += peakHop) {
        let localSum = 0;
        const limit = Math.min(i + peakHop, channelData.length);
        for (let j = i; j < limit; j++) localSum += channelData[j] * channelData[j];
        const localE = Math.sqrt(localSum / (limit - i));

        if (localE > prevE * 1.6 && localE > 0.04) {
            peaks++;
        }
        prevE = localE;
    }
    const density = peaks / duration;
    // Map density to a plausible BPM range (60-180)
    const tempo = Math.min(180, Math.max(60, 70 + density * 12));

    return {
        name: file.name,
        size: file.size,
        duration: duration,
        energy: parseFloat(energy.toFixed(1)),
        brightness: parseFloat(brightness.toFixed(1)),
        tempo: Math.floor(tempo),
    };
};

export const performClustering = (items: AudioFeatures[], k: number = 3): AudioFeatures[] => {
    if (items.length < k) return items.map(i => ({ ...i, cluster: 0 }));

    // Simple 2D K-Means (Energy vs Brightness) - user preferred the original "feel"
    let centroids = items.slice(0, k).map(i => ({ e: i.energy, b: i.brightness }));

    for (let iter = 0; iter < 10; iter++) {
        items.forEach(item => {
            let minDist = Infinity;
            let clusterIdx = 0;
            centroids.forEach((c, idx) => {
                const dist = Math.sqrt(Math.pow(item.energy - c.e, 2) + Math.pow(item.brightness - c.b, 2));
                if (dist < minDist) { minDist = dist; clusterIdx = idx; }
            });
            item.cluster = clusterIdx;
        });

        centroids = centroids.map((_, idx) => {
            const cItems = items.filter(i => i.cluster === idx);
            if (cItems.length === 0) return centroids[idx];
            return {
                e: cItems.reduce((s, i) => s + i.energy, 0) / cItems.length,
                b: cItems.reduce((s, i) => s + i.brightness, 0) / cItems.length
            };
        });
    }
    return items;
};

