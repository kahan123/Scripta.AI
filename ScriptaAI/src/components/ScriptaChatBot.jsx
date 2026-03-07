import { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const ScriptaChatBot = ({ context, mode, onUpdate, inline = false }) => {
    const [isOpen, setIsOpen] = useState(inline);
    const [messages, setMessages] = useState([
        { role: 'assistant', content: `I'm Scripta AI Chat Bot. I can help you edit this ${mode === 'storyboard' ? 'script' : 'breakdown'}—just tell me what to change!` }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsLoading(true);

        try {
            const response = await axios.post('http://localhost:5000/api/chat-assistant', {
                message: userMsg,
                context: context,
                mode: mode
            });

            const { message, updatedData } = response.data;

            setMessages(prev => [...prev, { role: 'assistant', content: message }]);

            if (onUpdate && updatedData) {
                onUpdate(updatedData);
            }
        } catch (error) {
            console.error("Chat assistant error:", error);
            setMessages(prev => [...prev, { role: 'assistant', content: "I'm sorry, I encountered an error. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const chatContent = (
        <div className={`${inline ? 'w-full h-[550px]' : 'mb-4 w-80 md:w-96 h-[500px] shadow-2xl'} bg-[#0c1418] border border-primary/20 rounded-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300`}>
            {/* Header */}
            <div className="bg-primary/10 px-5 py-3 border-b border-primary/20 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-[0_0_10px_rgba(6,208,249,0.3)]">
                        <span className="material-symbols-outlined text-black text-[16px]">smart_toy</span>
                    </div>
                    <div>
                        <h3 className="text-xs font-bold text-white tracking-tight leading-none uppercase">Scripta AI Chat Bot</h3>
                        <p className="text-[9px] text-primary/70 font-bold uppercase tracking-widest mt-1">
                            {mode === 'storyboard' ? 'Script Consultant' : 'Director'}
                        </p>
                    </div>
                </div>
                {!inline && (
                    <button
                        onClick={() => setIsOpen(false)}
                        className="text-slate-500 hover:text-white transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                )}
            </div>

            {/* Messages */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth"
                style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(6,208,249,0.2) transparent'
                }}
            >
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[90%] px-3.5 py-2 rounded-2xl text-[12px] leading-relaxed ${msg.role === 'user'
                            ? 'bg-primary text-black font-semibold rounded-tr-none'
                            : 'bg-slate-900 border border-slate-800 text-slate-300 rounded-tl-none'
                            }`}>
                            {msg.content}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-slate-900 border border-slate-800 text-slate-200 px-3.5 py-2 rounded-2xl rounded-tl-none flex items-center gap-2">
                            <div className="flex gap-1">
                                <div className="w-1 h-1 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-1 h-1 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                                <div className="w-1 h-1 bg-primary/80 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Thinking...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-slate-800/50 bg-[#080d10]/40 flex-shrink-0">
                <div className="relative flex items-center">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Type to edit script..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-4 pr-10 text-xs text-slate-200 focus:outline-none focus:border-primary/40 transition-colors"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-1.5 w-7 h-7 rounded-lg bg-primary text-black flex items-center justify-center shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="material-symbols-outlined text-[16px]">send</span>
                    </button>
                </div>
            </div>

            <style jsx>{`
                .flex-1::-webkit-scrollbar {
                    width: 4px;
                }
                .flex-1::-webkit-scrollbar-track {
                    background: transparent;
                }
                .flex-1::-webkit-scrollbar-thumb {
                    background: rgba(6, 208, 249, 0.1);
                    border-radius: 10px;
                }
                .flex-1::-webkit-scrollbar-thumb:hover {
                    background: rgba(6, 208, 249, 0.3);
                }
            `}</style>
        </div>
    );

    if (inline) return chatContent;

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
            {isOpen && chatContent}

            {/* Bubble */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(6,208,249,0.3)] transform transition-all hover:scale-110 active:scale-95 ${isOpen ? 'bg-slate-900 text-white' : 'bg-primary text-black'
                    }`}
            >
                <span className="material-symbols-outlined text-[28px]">
                    {isOpen ? 'close' : 'smart_toy'}
                </span>

                {!isOpen && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-[#080d10] flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    </div>
                )}
            </button>
        </div>
    );
};

export default ScriptaChatBot;
