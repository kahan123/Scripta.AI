import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import InteractiveBackground from './components/InteractiveBackground'

function LandingPage() {
  const [inputValue, setInputValue] = useState('')
  const containerRef = useRef(null)
  const navigate = useNavigate()

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.from('.hero-content h1', {
      y: 80,
      opacity: 0,
      duration: 1.2,
      delay: 0.3
    })
      .from('.hero-content p', {
        y: 30,
        opacity: 0,
        duration: 1,
      }, '-=0.8')
      .from('.search-container', {
        y: 40,
        opacity: 0,
        scale: 0.97,
        duration: 1.2,
      }, '-=0.6')
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="relative h-screen w-full overflow-hidden">
      {/* Interactive Particle Background */}
      <InteractiveBackground />

      {/* Full-page layout */}
      <div className="relative z-10 flex h-full flex-col">
        {/* ── Navbar ── */}
        <header className="flex-shrink-0 flex items-center justify-between px-6 md:px-12 lg:px-20 py-5">
          <div className="flex items-center gap-3 text-white">
            <span className="material-symbols-outlined text-primary text-2xl">movie_edit</span>
            <h2 className="text-white text-xl font-bold tracking-tight">Scripta.ai</h2>
          </div>
          <div className="flex items-center gap-8">
            <nav className="hidden md:flex items-center gap-8">
              <a className="text-slate-400 hover:text-primary transition-colors text-sm font-medium" href="#">Features</a>
              <a className="text-slate-400 hover:text-primary transition-colors text-sm font-medium" href="#">How it Works</a>
              <a className="text-slate-400 hover:text-primary transition-colors text-sm font-medium" href="#">Pricing</a>
            </nav>
            <button className="flex items-center justify-center rounded-full h-10 px-6 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 transition-all text-sm font-bold">
              Sign In
            </button>
          </div>
        </header>

        {/* ── Hero Content — vertically & horizontally centered ── */}
        <main className="flex-1 flex items-center justify-center px-4 md:px-8">
          <div className="w-full max-w-4xl mx-auto hero-content">
            <div className="flex flex-col gap-8 items-center text-center">
              {/* Title */}
              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black leading-[1.05] tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary via-blue-400 to-indigo-500">
                From Script to Screen.
              </h1>

              {/* Subtitle */}
              <p className="text-slate-400 text-base sm:text-lg md:text-xl font-medium leading-relaxed max-w-xl">
                AI-powered video generation from any text or script.
              </p>

              {/* Search / Input Bar */}
              <div className="w-full max-w-[800px] mt-4 search-container">
                <div className="flex w-full items-center rounded-full bg-[#0d1f24]/80 backdrop-blur-xl shadow-[0_4px_40px_rgba(6,208,249,0.1)] border border-slate-700/50 hover:border-primary/40 transition-all duration-300 p-1.5 pl-4 md:pl-5 h-14 md:h-16">
                  <div className="flex items-center gap-2 pr-3 border-r border-slate-700/50">
                    <button aria-label="Attach Paper" className="text-slate-500 hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-[22px]">attach_file</span>
                    </button>
                    <button aria-label="Voice input" className="text-slate-500 hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-[22px]">mic</span>
                    </button>
                  </div>
                  <input
                    className="flex w-full min-w-0 flex-1 bg-transparent text-white focus:outline-none border-none h-full placeholder:text-slate-600 px-4 text-sm md:text-base font-medium"
                    placeholder="Describe your idea, paste a script, or just start typing..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                  />
                  <button onClick={() => navigate('/storyboard', { state: { prompt: inputValue } })} className="flex-shrink-0 flex items-center justify-center gap-2 rounded-full h-10 md:h-12 px-5 md:px-7 bg-primary hover:bg-primary/90 text-[#0a1215] shadow-lg shadow-primary/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] text-sm font-bold whitespace-nowrap">
                    <span className="material-symbols-outlined text-lg">auto_awesome</span>
                    <span>Generate Video</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default LandingPage
