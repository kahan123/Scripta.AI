import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import axios from 'axios';
import ProgressTracker from '../components/ProgressTracker';
import ScriptaChatBot from '../components/ScriptaChatBot';
import { mockScenes as initialScenes } from '../data/mockData';

const Storyboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const promptFromState = location.state?.prompt || '';

    const [phase, setPhase] = useState('script'); // 'script' | 'animating' | 'scenes'
    const [script, setScript] = useState('');
    const [scenes, setScenes] = useState(initialScenes);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingScript, setIsGeneratingScript] = useState(false);
    const [isBreakingDown, setIsBreakingDown] = useState(false);

    const containerRef = useRef(null);

    const hasRequestedInitial = useRef(false);

    // Fetch initial storyboard text on mount
    useEffect(() => {
        const generateInitialStoryboard = async () => {
            if (hasRequestedInitial.current) return;
            if (!promptFromState) {
                setScript("No prompt provided. Please go back to the home page or type a script here.");
                return;
            }

            setIsGeneratingScript(true);
            try {
                const response = await axios.post('http://localhost:5000/api/generate-storyboard', {
                    prompt: promptFromState
                });
                setScript(response.data.storyboard);
            } catch (error) {
                console.error("Error generating storyboard:", error);
                setScript("Failed to generate storyboard. Please try again or edit manually.");
            } finally {
                setIsGeneratingScript(false);
            }
        };

        generateInitialStoryboard();
        hasRequestedInitial.current = true;
    }, [promptFromState]);

    // Entrance animation for the script box
    useGSAP(() => {
        if (phase === 'script') {
            gsap.from('.script-box', {
                y: 40,
                opacity: 0,
                duration: 0.8,
                ease: 'power3.out',
                delay: 0.2,
            });
        }
    }, { scope: containerRef, dependencies: [phase] });

    // Animate scene cards AFTER React renders them
    useEffect(() => {
        if (phase === 'scenes') {
            gsap.from('.scene-card', {
                y: 60,
                opacity: 0,
                scale: 0.9,
                duration: 0.6,
                stagger: 0.1,
                ease: 'back.out(1.4)',
                clearProps: 'all',
            });
        }
    }, [phase]);

    const handleApproveScript = async () => {
        if (isBreakingDown) return;
        setIsBreakingDown(true);
        try {
            const response = await axios.post('http://localhost:5000/api/breakdown-storyboard', {
                storyboard: script
            });

            // Map backend scenes to frontend structure with 4 colors
            const colors = ['#06d0f9', '#818cf8', '#34d399', '#a78bfa'];
            const formattedScenes = response.data.scenes.map((s, i) => ({
                id: s.sceneNumber,
                sceneNumber: s.sceneNumber,
                title: `Scene ${s.sceneNumber}`,
                narration: s.description,
                visualPrompt: s.imagePrompt,
                videoPrompt: s.videoPrompt,
                visualType: 'Cinematic',
                duration: 5,
                color: colors[i % colors.length]
            }));

            setScenes(formattedScenes);
            setPhase('scenes');
        } catch (error) {
            console.error("Error breaking down storyboard:", error);
            alert("Failed to break down storyboard into scenes. Using fallback logic.");
            setPhase('scenes');
        } finally {
            setIsBreakingDown(false);
        }
    };

    const [isGeneratingVisuals, setIsGeneratingVisuals] = useState(false);
    const [visualsProgress, setVisualsProgress] = useState(0);
    const [visualsStatus, setVisualsStatus] = useState('Initializing...');

    const handleApproveScenes = async () => {
        if (isGeneratingVisuals) return;
        setIsGeneratingVisuals(true);
        setVisualsProgress(0);
        setVisualsStatus('Starting background job...');

        try {
            // Initiate integrated generation job
            const response = await axios.post('http://localhost:5000/api/generate-scene-visuals', {
                scenes: scenes
            });

            const { jobId } = response.data;
            if (!jobId) throw new Error("Job ID not received");

            // Polling for status
            const pollInterval = setInterval(async () => {
                try {
                    const statusRes = await axios.get(`http://localhost:5000/api/generation-status/${jobId}`);
                    const { status, progress, assets, error } = statusRes.data;

                    setVisualsProgress(progress);

                    if (status === 'completed') {
                        clearInterval(pollInterval);
                        setVisualsStatus('Generation Complete!');
                        setTimeout(() => {
                            navigate('/preview', { state: { assets, jobId } });
                        }, 1000);
                    } else if (status === 'failed') {
                        clearInterval(pollInterval);
                        alert(`Generation failed: ${error}`);
                        setIsGeneratingVisuals(false);
                    } else {
                        // Update status text based on progress
                        const sceneNum = Math.min(Math.floor(progress / (100 / scenes.length)) + 1, scenes.length);
                        const isVideo = (progress % (100 / scenes.length)) >= (50 / scenes.length);
                        setVisualsStatus(`Scene ${sceneNum}: ${isVideo ? 'Animating Video' : 'Painting Image'}...`);
                    }
                } catch (pollErr) {
                    console.error("Polling error:", pollErr);
                }
            }, 3000);

        } catch (error) {
            console.error("Error initiating visuals generation:", error);
            alert("Failed to start integrated generation.");
            setIsGeneratingVisuals(false);
        }
    };

    const [editingSceneIds, setEditingSceneIds] = useState(new Set());

    const toggleEdit = (id) => {
        setEditingSceneIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const updateScene = (id, field, value) => {
        setScenes((prev) =>
            prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
        );
    };

    const setSetScenes = useCallback((newScenes) => {
        setScenes(newScenes);
    }, []);

    return (
        <div ref={containerRef} className="flex flex-col h-screen bg-[#080d10] text-white overflow-hidden">
            <ProgressTracker currentStep={phase === 'script' || phase === 'animating' ? 1 : 2} />

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-6xl mx-auto px-6 py-8 min-h-full flex flex-col">

                    {/* ══════ SCRIPT PHASE ══════ */}
                    {phase !== 'scenes' && (
                        <div className="script-phase flex flex-col flex-1">
                            {/* Header */}
                            <div className="text-center mb-8 flex-shrink-0">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-3">
                                    <span className="material-symbols-outlined text-primary text-[14px]">edit_square</span>
                                    <span className="text-[10px] font-bold text-primary tracking-widest uppercase">Script Development</span>
                                </div>
                                <h1 className="text-2xl md:text-3xl font-bold mb-2">Review Your Storyboard</h1>
                                <p className="text-slate-500 text-sm">Refine your cinematic story manually or with the Scripta AI Chat Bot.</p>
                            </div>

                            <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 mb-6">
                                {/* Big Script Box */}
                                <div className="script-box flex-1 min-h-0 bg-[#0d1418] border border-slate-800/60 rounded-2xl flex flex-col shadow-xl overflow-hidden relative group">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-primary/40 group-hover:bg-primary transition-colors duration-500" />
                                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-800/40 flex-shrink-0 bg-slate-900/20">
                                        <span className="material-symbols-outlined text-primary text-xl">description</span>
                                        <h3 className="text-sm font-semibold text-slate-300">Generated Storyboard</h3>
                                        <span className="ml-auto text-[10px] font-bold text-slate-600 uppercase tracking-widest bg-slate-800/50 px-2 py-0.5 rounded-full">
                                            {isGeneratingScript ? 'Writing...' : `${script.split(' ').length} words`}
                                        </span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-6 relative">
                                        {isGeneratingScript ? (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d1418]/80 backdrop-blur-sm z-10">
                                                <div className="w-10 h-10 border-3 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
                                                <p className="text-primary text-xs font-bold animate-pulse uppercase tracking-widest">AI is crafting your story...</p>
                                            </div>
                                        ) : null}
                                        <textarea
                                            value={script}
                                            onChange={(e) => setScript(e.target.value)}
                                            className="w-full h-full min-h-[400px] bg-transparent text-slate-200 text-[15px] leading-[1.85] resize-none focus:outline-none font-display selection:bg-primary/20 custom-scrollbar"
                                            spellCheck={false}
                                            placeholder="Your storyboard will appear here..."
                                        />
                                    </div>
                                </div>

                                {/* Sidebar AI Assistant */}
                                <div className="lg:w-[380px] flex flex-col min-h-[450px] lg:min-h-0">
                                    <ScriptaChatBot
                                        inline={true}
                                        mode="storyboard"
                                        context={script}
                                        onUpdate={setScript}
                                    />
                                </div>
                            </div>

                            <div className="flex-shrink-0 flex justify-center pb-8 pt-2">
                                <button
                                    onClick={handleApproveScript}
                                    disabled={isGeneratingScript || isBreakingDown || !script}
                                    className={`approve-btn flex items-center gap-3 rounded-2xl h-14 px-12 text-sm font-bold transition-all transform hover:scale-[1.02] active:scale-[0.98] ${isBreakingDown ? 'bg-primary/50 cursor-wait' : 'bg-primary hover:bg-primary/90'
                                        } text-[#0a1215] shadow-[0_0_30px_rgba(6,208,249,0.3)]`}
                                >
                                    {isBreakingDown ? (
                                        <>
                                            <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                                            <span>Breaking into 4 Scenes...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-[20px]">check_circle</span>
                                            <span>Approve & Generate Scenes</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ══════ SCENES PHASE ══════ */}
                    {phase === 'scenes' && (
                        <div className="scenes-phase flex flex-col flex-1">
                            {/* Header */}
                            <div className="text-center mb-8 flex-shrink-0">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-3">
                                    <span className="material-symbols-outlined text-primary text-[14px]">dashboard</span>
                                    <span className="text-[10px] font-bold text-primary tracking-widest uppercase">Scene Breakdown</span>
                                </div>
                                <h1 className="text-2xl md:text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">Cinematic Breakdown</h1>
                                <p className="text-slate-500 text-sm">Direct your scenes with the AI assistant or edit manually below.</p>
                            </div>

                            <div className="flex flex-col lg:flex-row gap-8 flex-1 min-h-0">
                                {/* Scene Cards Grid */}
                                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {scenes.map((scene, index) => {
                                            const isEditing = editingSceneIds.has(scene.id);
                                            return (
                                                <div
                                                    key={scene.id}
                                                    className="scene-card group relative rounded-2xl transition-all duration-300"
                                                >
                                                    <div
                                                        className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm"
                                                        style={{ background: `linear-gradient(135deg, ${scene.color}30, transparent 60%)` }}
                                                    />

                                                    <div className="relative bg-[#0c1418] border border-slate-800/50 rounded-2xl overflow-hidden group-hover:border-slate-700/60 transition-colors">
                                                        <div className="flex">
                                                            <div className="w-1 flex-shrink-0" style={{ background: scene.color }} />

                                                            <div className="flex-1 p-5">
                                                                <div className="flex items-center justify-between mb-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div
                                                                            className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black shadow-lg"
                                                                            style={{
                                                                                background: `linear-gradient(135deg, ${scene.color}40, ${scene.color}15)`,
                                                                                color: scene.color,
                                                                                boxShadow: `0 0 20px ${scene.color}15`
                                                                            }}
                                                                        >
                                                                            {index + 1}
                                                                        </div>
                                                                        <div>
                                                                            <h4 className="text-[15px] font-bold text-white leading-tight">{scene.title}</h4>
                                                                        </div>
                                                                    </div>

                                                                    <button
                                                                        onClick={() => toggleEdit(scene.id)}
                                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${isEditing
                                                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(52,211,153,0.1)]'
                                                                            : 'bg-slate-800/40 text-slate-400 hover:text-white border border-slate-700/50 hover:bg-slate-700/60'
                                                                            }`}
                                                                    >
                                                                        <span className="material-symbols-outlined text-[14px]">
                                                                            {isEditing ? 'done' : 'edit'}
                                                                        </span>
                                                                        {isEditing ? 'DONE' : 'EDIT'}
                                                                    </button>
                                                                </div>

                                                                <textarea
                                                                    value={scene.narration}
                                                                    onChange={(e) => updateScene(scene.id, 'narration', e.target.value)}
                                                                    readOnly={!isEditing}
                                                                    rows={4}
                                                                    className={`w-full border rounded-xl p-4 text-[13px] leading-[1.7] resize-none focus:outline-none transition-all placeholder:text-slate-700 ${isEditing
                                                                        ? 'bg-slate-900/50 border-primary/30 text-slate-200'
                                                                        : 'bg-slate-900/10 border-slate-800/30 text-slate-500 cursor-default'
                                                                        }`}
                                                                    placeholder="Click Edit to modify narration..."
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-8 flex justify-center">
                                        <button
                                            onClick={handleApproveScenes}
                                            disabled={isGeneratingVisuals}
                                            className={`scenes-approve-btn flex items-center gap-3 rounded-2xl h-14 px-12 text-sm font-bold transition-all transform hover:scale-[1.02] active:scale-[0.98] ${isGeneratingVisuals ? 'bg-primary/30 text-primary/50 cursor-wait' : 'bg-primary hover:bg-primary/90 text-[#0a1215] shadow-[0_0_30px_rgba(6,208,249,0.3)]'
                                                }`}
                                        >
                                            {isGeneratingVisuals ? (
                                                <>
                                                    <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                                                    <span>Generating Visuals... {visualsProgress}%</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                                                    <span>Approve & Generate Visuals</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Sidebar AI Assistant */}
                                <div className="lg:w-[380px] flex flex-col min-h-[450px] lg:min-h-0">
                                    <ScriptaChatBot
                                        inline={true}
                                        mode="scenes"
                                        context={scenes}
                                        onUpdate={setSetScenes}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* Sequential Visuals Generation Overlay */}
            {isGeneratingVisuals && (
                <div className="fixed inset-0 bg-[#080d10]/95 backdrop-blur-xl z-[100] flex flex-col items-center justify-center p-6 text-center">
                    <div className="relative mb-8">
                        <div className="w-24 h-24 border-4 border-primary/10 border-t-primary rounded-full animate-spin" style={{ animationDuration: '1s' }}></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-primary font-bold">{visualsProgress}%</span>
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold mb-3 tracking-tight">Creating Video Masterpiece</h2>
                    <p className="text-slate-400 max-w-sm mb-6 leading-relaxed">
                        {visualsStatus}
                    </p>
                    <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-primary to-indigo-500 transition-all duration-500 ease-out"
                            style={{ width: `${visualsProgress}%` }}
                        />
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-slate-600 mt-6 font-bold">LLM Consistency Engine & SiliconFlow Wan-AI</span>
                </div>
            )}
        </div>
    );
};

export default Storyboard;
