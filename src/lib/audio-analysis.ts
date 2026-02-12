
export interface AudioFeatures {
    name: string;
    size: number;
    duration: number;
    brightness: number; // Spectral Centroid
    energy: number;     // RMS
    tempo: number;      // BPM (Approximation)
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

export const analyzeAudioFile = async (file: File): Promise<AudioFeatures> => {
    if (file.size === 0) {
        throw new Error("File is empty (0 bytes)");
    }

    const arrayBuffer = await file.arrayBuffer();
    const audioContext = getAudioContext();

    let audioBuffer: AudioBuffer;
    try {
        // Use the shared context for decoding. 
        // Note: decodeAudioData might still fail on some browsers if context is suspended.
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    } catch (e) {
        throw new Error(`Failed to decode audio data. The file might be corrupt or the format is unsupported by your browser. Error: ${(e as Error).message}`);
    }

    const channelData = audioBuffer.getChannelData(0); // Use first channel
    const sampleRate = audioBuffer.sampleRate;

    // 1. RMS Energy (Loudness/Energy)
    let sumSquares = 0;
    for (let i = 0; i < channelData.length; i++) {
        sumSquares += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sumSquares / channelData.length);
    const energy = Math.min(100, Math.max(0, (Math.log10(rms) * 20 + 60) * 1.6)); // Normalize roughly 0-100

    // 2. Spectral Centroid (Brightness) - Simplified approximation
    // FFT is expensive on full track, so we take chunks
    const fftSize = 2048;
    const numChunks = 50; // Analyze 50 chunks distributed across the track
    const chunkSize = Math.floor(channelData.length / numChunks);

    let totalCentroid = 0;
    let validChunks = 0;

    for (let i = 0; i < numChunks; i++) {
        const start = i * chunkSize;
        const chunk = channelData.slice(start, start + fftSize);
        if (chunk.length < fftSize) continue;

        const real = new Float32Array(chunk);
        const imag = new Float32Array(fftSize);
        // Simple windowing (Hanning)
        for (let j = 0; j < fftSize; j++) {
            real[j] *= 0.5 * (1 - Math.cos(2 * Math.PI * j / (fftSize - 1)));
        }

        // Note: Implementing a full FFT requires a library or complex code.
        // For a lightweight solution without extra deps, we'll use Zero Crossing Rate as a proxy for "Brightness/High Frequency Content"
        // OR we can use the Web Audio API AnalyserNode if we actually played it, but we want offline analysis.
        // Let's stick to Zero Crossing Rate (ZCR) as a crude proxy for brightness/noisiness for now to avoid massive FFT implementation.

        let zeroCrossings = 0;
        for (let j = 1; j < chunk.length; j++) {
            if ((chunk[j] >= 0 && chunk[j - 1] < 0) || (chunk[j] < 0 && chunk[j - 1] >= 0)) {
                zeroCrossings++;
            }
        }
        totalCentroid += zeroCrossings;
        validChunks++;
    }

    // Normalize ZCR to 0-100 brightness scale (approx)
    // Max ZCR per chunk (2048 samples) is 1024. Typical music is much lower.
    const avgZCR = validChunks > 0 ? totalCentroid / validChunks : 0;
    const brightness = Math.min(100, (avgZCR / (fftSize / 4)) * 100 * 3); // Scaling factor

    // 3. Tempo (BPM) - Very crude peak detection on energy
    // Proper BPM detection is hard. We ll generate a "Tempo Index" based on energy variance.
    // High variance = punchy/rhythmic. Low variance = drone/ambient.
    // NOT ACTUAL BPM, but "Rhythmic Intensitiy" mapped to 60-180 range
    const hop = 1024;
    let energyPeaks = 0;
    let prevEnergy = 0;
    for (let i = 0; i < channelData.length; i += hop) {
        let localsum = 0;
        for (let j = 0; j < hop && i + j < channelData.length; j++) {
            localsum += channelData[i + j] * channelData[i + j];
        }
        const localRms = Math.sqrt(localsum / hop);
        if (localRms > prevEnergy * 1.5 && localRms > 0.05) {
            energyPeaks++;
        }
        prevEnergy = localRms;
    }
    const durationSeconds = audioBuffer.duration;
    const density = energyPeaks / durationSeconds;
    const tempo = Math.min(180, Math.max(60, 60 + density * 5));

    return {
        name: file.name,
        size: file.size,
        duration: audioBuffer.duration,
        energy: parseFloat(energy.toFixed(1)),
        brightness: parseFloat(brightness.toFixed(1)),
        tempo: Math.floor(tempo),
    };
};

export const performClustering = (items: AudioFeatures[], k: number = 3): AudioFeatures[] => {
    if (items.length < k) return items.map(i => ({ ...i, cluster: 0 }));

    // Initialize centroids naturally from data points
    let centroids = items.slice(0, k).map(i => ({ e: i.energy, b: i.brightness }));

    // Simple K-Means (5 iterations is usually enough for simple 2D data)
    for (let iter = 0; iter < 10; iter++) {
        // Assign clusters
        items.forEach(item => {
            let minDist = Infinity;
            let clusterIndex = 0;
            centroids.forEach((c, idx) => {
                const dist = Math.sqrt(Math.pow(item.energy - c.e, 2) + Math.pow(item.brightness - c.b, 2));
                if (dist < minDist) {
                    minDist = dist;
                    clusterIndex = idx;
                }
            });
            item.cluster = clusterIndex;
        });

        // Update centroids
        centroids = centroids.map((_, idx) => {
            const clusterItems = items.filter(i => i.cluster === idx);
            if (clusterItems.length === 0) return centroids[idx]; // Keep old if empty
            const avgE = clusterItems.reduce((sum, i) => sum + i.energy, 0) / clusterItems.length;
            const avgB = clusterItems.reduce((sum, i) => sum + i.brightness, 0) / clusterItems.length;
            return { e: avgE, b: avgB };
        });
    }

    return items;
};
