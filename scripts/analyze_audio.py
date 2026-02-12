import os
import argparse
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import librosa
import soundfile as sf
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
import pandas as pd

def extract_features(file_path):
    try:
        y, sr = librosa.load(file_path, duration=30)  # Analyze first 30 seconds
        
        # Extract features
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        rms = librosa.feature.rms(y=y)[0]
        zcr = librosa.feature.zero_crossing_rate(y)[0]
        
        return {
            'filename': os.path.basename(file_path),
            'tempo': tempo,
            'brightness': np.mean(spectral_centroid),
            'energy': np.mean(rms),
            'percussiveness': np.mean(zcr)
        }
    except Exception as e:
        print(f"Error analyzing {file_path}: {e}")
        return None

def analyze_folder(folder_path, n_clusters=3):
    print(f"Scanning folder: {folder_path}...")
    audio_extensions = ('.mp3', '.wav', '.ogg', '.m4a', '.flac')
    files = []
    
    for root, _, filenames in os.walk(folder_path):
        for filename in filenames:
            if filename.lower().endswith(audio_extensions):
                files.append(os.path.join(root, filename))
    
    if not files:
        print("No audio files found.")
        return

    print(f"Found {len(files)} audio files. Analyzing...")
    
    features_list = []
    for file in files:
        print(f"Analyzing {os.path.basename(file)}...")
        feat = extract_features(file)
        if feat:
            features_list.append(feat)
            
    if not features_list:
        print("Could not extract features from any files.")
        return

    df = pd.DataFrame(features_list)
    
    # Normalize features
    scaler = StandardScaler()
    feature_columns = ['tempo', 'brightness', 'energy', 'percussiveness']
    X_scaled = scaler.fit_transform(df[feature_columns])
    
    # Reduce dimensionality (PCA) for correlation with axes
    pca = PCA(n_components=2)
    X_pca = pca.fit_transform(X_scaled)
    df['pca_1'] = X_pca[:, 0]
    df['pca_2'] = X_pca[:, 1]
    
    # Interpret Axes (Correlation with original features)
    loadings = pca.components_.T * np.sqrt(pca.explained_variance_)
    loading_df = pd.DataFrame(loadings, columns=['PC1', 'PC2'], index=feature_columns)
    print("\nFeature Loadings (Correlations with axes):")
    print(loading_df)

    # Determine axis labels dynamically
    xlabel = "PC1 (Composite)"
    ylabel = "PC2 (Composite)"
    
    # Simple heuristic: find feature with max absolute loading for each PC
    pc1_max_feature = loading_df['PC1'].abs().idxmax()
    pc2_max_feature = loading_df['PC2'].abs().idxmax()
    
    xlabel = f"Axis 1 (Dominant: {pc1_max_feature})"
    ylabel = f"Axis 2 (Dominant: {pc2_max_feature})"

    # Clustering
    kmeans = KMeans(n_clusters=min(n_clusters, len(df)), random_state=42)
    df['cluster'] = kmeans.fit_predict(X_scaled)
    
    # Visualization
    plt.figure(figsize=(10, 8))
    sns.set_style("whitegrid")
    
    scatter = sns.scatterplot(
        data=df, 
        x='pca_1', 
        y='pca_2', 
        hue='cluster', 
        palette='viridis', 
        s=100, 
        alpha=0.8,
        edgecolor='w'
    )
    
    # Annotate points
    for i, row in df.iterrows():
        plt.text(
            row['pca_1']+0.02, 
            row['pca_2']+0.02, 
            row['filename'], 
            fontsize=9, 
            alpha=0.7
        )
        
    plt.title(f"Audio Feature Clustering (n={len(df)})")
    plt.xlabel(xlabel)
    plt.ylabel(ylabel)
    plt.tight_layout()
    
    output_file = "analysis_result.png"
    plt.savefig(output_file, dpi=300)
    print(f"\nAnalysis complete. Visualization saved to {output_file}")
    print("\nCluster Summary:")
    print(df.groupby('cluster')[feature_columns].mean())

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Analyze and cluster audio files in a folder.")
    parser.add_argument("folder", nargs="?", default="./public/audio", help="Folder containing audio files")
    parser.add_argument("--clusters", type=int, default=3, help="Number of clusters")
    
    args = parser.parse_args()
    analyze_folder(args.folder, args.clusters)
