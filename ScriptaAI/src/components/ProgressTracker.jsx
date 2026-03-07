import { useNavigate, useLocation } from 'react-router-dom';

const phases = [
    { path: '/storyboard', label: 'Script', icon: 'edit_note', step: 1 },
    { path: '/storyboard', label: 'Scenes', icon: 'dashboard', step: 2 },
    { path: '/preview', label: 'Preview', icon: 'smart_display', step: 3 },
    { path: '/editor', label: 'Editor', icon: 'movie_edit', step: 4 },
];

const getStep = (pathname) => {
    if (pathname === '/storyboard') return 1; // can be 1 or 2 but handled internally
    if (pathname === '/preview') return 3;
    if (pathname === '/editor') return 4;
    return 0;
};

const ProgressTracker = ({ currentStep, rightElement }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const step = currentStep || getStep(location.pathname);

    return (
        <nav className="flex-shrink-0 flex items-center justify-between px-6 md:px-10 py-3.5 border-b border-slate-800/60 bg-[#0a1014]/90 backdrop-blur-xl z-50">
            {/* Logo */}
            <div
                className="flex items-center gap-2.5 cursor-pointer group"
                onClick={() => navigate('/')}
            >
                <span className="material-symbols-outlined text-primary text-2xl group-hover:scale-110 transition-transform">
                    movie_edit
                </span>
                <span className="text-white text-lg font-bold tracking-tight">Scripta.ai</span>
            </div>

            {/* Phase Steps */}
            <div className="hidden md:flex items-center gap-1">
                {phases.map((phase, i) => {
                    const phaseStep = phase.step;
                    const isActive = phaseStep === step;
                    const isCompleted = phaseStep < step;

                    return (
                        <div key={i} className="flex items-center">
                            <div
                                className={`
                  flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-300
                  ${isActive
                                        ? 'bg-primary/15 text-primary border border-primary/30 shadow-[0_0_15px_rgba(6,208,249,0.08)]'
                                        : isCompleted
                                            ? 'text-primary/60'
                                            : 'text-slate-600'
                                    }
                `}
                            >
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold border ${isActive ? 'border-primary bg-primary/20 text-primary'
                                    : isCompleted ? 'border-primary/40 bg-primary/10 text-primary/60'
                                        : 'border-slate-700 text-slate-600'
                                    }`}>
                                    {isCompleted ? '✓' : phaseStep}
                                </div>
                                <span>{phase.label}</span>
                            </div>

                            {i < phases.length - 1 && (
                                <div className={`w-6 h-px mx-0.5 ${isCompleted ? 'bg-primary/40' : 'bg-slate-800'}`} />
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="min-w-[96px] flex justify-end">
                {rightElement}
            </div>
        </nav>
    );
};

export default ProgressTracker;
