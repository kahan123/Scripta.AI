import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import ProgressTracker from '../components/ProgressTracker';
import { mockScenes as initialScenes, TOTAL_DURATION } from '../data/mockData';

const TOOLS = [
    { id: 'select', icon: 'arrow_selector_tool', label: 'Select (V)', key: 'v' },
    { id: 'split', icon: 'content_cut', label: 'Split (C)', key: 'c' },
    { id: 'trim', icon: 'swap_horiz', label: 'Trim (T)', key: 't' },
    { id: 'text', icon: 'text_fields', label: 'Add Text (X)', key: 'x' },
    { id: 'transition', icon: 'auto_awesome_motion', label: 'Transitions (R)', key: 'r' },
];


const TRANSITIONS = ['None', 'Fade', 'Dissolve', 'Slide Left', 'Slide Right', 'Wipe', 'Zoom'];

const TRACK_DEFS = [
    { key: 'text', label: 'Text', icon: 'text_fields' },
    { key: 'video', label: 'Video', icon: 'movie' },
    { key: 'audio', label: 'Audio', icon: 'mic' },
];


const Editor = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const scenesFromState = location.state?.scenes;

    const [scenes, setScenes] = useState(() => {
        const baseScenes = scenesFromState || initialScenes;
        // First pass: normalize and ensure numeric durations
        const normalized = baseScenes.map((s, i) => ({
            ...s,
            id: s.id || s.sceneId || s.sceneNumber || `scene-${i + 1}`,
            duration: Number(s.duration || 5)
        }));

        // Second pass: calculate cumulative start times properly
        return normalized.map((s, i) => {
            const start = normalized.slice(0, i).reduce((sum, sc) => sum + sc.duration, 0);
            return {
                ...s,
                start,
                track: s.track || 'video',
                mediaType: s.mediaType || 'video',
                mediaUrl: s.videoUrl || s.mediaUrl || s.imageUrl || '',
                // Robust prompt check: use videoPrompt, then visualPrompt, then narration (the description), then title ONLY if it's descriptive
                videoPrompt: s.videoPrompt || s.visualPrompt || s.narration || (s.title && !s.title.match(/^Scene \d+$/i) ? s.title : ''),
                narration: s.narration || s.description || '',
                sourceDuration: s.duration || 5,
                duration: s.duration || 5,
                sourceOffset: s.sourceOffset || 0,
                transitionIn: s.transitionIn || 'None',
                transitionOut: s.transitionOut || 'None',
                volume: s.volume !== undefined ? s.volume : 100,
                opacity: s.opacity !== undefined ? s.opacity : 100,
                textOverlay: s.textOverlay || '',
                x: s.x || 0,
                y: s.y || 0,
                scale: s.scale || 1,
                rotation: s.rotation || 0,
                fontSize: s.fontSize || 48,
                title: s.title || `Scene ${s.sceneNumber || i + 1}`
            };
        });
    });



    const [activeTool, setActiveTool] = useState('select');
    const [selectedScene, setSelectedScene] = useState(null);
    const [playhead, setPlayhead] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [showPanel, setShowPanel] = useState('properties');
    const [zoom, setZoom] = useState(0.5); // Middle zoom level (0 to 1 scale)

    const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [mediaLibrary, setMediaLibrary] = useState([]);

    useEffect(() => {
        if (scenesFromState && scenesFromState.length > 0) {
            const libraryFromScenes = scenesFromState.map(s => ({
                id: `lib-${s.id || s.sceneId || s.sceneNumber || Math.random()}`,
                name: s.title || `Scene ${s.sceneNumber || 'Asset'}`,
                type: s.mediaType || 'video',
                url: s.videoUrl || s.mediaUrl || s.imageUrl,
                duration: Number(s.duration || 10)
            }));
            setMediaLibrary(prev => {
                const existingUrls = new Set(prev.map(item => item.url));
                const uniqueNew = libraryFromScenes.filter(item => !existingUrls.has(item.url));
                return [...prev, ...uniqueNew];
            });
        }
    }, [scenesFromState]);
    const fileInputRef = useRef(null);
    const timelineRef = useRef(null);
    const playIntervalRef = useRef(null);
    const videoRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const lastPPSRef = useRef(null);
    const [trimData, setTrimData] = useState(null);
    const isTrimming = !!trimData;

    const [textEditorData, setTextEditorData] = useState({ isOpen: false, sceneId: null, text: '' });
    const [transformData, setTransformData] = useState(null);

    const [isExporting, setIsExporting] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(null); // stores sceneId
    const [exportProgress, setExportProgress] = useState(0);
    const playheadRef = useRef(playhead);

    // SELF-HEALING: Ensure all scenes have a videoPrompt if missing
    useEffect(() => {
        const needsRepair = scenes.some(s => !s.videoPrompt);
        if (needsRepair) {
            setScenes(prev => prev.map(s => {
                if (!s.videoPrompt) {
                    return {
                        ...s,
                        videoPrompt: s.narration || s.visualPrompt || (s.title && !s.title.match(/^Scene \d+$/i) ? s.title : 'Cinematic motion and subtle movement.')
                    };
                }
                return s;
            }));
        }
    }, [scenes]);

    // Keep playheadRef in sync for the export loop
    useEffect(() => {
        playheadRef.current = playhead;
    }, [playhead]);

    // Added scenes ref to prevent stale closure in the export loop
    const scenesRef = useRef(scenes);
    useEffect(() => {
        scenesRef.current = scenes;
    }, [scenes]);

    const handleExport = () => {
        const currentScenes = scenesRef.current;
        const maxDuration = currentScenes.reduce((max, s) => Math.max(max, s.start + s.duration), 0);
        if (maxDuration === 0) return;

        setIsExporting(true);
        setExportProgress(0);
        setPlayhead(0);

        // Start playback manually since we need to ensure the interval runs while exporting
        setIsPlaying(true);
        if (playIntervalRef.current) clearInterval(playIntervalRef.current);
        playIntervalRef.current = setInterval(() => {
            setPlayhead((p) => {
                const next = p + 0.05; // 50ms interval ~20fps
                if (next >= maxDuration) {
                    console.log("[Export] Reached end of timeline. Finalizing...");
                    clearInterval(playIntervalRef.current);
                    setIsPlaying(false);
                    return maxDuration;
                }
                return next;
            });
        }, 50);

        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');

        const stream = canvas.captureStream(30);

        // Try MP4 first, fallback to WebM
        let mimeType = 'video/webm';
        let extension = 'webm';
        if (MediaRecorder.isTypeSupported('video/mp4')) {
            mimeType = 'video/mp4';
            extension = 'mp4';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
            mimeType = 'video/webm;codecs=h264';
        }

        const recorder = new MediaRecorder(stream, { mimeType });
        const chunks = [];

        recorder.ondataavailable = e => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        let isRecording = true;

        recorder.onstop = () => {
            console.log(`[Export] Stop received. Chunks collected: ${chunks.length}. Type: ${mimeType}`);
            if (chunks.length === 0) {
                alert("Export failed: No video data captured. This usually happens due to browser security restrictions or a tainted canvas.");
                setIsExporting(false);
                return;
            }
            const blob = new Blob(chunks, { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `scripta-export.${extension}`;
            a.click();
            setIsExporting(false);
            setPlayhead(0);
            setIsPlaying(false);
            clearInterval(playIntervalRef.current);
            console.log("[Export] Successfully initiated download.");
        };

        recorder.start();

        const renderFrame = () => {
            if (!isRecording) return;
            const current = playheadRef.current;

            if (current >= maxDuration) {
                isRecording = false;
                recorder.stop();
                return;
            }

            setExportProgress((current / maxDuration) * 100);

            // Draw Background
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const active = scenesRef.current.filter(s => current >= s.start && current < s.start + s.duration);

            active.sort((a, b) => {
                const zA = a.track === 'text' ? 20 : (a.track === 'video' ? 10 : 5);
                const zB = b.track === 'text' ? 20 : (b.track === 'video' ? 10 : 5);
                return zA - zB;
            });

            active.forEach(scene => {
                ctx.save();

                const fadeDur = 0.5;
                let opacity = scene.opacity !== undefined ? scene.opacity / 100 : 1;
                if (scene.transitionIn === 'Fade In' && current - scene.start < fadeDur) {
                    opacity *= (current - scene.start) / fadeDur;
                }
                if (scene.transitionOut === 'Fade Out' && (scene.start + scene.duration) - current < fadeDur) {
                    opacity *= ((scene.start + scene.duration) - current) / fadeDur;
                }
                ctx.globalAlpha = opacity;

                ctx.translate(canvas.width / 2 + (scene.x || 0), canvas.height / 2 + (scene.y || 0));
                ctx.scale(scene.scale || 1, scene.scale || 1);
                ctx.rotate((scene.rotation || 0) * Math.PI / 180);

                if (scene.mediaType === 'text') {
                    ctx.font = `italic 900 ${scene.fontSize || 48}px sans-serif`;
                    ctx.fillStyle = scene.color || '#ffffff';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.shadowColor = 'rgba(0,0,0,0.8)';
                    ctx.shadowOffsetY = 4;
                    ctx.shadowBlur = 10;
                    ctx.fillText(scene.textOverlay || '', 0, 0);
                } else {
                    const el = document.getElementById('media-' + scene.id);
                    if (el) {
                        let srcW = scene.mediaType === 'video' ? el.videoWidth : el.naturalWidth;
                        let srcH = scene.mediaType === 'video' ? el.videoHeight : el.naturalHeight;

                        if (srcW && srcH) {
                            const ratio = Math.min(canvas.width / srcW, canvas.height / srcH);
                            const drawW = srcW * ratio;
                            const drawH = srcH * ratio;
                            ctx.drawImage(el, -drawW / 2, -drawH / 2, drawW, drawH);
                        }
                    }
                }

                if (scene.mediaType !== 'text' && scene.textOverlay) {
                    ctx.font = `italic 900 48px sans-serif`;
                    ctx.fillStyle = '#ffffff';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.shadowColor = 'rgba(0,0,0,0.8)';
                    ctx.shadowOffsetY = 4;
                    ctx.shadowBlur = 10;
                    ctx.fillText(scene.textOverlay, 0, 0);
                }

                ctx.restore();
            });

            requestAnimationFrame(renderFrame);
        };

        requestAnimationFrame(renderFrame);
    };

    const handleRegenerateVideo = async (scene) => {
        if (!scene.videoPrompt) {
            alert("Video prompt is missing for this scene.");
            return;
        }

        setIsRegenerating(scene.id);
        try {
            const response = await axios.post('http://localhost:5000/api/regenerate-scene-video', {
                sceneId: scene.id,
                imageUrl: scene.imageUrl || scene.mediaUrl,
                videoPrompt: scene.videoPrompt
            });

            const { videoUrl, vidFileName } = response.data;

            // Update the scene in the state
            setScenes(prev => prev.map(s =>
                s.id === scene.id
                    ? { ...s, mediaUrl: videoUrl, videoUrl, vidFileName }
                    : s
            ));

            // Also update the media library
            setMediaLibrary(prev => prev.map(m =>
                (m.url === scene.mediaUrl || m.url === scene.videoUrl)
                    ? { ...m, url: videoUrl }
                    : m
            ));

            alert("Video regenerated successfully!");
        } catch (error) {
            console.error("Regeneration error:", error);
            alert(`Failed to regenerate: ${error.response?.data?.error || error.message}`);
        } finally {
            setIsRegenerating(null);
        }
    };

    const checkOverlap = (track, start, duration, excludeId = null) => {
        const epsilon = 0.005; // 5ms buffer to ignore floating point errors
        return scenes.some(s => {
            if (s.id === excludeId || s.track !== track) return false;
            const end = start + duration;
            const sEnd = s.start + s.duration;
            return (start < sEnd - epsilon && end > s.start + epsilon);
        });
    };

    const snapToEdges = (time, track, duration, excludeId = null) => {
        const snapThreshold = 15 / pixelsPerSecond; // 15px snap window
        let snappedTime = time;
        let minSnapDist = snapThreshold;

        // Snapping points: 0, and start/end of all clips on track
        const points = [0];
        scenes.forEach(s => {
            if (s.id !== excludeId && s.track === track) {
                points.push(s.start);
                points.push(s.start + s.duration);
            }
        });

        points.forEach(p => {
            // Snap start of drug clip to point
            const distStart = Math.abs(time - p);
            if (distStart < minSnapDist) {
                minSnapDist = distStart;
                snappedTime = p;
            }

            // Snap end of drug clip to point
            const distEnd = Math.abs((time + duration) - p);
            if (distEnd < minSnapDist) {
                minSnapDist = distEnd;
                snappedTime = p - duration;
            }
        });

        return Math.max(0, snappedTime);
    };





    const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);
    const viewDuration = Math.max(totalDuration + 60, 1800); // Ensure at least 30 mins for min zoom

    // Viewport Width assumed ~1200px for consistency. 
    // Min Zoom: 30 mins (1800s) visible -> 1200 / 1800 = 0.66 px/s
    // Max Zoom: 3s visible -> 1200 / 3 = 400 px/s
    // Logarithmic interpolation for a natural feel
    const minPPS = 0.66;
    const maxPPS = 400;
    const pixelsPerSecond = minPPS * Math.pow(maxPPS / minPPS, zoom);

    // Zoom Anchor Logic: Keep playhead (the red thing) at the same screen position
    useEffect(() => {
        if (!scrollContainerRef.current) return;

        const container = scrollContainerRef.current;
        const oldPPS = lastPPSRef.current;
        const newPPS = pixelsPerSecond;

        if (oldPPS !== null && oldPPS !== newPPS) {
            const scrollLeft = container.scrollLeft;
            const playheadPixel = playhead * oldPPS;
            const playheadScreenX = playheadPixel - scrollLeft;

            const newPlayheadPixel = playhead * newPPS;
            const newScrollLeft = newPlayheadPixel - playheadScreenX;

            container.scrollLeft = newScrollLeft;
        }

        lastPPSRef.current = newPPS;
    }, [pixelsPerSecond, playhead]);


    const activeScene = scenes.find((s) => s.id === selectedScene);

    // Updated active scenes logic (allowing for overlaps)
    const activeScenes = scenes.filter((s) =>
        playhead >= s.start && playhead < s.start + s.duration && (s.mediaUrl || s.mediaType === 'text')
    );

    const getSceneOpacity = (scene, time) => {
        const baseOpacity = (scene.opacity || 100) / 100;
        const timeIntoScene = time - scene.start;
        const timeUntilEnd = (scene.start + scene.duration) - time;
        const transitionDuration = 1.0;

        let alpha = 1;

        if (scene.transitionIn === 'Fade' && timeIntoScene < transitionDuration) {
            alpha = Math.max(0, timeIntoScene / transitionDuration);
        }

        if (scene.transitionOut === 'Fade' && timeUntilEnd < transitionDuration) {
            alpha = Math.min(alpha, Math.max(0, timeUntilEnd / transitionDuration));
        }

        return alpha * baseOpacity;
    };

    const fallbackScene = activeScenes[0] || scenes.find((s) => playhead >= s.start && playhead < s.start + s.duration);




    const handleMediaUpload = (e) => {
        const files = Array.from(e.target.files || e.dataTransfer.files);
        if (!files.length) return;

        files.forEach(file => {
            const type = file.type.split('/')[0];
            const url = URL.createObjectURL(file);

            if (type === 'video' || type === 'audio') {
                const tempMedia = document.createElement(type);
                tempMedia.src = url;
                tempMedia.onloadedmetadata = () => {
                    const newMedia = {
                        id: `media-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                        name: file.name,
                        type,
                        url,
                        duration: tempMedia.duration,
                        sourceDuration: tempMedia.duration
                    };

                    setMediaLibrary(prev => [...prev, newMedia]);
                };
            } else {
                const newMedia = {
                    id: `media-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    name: file.name,
                    type,
                    url,
                    duration: 5 // Default for images
                };
                setMediaLibrary(prev => [...prev, newMedia]);
            }
        });
    };


    const handleDragOver = (e) => {
        e.preventDefault();
        e.currentTarget.classList.add('border-primary/50', 'bg-slate-800/50');
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('border-primary/50', 'bg-slate-800/50');
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('border-primary/50', 'bg-slate-800/50');
        handleMediaUpload(e);
    };

    const togglePlay = useCallback(() => {
        setIsPlaying((prev) => {
            if (playIntervalRef.current) {
                clearInterval(playIntervalRef.current);
                playIntervalRef.current = null;
            }

            if (!prev) {
                playIntervalRef.current = setInterval(() => {
                    setPlayhead((p) => {
                        if (p >= totalDuration) {
                            if (playIntervalRef.current) {
                                clearInterval(playIntervalRef.current);
                                playIntervalRef.current = null;
                            }
                            setIsPlaying(false);
                            return 0;
                        }
                        return p + 0.1;
                    });
                }, 100);
            }
            return !prev;
        });
    }, [totalDuration]);

    useEffect(() => {
        return () => clearInterval(playIntervalRef.current);
    }, []);




    const updatePlayheadPosition = useCallback((e) => {
        if (!timelineRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const scrollLeft = scrollContainerRef.current?.scrollLeft || 0;
        const x = e.clientX - rect.left + scrollLeft;
        const newTime = Math.max(0, x / pixelsPerSecond);
        setPlayhead(Math.min(viewDuration, newTime));
    }, [pixelsPerSecond, viewDuration]);

    const handleTrimStart = (e, scene, side) => {
        e.stopPropagation();
        e.preventDefault();
        setTrimData({
            sceneId: scene.id,
            side: side,
            initialStart: scene.start,
            initialDuration: scene.duration,
            initialOffset: scene.sourceOffset || 0,
            sourceDuration: scene.sourceDuration || scene.duration,
            startX: e.clientX,
            track: scene.track
        });

    };


    const handleTimelinePointerDown = (e) => {
        if (!timelineRef.current) return;
        setIsDraggingPlayhead(true);
        updatePlayheadPosition(e);
        e.preventDefault();
    };

    useEffect(() => {
        const handlePointerMove = (e) => {
            if (isDraggingPlayhead) {
                updatePlayheadPosition(e);
            } else if (isTrimming) {
                const deltaX = e.clientX - trimData.startX;
                const deltaTime = deltaX / pixelsPerSecond;

                setScenes(prev => {
                    const scene = prev.find(s => s.id === trimData.sceneId);
                    if (!scene) return prev;

                    let newStart = scene.start;
                    let newDuration = scene.duration;
                    let newOffset = scene.sourceOffset || 0;

                    if (trimData.side === 'left') {
                        const targetStart = trimData.initialStart + deltaTime;
                        newStart = snapToEdges(targetStart, trimData.track, 0, trimData.sceneId);

                        const actualDelta = newStart - trimData.initialStart;
                        newOffset = trimData.initialOffset + actualDelta;
                        newDuration = trimData.initialDuration - actualDelta;

                        // Constraint: User cant trim more than actual length (from left)
                        if (newOffset < 0) {
                            newOffset = 0;
                            newStart = trimData.initialStart - trimData.initialOffset;
                            newDuration = trimData.initialDuration + trimData.initialOffset;
                        }
                    } else {
                        const targetEnd = (trimData.initialStart + trimData.initialDuration) + deltaTime;
                        const snappedEnd = snapToEdges(targetEnd, trimData.track, 0, trimData.sceneId);
                        newDuration = snappedEnd - scene.start;

                        // Constraint: User cant trim more than actual length (from right)
                        if (newOffset + newDuration > trimData.sourceDuration) {
                            newDuration = trimData.sourceDuration - newOffset;
                        }
                    }

                    // Minimum duration guard
                    if (newDuration < 0.1) return prev;
                    if (checkOverlap(trimData.track, newStart, newDuration, trimData.sceneId)) return prev;

                    return prev.map(s => s.id === trimData.sceneId ? { ...s, start: newStart, duration: newDuration, sourceOffset: newOffset } : s);
                });

            } else if (transformData) {
                const dx = e.clientX - transformData.startX;
                const dy = e.clientY - transformData.startY;

                if (transformData.type === 'move') {
                    updateScene(transformData.sceneId, {
                        x: transformData.initialX + dx,
                        y: transformData.initialY + dy
                    });
                } else if (transformData.type === 'scale') {
                    const initialDist = Math.sqrt(
                        Math.pow(transformData.startX - transformData.centerX, 2) +
                        Math.pow(transformData.startY - transformData.centerY, 2)
                    );
                    const currentDist = Math.sqrt(
                        Math.pow(e.clientX - transformData.centerX, 2) +
                        Math.pow(e.clientY - transformData.centerY, 2)
                    );
                    const scaleFactor = currentDist / initialDist || 1;
                    updateScene(transformData.sceneId, {
                        scale: Math.max(0.1, transformData.initialScale * scaleFactor)
                    });
                } else if (transformData.type === 'rotate') {
                    const initialAngle = Math.atan2(
                        transformData.startY - transformData.centerY,
                        transformData.startX - transformData.centerX
                    );
                    const currentAngle = Math.atan2(
                        e.clientY - transformData.centerY,
                        e.clientX - transformData.centerX
                    );
                    const angleDiff = (currentAngle - initialAngle) * (180 / Math.PI);
                    updateScene(transformData.sceneId, {
                        rotation: transformData.initialRotation + angleDiff
                    });
                }
            }
        };
        const handlePointerUp = () => {
            setIsDraggingPlayhead(false);
            setTrimData(null);
            setTransformData(null);
        };

        if (isDraggingPlayhead || isTrimming || transformData) {
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
        }
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [isDraggingPlayhead, isTrimming, transformData, pixelsPerSecond, updatePlayheadPosition, scenes, snapToEdges]);



    const handleDeleteScene = useCallback((sceneId) => {
        setScenes(prev => {
            const newScenes = prev.filter((s) => s.id !== sceneId);
            let start = 0;
            return newScenes.map((s) => {
                const sNew = { ...s, start };
                start += s.duration;
                return sNew;
            });
        });
        if (selectedScene === sceneId) setSelectedScene(null);
    }, [selectedScene]);

    const handleSplitSceneAtTime = useCallback((sceneId, splitTimeOffset) => {
        setScenes(prev => {
            const scene = prev.find((s) => s.id === sceneId);
            if (!scene || splitTimeOffset <= scene.start + 1 || splitTimeOffset >= scene.start + scene.duration - 1) return prev;

            const splitDuration = splitTimeOffset - scene.start;
            const idx = prev.findIndex(s => s.id === sceneId);
            const newScenes = [...prev];

            const part1 = { ...scene, duration: splitDuration };
            const part2 = {
                ...scene,
                id: Date.now().toString(),
                title: scene.title + ' (Cont.)',
                duration: scene.duration - splitDuration,
                start: splitTimeOffset,
                sourceOffset: (scene.sourceOffset || 0) + splitDuration
            };


            newScenes.splice(idx, 1, part1, part2);

            let currentStart = 0;
            return newScenes.map((s) => {
                const sNew = { ...s, start: currentStart };
                currentStart += s.duration;
                return sNew;
            });
        });
    }, []);

    const handleSceneClick = (e, scene) => {
        e.stopPropagation();

        if (activeTool === 'split') {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickTimeOffset = scene.start + (clickX / pixelsPerSecond);
            handleSplitSceneAtTime(scene.id, clickTimeOffset);
            setActiveTool('select');
        } else if (activeTool === 'text') {
            setTextEditorData({
                isOpen: true,
                sceneId: scene.id,
                text: scene.textOverlay || ''
            });
            setActiveTool('select');
        } else {
            setSelectedScene(scene.id);
        }
    };

    // Create a standalone text clip on the text track
    const handleAddTextClip = () => {
        setTextEditorData({
            isOpen: true,
            sceneId: '__new_text__',
            text: ''
        });
    };


    useEffect(() => {
        const handler = (e) => {
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

            const tool = TOOLS.find((t) => t.key.toLowerCase() === e.key.toLowerCase());
            if (tool && !e.ctrlKey && !e.metaKey) setActiveTool(tool.id);

            if (e.key === ' ') {
                e.preventDefault();
                if (!e.repeat) togglePlay();
            }
            if (e.key === 'ArrowLeft') setPlayhead((p) => Math.max(0, p - 0.5));
            if (e.key === 'ArrowRight') setPlayhead((p) => Math.min(viewDuration, p + 0.5));
            if ((e.key === 'Backspace' || e.key === 'Delete') && selectedScene) {
                handleDeleteScene(selectedScene);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [viewDuration, togglePlay, selectedScene, handleDeleteScene]);

    const updateScene = (id, updates) => {
        setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    };





    const formatTime = (s, showDetail = false) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.floor(s % 60);

        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
        }

        if (showDetail || pixelsPerSecond > 100) {
            const ms = Math.floor((s % 1) * 100);
            return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
        }

        return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };



    return (
        <div className="flex flex-col h-screen bg-[#060a0d] text-white overflow-hidden select-none relative">
            <ProgressTracker currentStep={4} rightElement={
                <button
                    onClick={handleExport}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-black font-black uppercase text-[11px] tracking-widest shadow-[0_0_20px_rgba(6,208,249,0.2)] hover:shadow-[0_0_30px_rgba(6,208,249,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    {isExporting ? (
                        <>
                            <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                            <span>{Math.round(exportProgress)}%</span>
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined text-[16px]">download</span>
                            <span>Export</span>
                        </>
                    )}
                </button>
            } />

            {isExporting && (
                <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="w-64 p-6 bg-[#0a0e12] border border-slate-800 rounded-3xl shadow-2xl flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full border-4 border-slate-800 border-t-primary animate-spin mb-4" />
                        <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Exporting Video</h3>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Rendering frames...</p>

                        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all duration-300 ease-out"
                                style={{ width: `${exportProgress}%` }}
                            />
                        </div>
                        <div className="mt-2 text-primary font-black">{Math.round(exportProgress)}%</div>
                    </div>
                </div>
            )}

            <div className="fixed top-0 left-0 w-[600px] h-[600px] bg-primary/[0.02] rounded-full blur-[150px] pointer-events-none" />

            <div className="flex flex-1 min-h-0 overflow-hidden relative z-10">
                <aside className="w-[300px] flex-shrink-0 border-r border-slate-800/50 bg-[#0a0e12] flex flex-col overflow-hidden">
                    <div className="h-12 border-b border-slate-800/40 flex items-center px-4 shrink-0 justify-between">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Assets & Library</span>
                        <div className="flex items-center gap-1">
                            <button onClick={() => fileInputRef.current?.click()} className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center hover:bg-primary hover:text-black transition-all">
                                <span className="material-symbols-outlined text-[18px]">add</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
                        {/* Media Upload Area - Compact */}
                        <div
                            className="w-full py-6 rounded-2xl border-2 border-slate-800/50 border-dashed hover:border-primary/40 hover:bg-primary/5 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <input
                                type="file"
                                multiple
                                accept="video/*,audio/*,image/*"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleMediaUpload}
                            />
                            <span className="material-symbols-outlined text-slate-600 group-hover:text-primary transition-colors text-[24px] mb-1">upload</span>
                            <p className="text-[10px] font-bold text-slate-400">Import Media</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {mediaLibrary.map((media) => (
                                <div
                                    key={media.id}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('mediaId', media.id);
                                        e.dataTransfer.effectAllowed = 'copy';
                                    }}
                                    className="group flex flex-col gap-1.5 cursor-grab active:cursor-grabbing hover:opacity-90 transition-all border border-slate-800/40 p-1 rounded-xl bg-black/20"
                                >
                                    <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden relative flex items-center justify-center">
                                        {media.type === 'image' || media.type === 'video' ? (
                                            media.type === 'video' ? (
                                                <video src={media.url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                                            ) : (
                                                <img src={media.url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                                            )
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-indigo-500/5">
                                                <span className="material-symbols-outlined text-indigo-400/40 text-[20px]">audio_file</span>
                                            </div>
                                        )}
                                        {media.type === 'video' && (
                                            <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-md rounded-sm px-1 py-0.5">
                                                <span className="text-[8px] font-mono font-bold text-white/80">{media.duration.toFixed(1)}s</span>
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[9px] font-bold text-slate-500 truncate px-1 uppercase tracking-tight">{media.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* ── CENTER: Preview Stage ── */}
                <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-[#080c10]">
                    {/* Preview viewport – fills available space, preview is centered inside */}
                    <div className="flex-1 min-h-0 flex items-center justify-center p-4">
                        {/* 16:9 wrapper – height fills parent, width derived from aspect ratio */}
                        <div
                            className="relative bg-black border border-white/10 overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.6)]"
                            style={{ aspectRatio: '16/9', height: '100%', maxWidth: '100%' }}
                        >
                            {/* Media Preview Layers */}
                            <div className="absolute inset-0 bg-black">
                                {activeScenes.map((scene) => (
                                    <div
                                        key={scene.id}
                                        className="absolute inset-0 flex items-center justify-center transition-opacity duration-100"
                                        style={{
                                            opacity: getSceneOpacity(scene, playhead),
                                            zIndex: scene.track === 'text' ? 20 : (scene.track === 'video' ? 10 : 5)
                                        }}
                                    >
                                        <div
                                            style={{
                                                transform: `translate(${scene.x}px, ${scene.y}px) scale(${scene.scale}) rotate(${scene.rotation}deg)`,
                                                transition: transformData?.sceneId === scene.id ? 'none' : 'transform 0.1s ease-out'
                                            }}
                                            className={`relative flex items-center justify-center ${scene.mediaType === 'text' ? '' : 'w-full h-full'}`}
                                        >
                                            {scene.mediaType === 'video' ? (
                                                <VideoLayer
                                                    id={'media-' + scene.id} crossOrigin='anonymous'
                                                    src={scene.mediaUrl}
                                                    startTime={scene.start}
                                                    playhead={playhead}
                                                    isPlaying={isPlaying}
                                                    volume={scene.volume}
                                                    sourceOffset={scene.sourceOffset}
                                                />
                                            ) : scene.mediaType === 'text' ? (
                                                <div
                                                    className="text-center font-black uppercase tracking-tighter italic drop-shadow-lg p-4"
                                                    style={{
                                                        fontSize: `${scene.fontSize || 48}px`,
                                                        color: scene.color || '#ffffff'
                                                    }}
                                                >
                                                    {scene.textOverlay}
                                                </div>
                                            ) : (
                                                <img
                                                    id={'media-' + scene.id} crossOrigin='anonymous'
                                                    src={scene.mediaUrl}
                                                    className="w-full h-full object-contain pointer-events-none"
                                                />
                                            )}


                                            {scene.mediaType !== 'text' && scene.textOverlay && (
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
                                                    <h2 className="text-2xl md:text-4xl font-black text-white text-center drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] leading-tight uppercase tracking-tighter italic">
                                                        {scene.textOverlay}
                                                    </h2>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Interactive Transformation Controls */}
                            {selectedScene && activeScenes.some(s => s.id === selectedScene) && (
                                <InteractionLayer
                                    scene={activeScenes.find(s => s.id === selectedScene)}
                                    updateScene={updateScene}
                                    transformData={transformData}
                                    setTransformData={setTransformData}
                                />
                            )}
                        </div>
                    </div>

                    {/* ── Transport Bar (always visible, in normal flow) ── */}
                    <div className="shrink-0 h-12 border-t border-slate-800/50 bg-[#0a0e12] flex items-center justify-center gap-5 px-4">
                        <button onClick={() => setPlayhead(0)} className="w-7 h-7 rounded-md hover:bg-white/5 text-slate-500 hover:text-white transition-all flex items-center justify-center">
                            <span className="material-symbols-outlined text-[18px]">first_page</span>
                        </button>
                        <button onClick={() => setPlayhead(Math.max(0, playhead - 2))} className="w-7 h-7 rounded-md hover:bg-white/5 text-slate-500 hover:text-white transition-all flex items-center justify-center">
                            <span className="material-symbols-outlined text-[18px]">replay_5</span>
                        </button>

                        <button
                            onClick={togglePlay}
                            className="w-10 h-10 rounded-lg bg-primary text-black shadow-[0_0_15px_rgba(6,208,249,0.25)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined text-[24px]">{isPlaying ? 'pause' : 'play_arrow'}</span>
                        </button>

                        <button onClick={() => setPlayhead(Math.min(totalDuration, playhead + 2))} className="w-7 h-7 rounded-md hover:bg-white/5 text-slate-500 hover:text-white transition-all flex items-center justify-center">
                            <span className="material-symbols-outlined text-[18px]">forward_5</span>
                        </button>
                        <button onClick={() => setPlayhead(totalDuration)} className="w-7 h-7 rounded-md hover:bg-white/5 text-slate-500 hover:text-white transition-all flex items-center justify-center">
                            <span className="material-symbols-outlined text-[18px]">last_page</span>
                        </button>

                        <div className="h-5 w-px bg-slate-800/60 mx-1" />

                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono font-bold text-primary tabular-nums">{formatTime(playhead, true)}</span>
                            <span className="text-[10px] font-mono text-slate-600">/</span>
                            <span className="text-[10px] font-mono font-bold text-slate-500 tabular-nums">{formatTime(totalDuration)}</span>
                        </div>
                    </div>
                </div>

                <aside className="w-[320px] flex-shrink-0 bg-[#0a0e12] border-l border-slate-800/50 flex flex-col overflow-hidden">
                    <div className="h-12 border-b border-slate-800/40 flex items-center px-4 bg-[#0a0e12] shrink-0">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Inspector</span>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                        {selectedScene ? (() => {
                            const scene = scenes.find(s => s.id === selectedScene);
                            return (
                                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                                    {/* Component Header */}
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <h3 className="text-sm font-black text-white uppercase tracking-tighter">{scene.title}</h3>
                                            <div className="flex items-center gap-2">
                                                <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[8px] font-black uppercase">{scene.mediaType}</span>
                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{scene.track} track</span>
                                            </div>
                                        </div>
                                        <button onClick={() => handleDeleteScene(scene.id)} className="w-8 h-8 rounded-lg border border-slate-800 flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-400/5 transition-all">
                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                    </div>

                                    {/* Transform Section */}
                                    <div className="space-y-5">
                                        <div className="flex items-center justify-between border-b border-slate-800/40 pb-2">
                                            <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[14px]">transform</span>
                                                Transform
                                            </label>
                                            <button
                                                onClick={() => updateScene(scene.id, { x: 0, y: 0, scale: 1, rotation: 0 })}
                                                className="text-[8px] font-black text-primary uppercase tracking-widest hover:text-white transition-colors"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <span className="text-[9px] font-bold text-slate-500 uppercase">Position X</span>
                                                <div className="flex items-center gap-2">
                                                    <input type="number" value={Math.round(scene.x)} onChange={(e) => updateScene(scene.id, { x: parseInt(e.target.value) || 0 })} className="w-full bg-black/40 border border-slate-800 rounded-lg p-2 text-[10px] font-mono text-white focus:outline-none focus:border-primary/50" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <span className="text-[9px] font-bold text-slate-500 uppercase">Position Y</span>
                                                <div className="flex items-center gap-2">
                                                    <input type="number" value={Math.round(scene.y)} onChange={(e) => updateScene(scene.id, { y: parseInt(e.target.value) || 0 })} className="w-full bg-black/40 border border-slate-800 rounded-lg p-2 text-[10px] font-mono text-white focus:outline-none focus:border-primary/50" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 mt-4">
                                            <div className="space-y-2">
                                                <span className="text-[9px] font-bold text-slate-500 uppercase">Scale</span>
                                                <input type="range" min="0.1" max="3" step="0.05" value={scene.scale} onChange={(e) => updateScene(scene.id, { scale: parseFloat(e.target.value) })} className="w-full h-1 accent-primary bg-slate-800 rounded-full appearance-none cursor-pointer" />
                                            </div>
                                            <div className="space-y-2">
                                                <span className="text-[9px] font-bold text-slate-500 uppercase">Rotation</span>
                                                <div className="flex items-center gap-2">
                                                    <input type="number" value={Math.round(scene.rotation)} onChange={(e) => updateScene(scene.id, { rotation: parseInt(e.target.value) || 0 })} className="w-full bg-black/40 border border-slate-800 rounded-lg p-2 text-[10px] font-mono text-white focus:outline-none focus:border-primary/50" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Text Styling (Conditional) */}
                                    <div className="space-y-5">
                                        <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest border-b border-slate-800/40 pb-2 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[14px]">text_fields</span>
                                            Overlay Properties
                                        </label>
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <span className="text-[9px] font-bold text-slate-500 uppercase">Overlay Text</span>
                                                <textarea
                                                    value={scene.textOverlay || ''}
                                                    onChange={(e) => updateScene(scene.id, { textOverlay: e.target.value })}
                                                    className="w-full bg-black/40 border border-slate-800 rounded-xl p-3 text-[11px] text-white focus:outline-none focus:border-primary/50 min-h-[80px] resize-none"
                                                    placeholder="No overlay text..."
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <span className="text-[9px] font-bold text-slate-500 uppercase">Font Size</span>
                                                    <input type="number" value={scene.fontSize || 48} onChange={(e) => updateScene(scene.id, { fontSize: parseInt(e.target.value) || 12 })} className="w-full bg-black/40 border border-slate-800 rounded-lg p-2 text-[10px] font-mono text-white focus:outline-none focus:border-primary/50" />
                                                </div>
                                                <div className="space-y-2">
                                                    <span className="text-[9px] font-bold text-slate-500 uppercase">Text Color</span>
                                                    <div className="flex items-center gap-2">
                                                        <input type="color" value={scene.color || '#ffffff'} onChange={(e) => updateScene(scene.id, { color: e.target.value })} className="w-full h-8 bg-transparent border-none cursor-pointer p-0" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Media Properties */}
                                    <div className="space-y-5">
                                        <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest border-b border-slate-800/40 pb-2 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[14px]">tune</span>
                                            Media Adjustments
                                        </label>
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] font-bold text-slate-500 uppercase">Volume</span>
                                                    <span className="text-[10px] font-mono text-primary">{scene.volume}%</span>
                                                </div>
                                                <input type="range" min="0" max="100" value={scene.volume} onChange={(e) => updateScene(scene.id, { volume: parseInt(e.target.value) })} className="w-full h-1 accent-primary bg-slate-800 rounded-full appearance-none cursor-pointer" />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] font-bold text-slate-500 uppercase">Opacity</span>
                                                    <span className="text-[10px] font-mono text-primary">{scene.opacity}%</span>
                                                </div>
                                                <input type="range" min="0" max="100" value={scene.opacity} onChange={(e) => updateScene(scene.id, { opacity: parseInt(e.target.value) })} className="w-full h-1 accent-primary bg-slate-800 rounded-full appearance-none cursor-pointer" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Video Generation / AI Control */}
                                    {scene.mediaType === 'video' && (
                                        <div className="space-y-5">
                                            <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest border-b border-slate-800/40 pb-2 flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[14px]">smart_toy</span>
                                                AI Visual Control
                                            </label>
                                            <div className="space-y-4">
                                                <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
                                                    <div className="space-y-1.5">
                                                        <div className="flex justify-between items-center px-0.5">
                                                            <span className="text-[9px] font-bold text-primary uppercase">Video Motion Prompt</span>
                                                            {isRegenerating === scene.id && (
                                                                <span className="text-[8px] font-black uppercase tracking-tighter text-primary animate-pulse">Processing...</span>
                                                            )}
                                                        </div>
                                                        <textarea
                                                            value={scene.videoPrompt || ''}
                                                            onChange={(e) => updateScene(scene.id, { videoPrompt: e.target.value })}
                                                            className="w-full bg-black/40 border border-primary/20 rounded-lg p-2 text-[10px] leading-relaxed text-white focus:outline-none focus:border-primary/50 min-h-[80px] resize-none"
                                                            placeholder="Describe the motion you want to see..."
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => handleRegenerateVideo(scene)}
                                                        disabled={isRegenerating === scene.id}
                                                        className={`w-full py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all ${isRegenerating === scene.id
                                                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                                                            : 'bg-primary text-black font-black uppercase text-[10px] hover:brightness-110 active:scale-95 shadow-[0_0_20px_rgba(6,208,249,0.2)]'
                                                            }`}
                                                    >
                                                        {isRegenerating === scene.id ? (
                                                            <>
                                                                <div className="w-3.5 h-3.5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                                                                Regenerating...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="material-symbols-outlined text-[16px]">refresh</span>
                                                                Regenerate Video
                                                            </>
                                                        )}
                                                    </button>
                                                    <div className="flex items-start gap-1.5 opacity-60">
                                                        <span className="material-symbols-outlined text-[12px] mt-0.5">info</span>
                                                        <p className="text-[8px] text-slate-400 leading-normal italic" style={{ fontSize: '8px' }}>
                                                            Uses the original scene image as the base frame.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })() : (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                                <span className="material-symbols-outlined text-[48px] mb-2 text-slate-600">touch_app</span>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Select a clip to edit properties</p>
                            </div>
                        )}
                    </div>
                </aside>

            </div>

            <div className="h-[280px] flex-shrink-0 flex flex-col bg-[#080c10] border-t border-slate-800/80 relative z-20">
                <div className="h-12 flex items-center justify-between px-6 bg-[#0a0e12] border-b border-slate-800/40 shrink-0">
                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-slate-800/40">
                        {TOOLS.map((tool) => (
                            <button
                                key={tool.id}
                                onClick={() => {
                                    if (tool.id === 'text') {
                                        handleAddTextClip();
                                    } else {
                                        setActiveTool(tool.id);
                                    }
                                }}
                                title={tool.label}
                                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${activeTool === tool.id
                                    ? 'bg-primary text-[#0a1215] shadow-lg scale-105'
                                    : 'text-slate-600 hover:text-white hover:bg-slate-800/60'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-[20px]">{tool.icon}</span>
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-slate-800/40">
                            <span className="text-[10px] font-black text-slate-600 uppercase">Zoom</span>
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[14px] text-slate-600">zoom_out</span>
                                <input type="range" min="0" max="1" step="0.01" value={zoom}
                                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                                    className="w-24 accent-primary h-1 cursor-pointer" />
                                <span className="material-symbols-outlined text-[14px] text-slate-600">zoom_in</span>
                            </div>
                        </div>



                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden relative">
                    <div className="w-32 flex-shrink-0 bg-[#0a0e12] border-r border-slate-800/40 z-30 flex flex-col">
                        <div className="h-8 border-b border-slate-800/40 bg-black/20" />
                        {TRACK_DEFS.map(({ key, label, icon }) => (
                            <div key={key} className="h-16 flex items-center gap-3 px-4 border-b border-slate-800/20">
                                <span className="material-symbols-outlined text-[18px] text-slate-600">{icon}</span>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
                            </div>
                        ))}
                    </div>

                    <div
                        ref={scrollContainerRef}
                        className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative"
                    >

                        <div
                            className="flex flex-col relative min-h-full"
                            style={{ width: `${viewDuration * pixelsPerSecond}px` }}
                        >
                            <div
                                className="h-8 flex-shrink-0 relative border-b border-slate-800/40 bg-black/20 cursor-text group"
                                ref={timelineRef}
                                onPointerDown={handleTimelinePointerDown}
                            >
                                {(() => {
                                    const possibleIntervals = [0.1, 0.5, 1, 2, 5, 10, 30, 60, 300, 600, 1800];
                                    const minSpacing = 100; // px between labels
                                    const markerInterval = possibleIntervals.find(it => it * pixelsPerSecond >= minSpacing) || 1800;

                                    return Array.from({ length: Math.ceil(viewDuration / markerInterval) + 1 }, (_, i) => {
                                        const time = i * markerInterval;
                                        const pos = time * pixelsPerSecond;
                                        if (pos > viewDuration * pixelsPerSecond) return null;

                                        return (
                                            <div key={i} className="absolute h-full border-l border-slate-800/40 flex items-end pb-1" style={{ left: `${pos}px` }}>
                                                <span className="text-[9px] font-mono text-slate-600 pl-1 select-none pointer-events-none">
                                                    {formatTime(time, markerInterval < 1)}
                                                </span>
                                            </div>
                                        );
                                    });
                                })()}



                                {!isDraggingPlayhead && (
                                    <div className="absolute top-0 bottom-0 w-[1px] bg-white/20 opacity-0 group-hover:opacity-100 pointer-events-none z-10" />
                                )}
                            </div>

                            <div
                                className="flex-1 relative flex flex-col"
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'copy';
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const mediaId = e.dataTransfer.getData('mediaId');
                                    const sceneId = e.dataTransfer.getData('sceneId');
                                    const dragOffset = parseFloat(e.dataTransfer.getData('dragOffset') || '0');

                                    if (!timelineRef.current) return;

                                    const rect = timelineRef.current.getBoundingClientRect();
                                    const scrollLeft = timelineRef.current.parentElement.scrollLeft;
                                    const dropX = e.clientX - rect.left + scrollLeft;
                                    const dropTime = Math.max(0, (dropX / pixelsPerSecond) - dragOffset);

                                    const containerRect = e.currentTarget.getBoundingClientRect();
                                    const relativeY = e.clientY - containerRect.top;

                                    let trackType = 'video';
                                    if (relativeY < 64) trackType = 'text';
                                    else if (relativeY < 128) trackType = 'video';
                                    else trackType = 'audio';

                                    if (sceneId) {
                                        // Reposition existing scene
                                        const scene = scenes.find(s => s.id === sceneId);
                                        if (!scene) return;

                                        const snappedTime = snapToEdges(dropTime, trackType, scene.duration, sceneId);

                                        // Overlap Check for repositioning
                                        if (checkOverlap(trackType, snappedTime, scene.duration, sceneId)) {
                                            console.warn("Reposition blocked: Overlap on track", trackType);
                                            return;
                                        }

                                        setScenes(prev => prev.map(s =>
                                            s.id === sceneId
                                                ? { ...s, start: snappedTime, track: trackType }
                                                : s
                                        ).sort((a, b) => a.start - b.start));
                                    } else if (mediaId) {
                                        // Add new media
                                        const media = mediaLibrary.find(m => m.id === mediaId);
                                        if (!media) return;

                                        // Track Restrictions
                                        if (media.type === 'video' && trackType !== 'video') return;
                                        if (media.type === 'audio' && trackType !== 'audio') return;
                                        if (media.type === 'image' && trackType === 'audio') return;

                                        const duration = media.duration || 5;
                                        const snappedTime = snapToEdges(dropTime, trackType, duration);

                                        // Overlap Check for new media
                                        if (checkOverlap(trackType, snappedTime, duration)) {
                                            console.warn("Drop blocked: Overlap on track", trackType);
                                            return;
                                        }

                                        const newScene = {
                                            id: `scene-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                                            title: media.name,
                                            duration: duration,
                                            start: snappedTime,
                                            color: media.type === 'video' ? '#06d0f9' : (media.type === 'audio' ? '#6366f1' : '#10b981'),
                                            transitionIn: 'None',
                                            transitionOut: 'None',
                                            volume: media.type === 'image' ? 0 : 100,
                                            opacity: 100,
                                            textOverlay: '',
                                            narration: 'New imported media.',
                                            mediaUrl: media.url,
                                            mediaType: media.type,
                                            sourceDuration: media.duration,
                                            sourceOffset: 0,
                                            track: trackType,
                                            x: 0,
                                            y: 0,
                                            scale: 1,
                                            rotation: 0,
                                            fontSize: 48
                                        };



                                        setScenes(prev => [...prev, newScene].sort((a, b) => a.start - b.start));
                                    }


                                }}


                            >
                                {TRACK_DEFS.map(({ key }) => (
                                    <div
                                        key={key}
                                        className="h-16 relative border-b border-slate-800/20 group hover:bg-white/[0.01] transition-colors"
                                        onClick={(e) => {
                                            if (activeTool === 'text' && key === 'text') {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const scrollLeft = timelineRef.current.parentElement.scrollLeft;
                                                const clickX = e.clientX - rect.left + scrollLeft;
                                                const clickTime = clickX / pixelsPerSecond;

                                                const newTextSceneId = `text-${Date.now()}`;
                                                const newTextScene = {
                                                    id: newTextSceneId,
                                                    title: "Text Overlay",
                                                    duration: 5,
                                                    start: snapToEdges(clickTime, 'text', 5),
                                                    color: '#10b981',
                                                    textOverlay: '',
                                                    mediaUrl: '',
                                                    mediaType: 'text',
                                                    track: 'text',
                                                    sourceDuration: 5,
                                                    sourceOffset: 0,
                                                    x: 0,
                                                    y: 0,
                                                    scale: 1,
                                                    rotation: 0,
                                                    fontSize: 64
                                                };

                                                setScenes(prev => [...prev, newTextScene].sort((a, b) => a.start - b.start));
                                                setTextEditorData({
                                                    isOpen: true,
                                                    sceneId: newTextSceneId,
                                                    text: ''
                                                });
                                                setActiveTool('select');
                                            }
                                        }}
                                    >


                                        {scenes.filter(s => s.track === key || (key === 'video' && !s.track)).map((scene) => (
                                            <div
                                                key={scene.id}
                                                draggable
                                                onDragStart={(e) => {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const offset = (e.clientX - rect.left) / pixelsPerSecond;
                                                    e.dataTransfer.setData('sceneId', scene.id);
                                                    e.dataTransfer.setData('dragOffset', offset.toString());
                                                }}
                                                className={`absolute top-2 bottom-2 rounded-none flex items-center px-4 overflow-hidden cursor-pointer transition-all border-2 ${selectedScene === scene.id
                                                    ? 'border-white shadow-[0_0_20px_rgba(255,255,255,0.2)] z-10'
                                                    : 'border-transparent'
                                                    }`}

                                                style={{
                                                    left: `${scene.start * pixelsPerSecond}px`,
                                                    width: `${scene.duration * pixelsPerSecond}px`,
                                                    background: key === 'audio'
                                                        ? `linear-gradient(90deg, transparent, ${scene.color}20, transparent)`
                                                        : `linear-gradient(135deg, ${scene.color}30, ${scene.color}15)`,
                                                    pointerEvents: 'auto'
                                                }}
                                                onClick={(e) => handleSceneClick(e, scene)}
                                            >

                                                <div className="w-1.5 h-1.5 rounded-full mr-3 flex-shrink-0" style={{ background: scene.color }} />
                                                <span className="text-[10px] font-bold text-white truncate uppercase tracking-tight select-none pointer-events-none">
                                                    {scene.title}
                                                </span>

                                                {key === 'audio' && (
                                                    <div className="absolute inset-x-4 inset-y-1 flex items-center gap-0.5 opacity-30 pointer-events-none">
                                                        {Array.from({ length: 24 }, (_, i) => (
                                                            <div key={i} className="flex-1 bg-white rounded-full" style={{ height: `${20 + Math.random() * 60}%` }} />
                                                        ))}
                                                    </div>
                                                )}

                                                {key === 'text' && scene.textOverlay && (
                                                    <span className="ml-2 text-[9px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                                        {scene.textOverlay}
                                                    </span>
                                                )}

                                                {scene.transitionIn !== 'None' && key === 'video' && (
                                                    <div className="flex items-center gap-1 bg-black/40 rounded-full px-2 py-0.5 border border-white/5 pointer-events-none">
                                                        <span className="material-symbols-outlined text-[10px] text-primary">login</span>
                                                    </div>
                                                )}
                                                {scene.transitionOut !== 'None' && key === 'video' && (
                                                    <div className="flex items-center gap-1 bg-black/40 rounded-full px-2 py-0.5 border border-white/5 pointer-events-none ml-1">
                                                        <span className="material-symbols-outlined text-[10px] text-primary">logout</span>
                                                    </div>
                                                )}
                                                {activeTool === 'trim' && (

                                                    <>
                                                        <div
                                                            className="absolute left-0 top-0 bottom-0 w-2 bg-white/40 hover:bg-white cursor-col-resize z-20 flex items-center justify-center group/trim"
                                                            onPointerDown={(e) => handleTrimStart(e, scene, 'left')}
                                                        >
                                                            <div className="w-[1px] h-4 bg-white/60 group-hover/trim:bg-white" />
                                                        </div>
                                                        <div
                                                            className="absolute right-0 top-0 bottom-0 w-2 bg-white/40 hover:bg-white cursor-col-resize z-20 flex items-center justify-center group/trim"
                                                            onPointerDown={(e) => handleTrimStart(e, scene, 'right')}
                                                        >
                                                            <div className="w-[1px] h-4 bg-white/60 group-hover/trim:bg-white" />
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                        ))}
                                    </div>
                                ))}


                                <div
                                    className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-40 pointer-events-none shadow-[0_0_15px_rgba(239,68,68,0.8)]"
                                    style={{ left: `${playhead * pixelsPerSecond}px` }}
                                >
                                    <div className="absolute top-0 -left-[6px] w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-red-500" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {
                showExportModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowExportModal(false)}>
                        <div className="bg-[#0d1418] border border-slate-800/60 rounded-3xl p-10 w-full max-w-lg shadow-[0_50px_100px_rgba(0,0,0,0.8)]" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6">
                                <span className="material-symbols-outlined text-primary text-[16px]">verified</span>
                                <span className="text-[10px] font-black text-primary tracking-widest uppercase">Export Settings</span>
                            </div>
                            <h3 className="text-2xl font-black mb-1 text-white uppercase tracking-tighter">Finalize Video</h3>
                            <p className="text-sm text-slate-500 mb-8">Your {scenes.length} scene edit is ready for high-fidelity export.</p>

                            <div className="space-y-3 mb-10">
                                {[
                                    { label: 'Format', value: 'ProRes 422 (HQ)' },
                                    { label: 'Resolution', value: '1920 × 1080 (FHD)' },
                                    { label: 'Frame Rate', value: '30 fps' },
                                    { label: 'Estimated Size', value: '128 MB' }
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-slate-900/40 rounded-2xl border border-slate-800/40">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{item.label}</span>
                                        <span className="text-xs font-black text-white">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            }

            {textEditorData.isOpen && (
                <TextEditorModal
                    initialText={textEditorData.text}
                    onSave={(newText) => {
                        if (textEditorData.sceneId === '__new_text__') {
                            // Create a standalone text clip on the text track
                            const newTextScene = {
                                id: Date.now().toString(),
                                title: newText.slice(0, 20) || 'Text',
                                duration: 5,
                                start: playhead,
                                track: 'text',
                                mediaType: 'text',
                                mediaUrl: '',
                                sourceDuration: 5,
                                sourceOffset: 0,
                                transitionIn: 'None',
                                transitionOut: 'None',
                                volume: 100,
                                opacity: 100,
                                textOverlay: newText,
                                x: 0,
                                y: 0,
                                scale: 1,
                                rotation: 0,
                                fontSize: 48,
                                color: '#ffffff',
                            };
                            setScenes(prev => [...prev, newTextScene]);
                        } else {
                            updateScene(textEditorData.sceneId, { textOverlay: newText });
                        }
                        setTextEditorData({ isOpen: false, sceneId: null, text: '' });
                    }}
                    onClose={() => setTextEditorData({ isOpen: false, sceneId: null, text: '' })}
                />
            )}
        </div >

    );
};

const TextEditorModal = ({ initialText, onSave, onClose }) => {
    const [text, setText] = useState(initialText);
    const modalRef = useRef(null);
    const textareaRef = useRef(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(text.length, text.length);
        }
    }, []);

    const handleKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            onSave(text);
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div
                ref={modalRef}
                className="relative w-full max-w-md bg-[#0d1117] border border-white/10 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex flex-col animate-in zoom-in-95 fade-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-primary text-[18px]">text_fields</span>
                        <h3 className="text-sm font-black text-white uppercase tracking-tight">Add Text</h3>
                    </div>
                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type your text..."
                        className="w-full h-20 bg-black/40 border border-slate-800 rounded-lg p-3 text-sm font-medium text-white placeholder:text-slate-600 focus:outline-none focus:border-primary/40 transition-all resize-none"
                    />
                    <div className="flex items-center justify-between mt-3">
                        <span className="text-[9px] font-bold text-slate-600">Ctrl+Enter to save</span>
                        <div className="flex items-center gap-2">
                            <button onClick={onClose} className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-slate-400 uppercase hover:text-white transition-colors">Cancel</button>
                            <button onClick={() => onSave(text)} className="px-5 py-1.5 rounded-lg bg-primary text-black text-[10px] font-black uppercase hover:brightness-110 active:scale-95 transition-all">Save</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const InteractionLayer = ({ scene, transformData, setTransformData }) => {
    const layerRef = useRef(null);

    const handleInteractionStart = (e, type) => {
        e.stopPropagation();
        const rect = layerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        setTransformData({
            sceneId: scene.id,
            type,
            startX: e.clientX,
            startY: e.clientY,
            centerX,
            centerY,
            initialX: scene.x || 0,
            initialY: scene.y || 0,
            initialScale: scene.scale || 1,
            initialRotation: scene.rotation || 0
        });
    };

    const isText = scene.mediaType === 'text';

    return (
        <div
            ref={layerRef}
            className={`absolute pointer-events-none z-30 ${isText ? 'inset-0 flex items-center justify-center' : 'inset-0'}`}
            style={isText ? {} : {
                transform: `translate(${scene.x}px, ${scene.y}px) scale(${scene.scale}) rotate(${scene.rotation}deg)`,
            }}
        >
            {/* Bounding Box */}
            <div
                className={`border-2 border-primary/60 shadow-[0_0_20px_rgba(6,208,249,0.3)] pointer-events-auto cursor-move ${isText ? 'relative' : 'absolute inset-0'}`}
                style={isText ? {
                    transform: `translate(${scene.x}px, ${scene.y}px) scale(${scene.scale}) rotate(${scene.rotation}deg)`,
                    padding: '4px 12px',
                    fontSize: `${scene.fontSize || 48}px`,
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                } : {}}
                onPointerDown={(e) => handleInteractionStart(e, 'move')}
            >
                {/* Transparent text to size the box correctly */}
                {isText && <span className="font-black uppercase tracking-tighter italic" style={{ color: 'transparent' }}>{scene.textOverlay || 'Text'}</span>}

                {/* Scale Handles */}
                {['nw', 'ne', 'sw', 'se'].map(pos => (
                    <div
                        key={pos}
                        className={`absolute w-4 h-4 bg-white border-2 border-primary rounded-full shadow-lg cursor-nwse-resize z-40
                            ${pos === 'nw' ? '-top-2 -left-2' : ''}
                            ${pos === 'ne' ? '-top-2 -right-2 !cursor-nesw-resize' : ''}
                            ${pos === 'sw' ? '-bottom-2 -left-2 !cursor-nesw-resize' : ''}
                            ${pos === 'se' ? '-bottom-2 -right-2' : ''}
                        `}
                        onPointerDown={(e) => handleInteractionStart(e, 'scale')}
                    />
                ))}

                {/* Rotation Handle */}
                <div
                    className="absolute -top-12 left-1/2 -translate-x-1/2 w-8 h-8 flex flex-col items-center gap-1 group cursor-pointer"
                    onPointerDown={(e) => handleInteractionStart(e, 'rotate')}
                >
                    <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                    <div className="w-6 h-6 rounded-full bg-white border-2 border-primary shadow-lg flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-[14px]">rotate_right</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const VideoLayer = ({ id, src, startTime, playhead, isPlaying, volume, sourceOffset = 0 }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const sceneTime = playhead - startTime;
        const targetTime = sceneTime + sourceOffset;

        if (Math.abs(video.currentTime - targetTime) > 0.1) {
            video.currentTime = targetTime;
        }

        if (isPlaying) {
            video.play().catch(() => { });
        } else {
            video.pause();
        }
    }, [isPlaying, playhead, startTime, sourceOffset]);

    return (
        <video
            id={id}
            ref={videoRef}
            src={src}
            crossOrigin="anonymous"
            className="w-full h-full object-contain"
            playsInline
            muted={volume === 0}
        />
    );
};

export default Editor;


