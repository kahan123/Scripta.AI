import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

const BackgroundEffects = () => {
    const containerRef = useRef(null);

    useGSAP(() => {
        const bubbles = gsap.utils.toArray('.bubble');

        bubbles.forEach((bubble) => {
            gsap.set(bubble, {
                x: gsap.utils.random(0, window.innerWidth),
                y: gsap.utils.random(0, window.innerHeight),
                opacity: gsap.utils.random(0.3, 0.7),
                scale: gsap.utils.random(0.5, 1.5),
            });

            gsap.to(bubble, {
                x: '+=random(-200, 200)',
                y: '+=random(-200, 200)',
                duration: gsap.utils.random(5, 10),
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut',
                delay: gsap.utils.random(0, 5),
            });
        });
    }, { scope: containerRef });

    return (
        <div ref={containerRef} className="fixed inset-0 z-0 overflow-hidden pointer-events-none opacity-80">
            {/* Deep Dark Background */}
            <div className="absolute inset-0 bg-[#0a0f12]" />

            {/* Ambient Base Gradient */}
            <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 via-slate-900 to-primary/20" />

            {/* Dynamic Animated Bubbles */}
            <div className="bubble absolute w-[500px] h-[500px] rounded-full bg-primary/30 blur-[120px] mix-blend-screen" />
            <div className="bubble absolute w-[400px] h-[400px] rounded-full bg-blue-500/20 blur-[100px] mix-blend-screen" />
            <div className="bubble absolute w-[600px] h-[600px] rounded-full bg-indigo-500/15 blur-[140px] mix-blend-screen" />
            <div className="bubble absolute w-[450px] h-[450px] rounded-full bg-cyan-400/25 blur-[110px] mix-blend-screen" />
            <div className="bubble absolute w-[550px] h-[550px] rounded-full bg-primary/20 blur-[130px] mix-blend-screen" />

            {/* Noise/Texture Overlay */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

            <div className="absolute inset-0 backdrop-blur-[1px]" />
        </div>
    );
};

export default BackgroundEffects;
