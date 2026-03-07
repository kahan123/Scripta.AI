import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProgressTracker from '../components/ProgressTracker';
import { mockScenes } from '../data/mockData';

const placeholderColors = [
    'from-cyan-900/40 to-slate-900',
    'from-indigo-900/40 to-slate-900',
    'from-blue-900/40 to-slate-900',
    'from-teal-900/40 to-slate-900',
    'from-violet-900/40 to-slate-900',
];

const SceneReview = () => {
    const navigate = useNavigate();
    const [activeIndex, setActiveIndex] = useState(0);
    const [scenes, setScenes] = useState(mockScenes);
    const [showCitation, setShowCitation] = useState(false);
    const [isCompiling, setIsCompiling] = useState(false);

    const active = scenes[activeIndex];

    const updateNarration = (value) => {
        setScenes((prev) =>
            prev.map((s, i) => (i === activeIndex ? { ...s, narration: value } : s))
        );
    };

    const handleCompile = () => {
        setIsCompiling(true);
        setTimeout(() => navigate('/editor'), 2500);
    };

    const confidenceColor = (c) => {
        if (c >= 0.9) return 'bg-emerald-500';
        if (c >= 0.8) return 'bg-amber-500';
        return 'bg-red-500';
    };

    const confidenceLabel = (c) => {
        if (c >= 0.9) return 'High Confidence';
        if (c >= 0.8) return 'Medium Confidence';
        return 'Low Confidence';
    };

    return (
        <div className="flex flex-col h-screen bg-[#080d10] text-white overflow-hidden">
            <ProgressTracker />

            {/* ── Thumbnail Carousel ── */}
            <div className="flex-shrink-0 border-b border-slate-800/50 bg-[#0a1014]/60 px-6 py-3">
                <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-thin">
                    {scenes.map((scene, i) => (
                        <button
                            key={scene.id}
                            onClick={() => setActiveIndex(i)}
                            className={`flex-shrink-0 group relative rounded-lg overflow-hidden transition-all duration-300 ${i === activeIndex
                                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-[#080d10] scale-105'
                                    : 'opacity-60 hover:opacity-90'
                                }`}
                        >
                            <div className={`w-28 h-16 bg-gradient-to-br ${placeholderColors[i % placeholderColors.length]} flex items-center justify-center`}>
                                <span className="material-symbols-outlined text-slate-500 text-2xl">image</span>
                            </div>
                            <div className="absolute bottom-0 inset-x-0 bg-black/60 px-2 py-0.5">
                                <span className="text-[10px] font-medium text-slate-300">Scene {scene.sceneNumber}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Main Content ── */}
            <div className="flex flex-1 overflow-hidden">
                {/* Center: Active Scene Viewer */}
                <div className="flex-1 flex flex-col items-center justify-center p-8">
                    <div className={`w-full max-w-2xl aspect-video rounded-2xl bg-gradient-to-br ${placeholderColors[activeIndex % placeholderColors.length]} border border-slate-800/60 flex flex-col items-center justify-center gap-4 shadow-2xl`}>
                        <span className="material-symbols-outlined text-slate-500 text-6xl">image</span>
                        <div className="text-center px-8">
                            <p className="text-slate-400 text-sm font-medium">{active.visualType}</p>
                            <p className="text-slate-500 text-xs mt-1 max-w-md">{active.visualIdea}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 mt-6">
                        <button
                            onClick={() => setActiveIndex(Math.max(0, activeIndex - 1))}
                            disabled={activeIndex === 0}
                            className="p-2 rounded-full bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 transition-all"
                        >
                            <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <span className="text-sm text-slate-500">
                            Scene {active.sceneNumber} of {scenes.length}
                        </span>
                        <button
                            onClick={() => setActiveIndex(Math.min(scenes.length - 1, activeIndex + 1))}
                            disabled={activeIndex === scenes.length - 1}
                            className="p-2 rounded-full bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 transition-all"
                        >
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>
                </div>

                {/* Right Panel: Co-Editor */}
                <aside className="w-96 flex-shrink-0 border-l border-slate-800/50 bg-[#0a1014] flex flex-col overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-800/50">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Co-Editor</h3>
                        <p className="text-xs text-slate-600 mt-0.5">Scene {active.sceneNumber} — {active.section}</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-5">
                        {/* Narration / Script Box */}
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                                <span className="material-symbols-outlined text-[14px] align-middle mr-1">edit_note</span>
                                Narration Script
                            </label>
                            <textarea
                                value={active.narration}
                                onChange={(e) => updateNarration(e.target.value)}
                                rows={4}
                                className="w-full bg-slate-900/60 border border-slate-800/60 rounded-lg p-3 text-sm text-slate-200 leading-relaxed resize-none focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
                            />
                        </div>

                        {/* Visual Prompt Box */}
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                                <span className="material-symbols-outlined text-[14px] align-middle mr-1">brush</span>
                                Visual Prompt
                            </label>
                            <div className="bg-slate-900/60 border border-slate-800/60 rounded-lg p-3">
                                <p className="text-sm text-indigo-300/80 leading-relaxed">{active.visualIdea}</p>
                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-xs text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full">{active.visualType}</span>
                                    <button className="text-xs text-primary/60 hover:text-primary transition-colors">
                                        Regenerate
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Citation Badge */}
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                                <span className="material-symbols-outlined text-[14px] align-middle mr-1">menu_book</span>
                                Source Citation
                            </label>
                            <button
                                onClick={() => setShowCitation(!showCitation)}
                                className="w-full flex items-center gap-3 bg-slate-900/60 border border-slate-800/60 rounded-lg p-3 hover:border-amber-500/30 transition-all text-left"
                            >
                                <span className="material-symbols-outlined text-amber-500 text-[20px]">verified</span>
                                <div className="flex-1">
                                    <p className="text-xs text-amber-400 font-medium">Traceable Source</p>
                                    {showCitation && (
                                        <p className="text-xs text-slate-400 mt-1">{active.citation}</p>
                                    )}
                                </div>
                                <span className="material-symbols-outlined text-slate-600 text-[16px]">
                                    {showCitation ? 'expand_less' : 'expand_more'}
                                </span>
                            </button>
                        </div>

                        {/* Confidence Indicator */}
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                                <span className="material-symbols-outlined text-[14px] align-middle mr-1">analytics</span>
                                AI Confidence
                            </label>
                            <div className="bg-slate-900/60 border border-slate-800/60 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-slate-300">{confidenceLabel(active.confidence)}</span>
                                    <span className="text-sm font-bold text-white">{Math.round(active.confidence * 100)}%</span>
                                </div>
                                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${confidenceColor(active.confidence)}`}
                                        style={{ width: `${active.confidence * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Compile Button */}
                    <div className="flex-shrink-0 p-5 border-t border-slate-800/50">
                        <button
                            onClick={handleCompile}
                            disabled={isCompiling}
                            className={`w-full flex items-center justify-center gap-2.5 rounded-full h-12 text-sm font-bold transition-all transform hover:scale-[1.01] active:scale-[0.99] ${isCompiling
                                    ? 'bg-primary/30 text-primary/50 cursor-wait'
                                    : 'bg-primary hover:bg-primary/90 text-[#0a1215] shadow-lg shadow-primary/25'
                                }`}
                        >
                            {isCompiling ? (
                                <>
                                    <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                                    <span>Compiling Video...</span>
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-[20px]">movie_creation</span>
                                    <span>Compile Final Video</span>
                                </>
                            )}
                        </button>
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default SceneReview;
