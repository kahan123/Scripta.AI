import { useRef, useEffect, useCallback } from 'react';
import gsap from 'gsap';

const InteractiveBackground = () => {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const particlesRef = useRef([]);
  const frameRef = useRef(null);

  const PARTICLE_COUNT = 120;
  const CONNECTION_DISTANCE = 150;
  const MOUSE_RADIUS = 200;
  const BASE_COLOR = { r: 6, g: 208, b: 249 };   // #06d0f9
  const ACCENT_COLOR = { r: 99, g: 102, b: 241 }; // indigo-500

  const createParticle = useCallback((width, height) => {
    const depth = Math.random();
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      baseX: 0,
      baseY: 0,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: gsap.utils.mapRange(0, 1, 1.2, 3.5, depth),
      depth,
      opacity: gsap.utils.mapRange(0, 1, 0.15, 0.7, depth),
      glowOpacity: 0,
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.01 + Math.random() * 0.02,
      color: Math.random() > 0.6 ? ACCENT_COLOR : BASE_COLOR,
    };
  }, []);

  const initParticles = useCallback((width, height) => {
    const particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = createParticle(width, height);
      p.baseX = p.x;
      p.baseY = p.y;
      particles.push(p);
    }
    particlesRef.current = particles;
  }, [createParticle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.scale(dpr, dpr);

      if (particlesRef.current.length === 0) {
        initParticles(window.innerWidth, window.innerHeight);
      }
    };

    resize();
    window.addEventListener('resize', resize);

    const handleMouseMove = (e) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };

    const handleMouseLeave = () => {
      gsap.to(mouseRef.current, {
        x: -1000,
        y: -1000,
        duration: 0.8,
        ease: 'power2.out',
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    const animate = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const mouse = mouseRef.current;

      ctx.clearRect(0, 0, w, h);

      // ── Draw the cursor glow ──
      if (mouse.x > -500 && mouse.y > -500) {
        const gradient = ctx.createRadialGradient(
          mouse.x, mouse.y, 0,
          mouse.x, mouse.y, MOUSE_RADIUS * 1.5
        );
        gradient.addColorStop(0, `rgba(${BASE_COLOR.r}, ${BASE_COLOR.g}, ${BASE_COLOR.b}, 0.08)`);
        gradient.addColorStop(0.5, `rgba(${BASE_COLOR.r}, ${BASE_COLOR.g}, ${BASE_COLOR.b}, 0.03)`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
      }

      const particles = particlesRef.current;

      // ── Update particles ──
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Drift motion
        p.x += p.vx;
        p.y += p.vy;

        // Pulse
        p.pulsePhase += p.pulseSpeed;
        const pulse = Math.sin(p.pulsePhase) * 0.3 + 0.7;

        // Wrap around edges with buffer
        if (p.x < -50) p.x = w + 50;
        if (p.x > w + 50) p.x = -50;
        if (p.y < -50) p.y = h + 50;
        if (p.y > h + 50) p.y = -50;

        // Mouse interaction — push particles away & glow
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < MOUSE_RADIUS) {
          const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
          const angle = Math.atan2(dy, dx);
          // Push away
          p.x -= Math.cos(angle) * force * 3;
          p.y -= Math.sin(angle) * force * 3;
          // Glow up
          p.glowOpacity = gsap.utils.clamp(0, 1, force * 1.2);
        } else {
          p.glowOpacity *= 0.95; // Fade glow
        }

        // ── Draw particle ──
        const currentRadius = p.radius * pulse;
        const alpha = p.opacity * pulse;

        // Outer glow when near mouse
        if (p.glowOpacity > 0.01) {
          const glowGradient = ctx.createRadialGradient(
            p.x, p.y, 0,
            p.x, p.y, currentRadius * 8
          );
          glowGradient.addColorStop(0, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.glowOpacity * 0.4})`);
          glowGradient.addColorStop(1, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, 0)`);
          ctx.beginPath();
          ctx.arc(p.x, p.y, currentRadius * 8, 0, Math.PI * 2);
          ctx.fillStyle = glowGradient;
          ctx.fill();
        }

        // Core dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${alpha + p.glowOpacity * 0.3})`;
        ctx.fill();
      }

      // ── Draw connections ──
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DISTANCE) {
            // Only draw connections when at least one particle is near mouse
            const mouseDistA = Math.sqrt(
              (mouse.x - a.x) ** 2 + (mouse.y - a.y) ** 2
            );
            const mouseDistB = Math.sqrt(
              (mouse.x - b.x) ** 2 + (mouse.y - b.y) ** 2
            );

            const nearMouse = mouseDistA < MOUSE_RADIUS * 1.5 || mouseDistB < MOUSE_RADIUS * 1.5;
            const baseAlpha = 1 - dist / CONNECTION_DISTANCE;

            if (nearMouse) {
              const closeness = Math.min(mouseDistA, mouseDistB) / (MOUSE_RADIUS * 1.5);
              const lineAlpha = baseAlpha * (1 - closeness) * 0.5;

              if (lineAlpha > 0.01) {
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.strokeStyle = `rgba(${BASE_COLOR.r}, ${BASE_COLOR.g}, ${BASE_COLOR.b}, ${lineAlpha})`;
                ctx.lineWidth = 0.8;
                ctx.stroke();
              }
            } else if (baseAlpha > 0.5) {
              // Faint ambient connections for closest particles
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.strokeStyle = `rgba(${BASE_COLOR.r}, ${BASE_COLOR.g}, ${BASE_COLOR.b}, ${baseAlpha * 0.04})`;
              ctx.lineWidth = 0.4;
              ctx.stroke();
            }
          }
        }
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [initParticles]);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden">
      {/* Deep dark base */}
      <div className="absolute inset-0 bg-[#080d10]" />
      {/* Subtle radial gradient base */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, rgba(6,208,249,0.06) 0%, rgba(8,13,16,0) 70%)',
        }}
      />
      {/* Interactive Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ pointerEvents: 'none' }}
      />
      {/* Noise overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
    </div>
  );
};

export default InteractiveBackground;
