// Mock data for ScriptaAI — 6-scene pipeline

export const mockScript = `The rise of artificial intelligence has fundamentally reshaped how we interact with technology. From voice assistants to autonomous vehicles, AI systems now permeate every aspect of modern life. But beneath the surface of these consumer-facing applications lies a deeper revolution — one that is transforming scientific research, creative production, and knowledge dissemination at an unprecedented scale.

Consider the challenge of communicating complex research findings. Traditional methods — dense papers, static slide decks, monotone conference talks — fail to engage modern audiences. Studies show that video content increases information retention by up to 65% compared to text-only formats, yet producing high-quality video remains prohibitively expensive and time-consuming for most researchers and content creators.

This is where AI-powered video generation enters the picture. By leveraging large language models for scriptwriting, diffusion models for visual generation, and neural text-to-speech for narration, we can compress weeks of production into minutes. The key innovation is not any single model, but the orchestration — an agentic pipeline that decomposes the creative task, generates each component, and assembles them into a cohesive narrative.

Our framework, ScriptaAI, implements exactly this vision. Users provide a text prompt or script, and the system automatically generates a structured storyboard, produces scene-by-scene visuals, synthesizes narration audio, and compiles the final video. At every stage, the human remains in control — approving scripts, editing scenes, and refining the output.

The results speak for themselves: a 40-hour production pipeline compressed to under 15 minutes, with user studies confirming a 4.2x improvement in audience engagement. Domain experts rated the accuracy of AI-generated visuals at 91%, validating that quality need not be sacrificed for speed.

The future of knowledge sharing is visual, accessible, and powered by intelligent automation. ScriptaAI represents a step toward that future — democratizing video production and making cinematic storytelling available to anyone with an idea worth sharing.`;

export const mockScenes = [
    {
        id: 1,
        sceneNumber: 1,
        title: 'The AI Revolution',
        narration: 'The rise of artificial intelligence has fundamentally reshaped how we interact with technology. From voice assistants to autonomous vehicles, AI systems now permeate every aspect of modern life.',
        visualPrompt: 'Futuristic cityscape with holographic AI interfaces floating in the air, cinematic blue lighting',
        visualType: 'Cinematic B-Roll',
        duration: 12,
        color: '#06d0f9',
        section: 'Introduction',
        visualIdea: 'A sprawling neon city with floating data streams',
        confidence: 0.95,
        citation: 'Global AI Impact Report 2025'
    },
    {
        id: 2,
        sceneNumber: 2,
        title: 'The Communication Gap',
        narration: 'Traditional methods of communicating research — dense papers, static slides — fail to engage modern audiences. Video content increases retention by 65% compared to text alone.',
        visualPrompt: 'Split screen comparison: boring PowerPoint presentation vs dynamic engaging video content',
        visualType: 'Comparison Layout',
        duration: 10,
        color: '#818cf8',
        section: 'Problem Statement',
        visualIdea: 'Dull paper vs vibrant digital tablet',
        confidence: 0.88,
        citation: 'EdTech Retention Study 2024'
    },
    {
        id: 3,
        sceneNumber: 3,
        title: 'AI Video Generation',
        narration: 'By leveraging large language models, diffusion models, and neural text-to-speech, we can compress weeks of video production into minutes.',
        visualPrompt: 'Abstract visualization of neural network processing text into images and audio waveforms',
        visualType: 'Motion Graphics',
        duration: 11,
        color: '#34d399',
        section: 'Solution',
        visualIdea: 'Code morphing into beautiful imagery',
        confidence: 0.92,
        citation: 'ScriptaAI Technical Whitepaper'
    },
    {
        id: 4,
        sceneNumber: 4,
        title: 'The Future is Visual',
        narration: 'The future of knowledge sharing is visual, accessible, and powered by intelligent automation. ScriptaAI democratizes video production for everyone.',
        visualPrompt: 'Inspiring closing montage: diverse creators using ScriptaAI, videos spreading globally, logo reveal',
        visualType: 'Cinematic Montage',
        duration: 12,
        color: '#a78bfa',
        section: 'Conclusion',
        visualIdea: 'Global network of glowing creators',
        confidence: 0.97,
        citation: 'Digital Democracy Journal'
    },
];

export const TOTAL_DURATION = mockScenes.reduce((sum, s) => sum + s.duration, 0);
