import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ProgressTracker from '../components/ProgressTracker';

const VideoPreview = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { assets = [], jobId = '' } = location.state || {};

    const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const videoRef = useRef(null);

    // If no assets, fallback or redirect
    useEffect(() => {
        if (!assets || assets.length === 0) {
            console.warn("No assets found in state, redirecting to storyboard");
            // navigate('/storyboard');
        }
    }, [assets, navigate]);

    const handleVideoEnd = () => {
        if (currentSceneIndex < assets.length - 1) {
            setCurrentSceneIndex(prev => prev + 1);
        } else {
            setIsPlaying(false);
            setCurrentSceneIndex(0); // Loop back to start or stay at end? Let's stay at end and pause.
        }
    };

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const downloadAsset = (type, fileName) => {
        window.open(`http://localhost:5000/api/download/${type}/${fileName}`, '_blank');
    };

    const currentAsset = assets[currentSceneIndex] || { videoUrl: '', title: 'No Video', narration: '' };

    return (
        <div className="flex flex-col h-screen bg-[#080d10] text-white overflow-hidden relative">
            <ProgressTracker currentStep={3} />

            {/* Ambient Background Glows */}
            <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-primary/[0.03] rounded-full blur-[120px] pointer-events-none" />
            <div className="fixed bottom-0 right-1/4 w-[400px] h-[400px] bg-cyan-500/[0.02] rounded-full blur-[100px] pointer-events-none" />

            <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 p-6">
                <div className="max-w-6xl mx-auto flex flex-col items-center">

                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[11px] font-semibold text-emerald-400 tracking-wider uppercase">Visuals Generated</span>
                        </div>
                        <h1 className="text-3xl md:text-5xl font-bold mb-3 tracking-tight">Preview Your Masterpiece</h1>
                        <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
                            Watch your scenes in sequence. You can download individual clips or continue to the editor for final touches.
                        </p>
                    </div>

                    <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

                        {/* Main Player Column */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="relative aspect-video bg-[#0c1418] rounded-3xl border border-slate-800/60 overflow-hidden shadow-2xl group">
                                <video
                                    ref={videoRef}
                                    src={currentAsset.videoUrl}
                                    onEnded={handleVideoEnd}
                                    onPlay={() => setIsPlaying(true)}
                                    onPause={() => setIsPlaying(false)}
                                    className="w-full h-full object-cover"
                                    autoPlay
                                />

                                {/* Overlay Controls */}
                                <div className={`absolute inset-0 bg-black/40 backdrop-blur-[1px] transition-opacity duration-500 flex items-center justify-center ${isPlaying ? 'opacity-0' : 'opacity-100'}`}>
                                    <button
                                        onClick={togglePlay}
                                        className="w-20 h-20 rounded-full bg-primary text-[#0a1215] flex items-center justify-center shadow-xl transform hover:scale-110 transition-all"
                                    >
                                        <span className="material-symbols-outlined text-4xl">
                                            {isPlaying ? 'pause' : 'play_arrow'}
                                        </span>
                                    </button>
                                </div>

                                {/* Current Scene Badge */}
                                <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold uppercase tracking-widest">
                                    Scene {currentSceneIndex + 1} / {assets.length}
                                </div>
                            </div>

                            {/* Narration & Prompt Display */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-[#0d1418] border border-slate-800/40 rounded-2xl p-5">
                                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px]">notes</span>
                                        Scene Narration
                                    </h3>
                                    <p className="text-slate-300 leading-relaxed text-[13px] line-clamp-4">
                                        {currentAsset.narration || "No narration available."}
                                    </p>
                                </div>
                                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
                                    <h3 className="text-[10px] font-black text-primary uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                                        AI Motion Prompt
                                    </h3>
                                    <p className="text-primary/70 leading-relaxed text-[13px] italic line-clamp-4">
                                        {currentAsset.videoPrompt || "No motion prompt generated."}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Sidebar: Scene Selection & Downloads */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">movie</span>
                                Sequential Scenes
                            </h3>

                            <div className="space-y-3 h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                                {assets.map((scene, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => setCurrentSceneIndex(idx)}
                                        className={`group relative flex items-center gap-4 p-3 rounded-2xl border transition-all cursor-pointer ${currentSceneIndex === idx
                                            ? 'bg-primary/5 border-primary/40 shadow-[0_0_20px_rgba(6,208,249,0.1)]'
                                            : 'bg-slate-900/40 border-slate-800/60 hover:border-slate-700'
                                            }`}
                                    >
                                        <div className="relative w-24 h-16 rounded-lg overflow-hidden flex-shrink-0">
                                            <img src={scene.imageUrl} alt={scene.title} className="w-full h-full object-cover" />
                                            {currentSceneIndex === idx && (
                                                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-primary">play_circle</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-xs font-bold text-white truncate mb-1">Scene {idx + 1}</h4>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); downloadAsset('video', scene.vidFileName); }}
                                                    className="text-[10px] text-primary hover:text-primary/80 font-bold flex items-center gap-1"
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">download</span>
                                                    Video
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); downloadAsset('image', scene.imgFileName); }}
                                                    className="text-[10px] text-slate-500 hover:text-white font-bold flex items-center gap-1"
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">image</span>
                                                    Img
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Global Actions */}
                            <div className="pt-4 space-y-3">
                                <button
                                    onClick={() => navigate('/editor', { state: { scenes: assets } })}
                                    className="w-full flex items-center justify-center gap-3 rounded-xl h-12 bg-slate-900 border border-slate-800 hover:border-primary/40 text-[12px] font-bold text-slate-400 hover:text-white transition-all transform active:scale-95"
                                >
                                    <span className="material-symbols-outlined text-[18px]">movie_edit</span>
                                    Open in Editor
                                </button>
                                <button
                                    className="w-full flex items-center justify-center gap-3 rounded-xl h-12 bg-primary text-[#0a1215] text-[12px] font-bold shadow-lg shadow-primary/20 transition-all transform active:scale-95 hover:bg-primary/90"
                                    onClick={() => alert("Downloading all scenes sequentially...")}
                                >
                                    <span className="material-symbols-outlined text-[18px]">file_download</span>
                                    Download All Assets
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default VideoPreview;
