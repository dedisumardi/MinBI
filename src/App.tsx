import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, Share2, MoreVertical, Instagram, Youtube, Mail, MessageCircle,
  X, Send, Sparkles, Loader2, RotateCcw, Trophy, User, Cpu, 
  Globe, Copy, Check, BookOpen, Lightbulb, ClipboardCheck,
  ChevronRight, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { askAI, getMotivation, getSpmbTips } from './services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Logo URL
const LOGO_URL = "https://lh3.googleusercontent.com/d/13xKYJNVnD9yLx1dSl60_Ik2vPlurDdA-";

export default function App() {
  // --- UI States ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isGameOpen, setIsGameOpen] = useState(false);
  const [isAIFeaturesOpen, setIsAIFeaturesOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // --- Game States ---
  const [gameMode, setGameMode] = useState<'Offline' | 'PvE' | 'Online'>('Offline');
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState(true);
  const [isBotThinking, setIsBotThinking] = useState(false);
  
  // --- Online Game States ---
  const [roomId, setRoomId] = useState("");
  const [mySymbol, setMySymbol] = useState<'X' | 'O' | null>(null);
  const [playerCount, setPlayerCount] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);

  // --- Chat States ---
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<{ role: 'assistant' | 'user'; text: string }[]>([
    { role: 'assistant', text: 'Halo! Saya asisten AI SDIT Bina Insan Parepare. Ada yang bisa saya bantu?' }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- AI Feature States ---
  const [motivation, setMotivationText] = useState("");
  const [isMotivationLoading, setIsMotivationLoading] = useState(false);
  const [spmbTips, setSpmbTipsText] = useState("");
  const [isSpmbLoading, setIsSpmbLoading] = useState(false);

  // --- Utilities ---
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- Game Logic ---
  const calculateWinner = (squares: (string | null)[]) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (const [a, b, c] of lines) {
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    return null;
  };

  const winner = calculateWinner(board);
  const isDraw = !winner && board.every(s => s !== null);

  const getBotMove = (currentBoard: (string | null)[]) => {
    const available = currentBoard.map((v, i) => v === null ? i : null).filter(v => v !== null) as number[];
    if (available.length === 0) return null;
    
    // Simple logic: try to win, then block, then random
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    
    // Try to win
    for (const [a, b, c] of lines) {
      const vals = [currentBoard[a], currentBoard[b], currentBoard[c]];
      if (vals.filter(v => v === 'O').length === 2 && vals.filter(v => v === null).length === 1) {
        return [a, b, c][vals.indexOf(null)];
      }
    }
    // Block player
    for (const [a, b, c] of lines) {
      const vals = [currentBoard[a], currentBoard[b], currentBoard[c]];
      if (vals.filter(v => v === 'X').length === 2 && vals.filter(v => v === null).length === 1) {
        return [a, b, c][vals.indexOf(null)];
      }
    }
    
    return available[Math.floor(Math.random() * available.length)];
  };

  const handleSquareClick = (i: number) => {
    if (winner || board[i] || isBotThinking) return;

    if (gameMode === 'Online') {
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
      const isMyTurn = (xIsNext && mySymbol === 'X') || (!xIsNext && mySymbol === 'O');
      if (!isMyTurn || playerCount < 2) return;
      
      socketRef.current.send(JSON.stringify({ type: 'MOVE', index: i }));
      return;
    }

    const newBoard = [...board];
    newBoard[i] = xIsNext ? 'X' : 'O';
    setBoard(newBoard);
    setXIsNext(!xIsNext);
  };

  useEffect(() => {
    if (gameMode === 'PvE' && !xIsNext && !winner && !isDraw) {
      setIsBotThinking(true);
      const timer = setTimeout(() => {
        const move = getBotMove(board);
        if (move !== null) {
          const newBoard = [...board];
          newBoard[move] = 'O';
          setBoard(newBoard);
          setXIsNext(true);
        }
        setIsBotThinking(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [xIsNext, gameMode, board, winner, isDraw]);

  // --- WebSocket Handlers ---
  const connectToRoom = (id: string) => {
    // Close existing connection if any
    if (socketRef.current) {
      if (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING) {
        socketRef.current.close();
      }
      socketRef.current = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;
    console.log("[Client] Connecting to WebSocket:", wsUrl);
    
    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log("[Client] WebSocket Connected Successfully");
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomId: id }));
        }
      };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
        case 'ROOM_JOINED':
          setMySymbol(data.symbol);
          setBoard(data.board);
          setXIsNext(data.xIsNext);
          setPlayerCount(data.playerCount);
          setRoomId(id);
          break;
        case 'PLAYER_JOINED':
          setPlayerCount(data.playerCount);
          showToast("Pemain lain bergabung!");
          break;
        case 'PLAYER_LEFT':
          setPlayerCount(data.playerCount);
          showToast("Pemain lain keluar.", "error");
          break;
        case 'GAME_UPDATE':
          setBoard(data.board);
          setXIsNext(data.xIsNext);
          break;
        case 'ERROR':
          showToast(data.message, "error");
          ws.close();
          break;
        }
      } catch (e) {
        console.error("Error parsing WS message:", e);
      }
    };
    
    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      showToast("Gagal terhubung ke server game.", "error");
    };

    ws.onclose = () => {
      setRoomId("");
      setMySymbol(null);
      setPlayerCount(0);
    };
    } catch (err) {
      console.error("Failed to create WebSocket:", err);
      showToast("Tidak dapat menginisialisasi koneksi.", "error");
    }
  };

  const createRoom = () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    connectToRoom(id);
  };

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim()) {
      connectToRoom(roomId.trim().toUpperCase());
    }
  };

  const resetGame = () => {
    if (gameMode === 'Online') {
      socketRef.current?.send(JSON.stringify({ type: 'RESET' }));
    } else {
      setBoard(Array(9).fill(null));
      setXIsNext(true);
    }
  };

  // --- AI Handlers ---
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg = chatInput;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput("");
    setIsChatLoading(true);

    const systemInstruction = "Anda adalah asisten AI resmi SDIT Bina Insan Parepare. Jawablah dengan ramah, informatif, dan gunakan bahasa Indonesia yang baik. Anda memiliki akses ke pencarian Google untuk memberikan informasi terbaru dan akurat mengenai SDIT Bina Insan Parepare, kegiatan sekolah, prestasi, dan pengumuman terkini. Fokus pada informasi sekolah, pendidikan karakter, dan nilai-nilai islami.";
    const reply = await askAI(userMsg, systemInstruction);
    
    setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
    setIsChatLoading(false);
  };

  const handleGetMotivation = async () => {
    setIsMotivationLoading(true);
    const text = await getMotivation();
    setMotivationText(text);
    setIsMotivationLoading(false);
  };

  const handleGetSpmbTips = async (cat: string) => {
    setIsSpmbLoading(true);
    const text = await getSpmbTips(cat);
    setSpmbTipsText(text);
    setIsSpmbLoading(false);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="min-h-screen flex items-center justify-center p-0 sm:p-4">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={cn(
              "fixed top-6 z-[100] px-6 py-3 rounded-full shadow-2xl font-bold text-sm flex items-center gap-2 border",
              toast.type === 'success' ? "bg-teal-600 border-teal-400 text-white" : "bg-rose-600 border-rose-400 text-white"
            )}
          >
            {toast.type === 'success' ? <Check size={16} /> : <X size={16} />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="w-full max-w-[480px] min-h-screen sm:min-h-[850px] bg-slate-900 sm:rounded-[3rem] shadow-2xl relative flex flex-col overflow-hidden border border-white/5">
        
        {/* Header */}
        <header className="p-6 flex justify-between items-center">
          <div className="glass-card px-4 py-1.5 rounded-full text-[10px] font-black text-teal-400 tracking-widest uppercase">
            SIT BINA INSAN HUB
          </div>
          <div className="flex gap-2">
            <button className="p-2.5 rounded-full glass-card hover:bg-white/10 transition-all text-slate-300 cursor-pointer border-0">
              <Bell size={18} />
            </button>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                showToast("Tautan disalin!");
              }}
              className="p-2.5 rounded-full glass-card hover:bg-white/10 transition-all text-slate-300 cursor-pointer border-0"
            >
              <Share2 size={18} />
            </button>
          </div>
        </header>

        {/* Profile */}
        <section className="flex flex-col items-center px-6 pt-4 pb-8 text-center">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-32 h-32 mb-6"
          >
            <div className="absolute inset-0 bg-teal-500/20 rounded-full blur-2xl animate-pulse" />
            <div className="relative w-full h-full bg-white rounded-full p-1 border-4 border-slate-800 shadow-2xl overflow-hidden">
              <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
          </motion.div>
          <h1 className="text-2xl font-black tracking-tight uppercase mb-2 font-display">SDIT BINA INSAN PAREPARE</h1>
          <p className="text-xs text-slate-400 font-medium italic opacity-80 max-w-[300px] mb-3">
            "Membentuk Generasi Qur'ani, Cerdas, dan Berakhlak Mulia"
          </p>
          <div className="text-[10px] text-slate-500 font-medium max-w-[280px]">
            Jl. Jend. Sudirman No 44 A, Kec. Bacukiki Barat, Kota Parepare, Prov. Sulawesi Selatan.
          </div>
        </section>

        {/* AI Quick Actions */}
        <section className="px-6 grid grid-cols-2 gap-4 mb-8">
          <button 
            onClick={() => setIsChatOpen(true)}
            className="group relative overflow-hidden bg-gradient-to-br from-teal-600 to-emerald-800 p-6 rounded-3xl shadow-xl border border-white/10 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer text-white"
          >
            <Sparkles className="text-yellow-300 mb-3 group-hover:rotate-12 transition-transform" size={24} />
            <div className="text-left">
              <div className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Tanya</div>
              <div className="text-sm font-black uppercase tracking-tighter">Asisten ✨ AI</div>
            </div>
          </button>
          <button 
            onClick={() => setIsAIFeaturesOpen(true)}
            className="group relative overflow-hidden bg-gradient-to-br from-indigo-600 to-blue-800 p-6 rounded-3xl shadow-xl border border-white/10 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer text-white"
          >
            <Lightbulb className="text-yellow-200 mb-3 group-hover:rotate-12 transition-transform" size={24} />
            <div className="text-left">
              <div className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Fitur</div>
              <div className="text-sm font-black uppercase tracking-tighter">Pintar ✨ AI</div>
            </div>
          </button>
        </section>

        {/* Main Links */}
        <section className="px-6 space-y-4 mb-12">
          <LinkButton 
            title="Informasi SPMB 2026/2027" 
            onClick={() => window.open("https://wa.me/6282396578994", "_blank")}
            icon={<ChevronRight size={18} />}
          />
          <LinkButton 
            title="Youtube Channel" 
            onClick={() => window.open("https://www.youtube.com/@sitbinainsanparepare4104", "_blank")}
            icon={<Youtube size={18} />}
          />
          <motion.button 
            animate={{ opacity: [1, 0.7, 1], scale: [1, 1.02, 1] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            onClick={() => { setIsGameOpen(true); resetGame(); }}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white p-5 rounded-2xl font-black text-sm shadow-xl transition-all active:scale-[0.98] flex items-center justify-between group border-0 cursor-pointer"
          >
            <span className="uppercase tracking-wider">Main Game Tic-Tac-Toe 🎮</span>
            <div className="bg-white/20 p-1 rounded-lg group-hover:translate-x-1 transition-transform">
              <ChevronRight size={18} />
            </div>
          </motion.button>
        </section>

        {/* Socials */}
        <footer className="mt-auto px-6 pb-12 flex flex-col items-center">
          <div className="flex gap-6 mb-8">
            <SocialIcon icon={<Instagram size={20} />} href="https://www.instagram.com/sditbinainsanparepare/" />
            <SocialIcon icon={<Youtube size={20} />} href="https://www.youtube.com/@sitbinainsanparepare4104" />
            <SocialIcon icon={<MessageCircle size={20} />} href="https://wa.me/6282396578994" />
            <SocialIcon icon={<Mail size={20} />} href="mailto:restu@sditbinainsanparepare.sch.id" />
          </div>
          <div className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-2">
            © 2026 TIM HUMAS SIT BINA INSAN
          </div>
          <div className="w-12 h-1 bg-white/5 rounded-full" />
        </footer>

        {/* --- Modals --- */}
        
        {/* Chat AI Modal */}
        <AnimatePresence>
          {isChatOpen && (
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute inset-0 z-50 bg-slate-900 flex flex-col"
            >
              <div className="p-6 bg-slate-800 border-b border-white/5 flex justify-between items-center shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="bg-teal-600 p-2.5 rounded-xl shadow-lg shadow-teal-500/20">
                    <Sparkles size={20} className="text-yellow-300 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm uppercase tracking-tight">Asisten AI</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                      <span className="text-[9px] text-emerald-400 font-black uppercase tracking-widest">Online</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 border-0 cursor-pointer">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.map((msg, i) => (
                  <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[85%] p-4 rounded-2xl text-sm shadow-sm",
                      msg.role === 'user' 
                        ? "bg-teal-700 text-white rounded-tr-none" 
                        : "bg-slate-800 text-slate-100 rounded-tl-none border border-white/5"
                    )}>
                      <div className="markdown-body">
                        <Markdown>{msg.text}</Markdown>
                      </div>
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800 px-5 py-4 rounded-2xl rounded-tl-none border border-white/5 flex items-center gap-3">
                      <Loader2 size={16} className="animate-spin text-teal-400" />
                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Berpikir...</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendChat} className="p-6 bg-slate-800 border-t border-white/5">
                <div className="relative flex items-center">
                  <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Tanyakan sesuatu..."
                    className="w-full bg-slate-900 border border-white/10 rounded-2xl py-5 px-6 pr-16 text-sm focus:outline-none focus:border-teal-500 transition-all placeholder:text-slate-600 font-medium text-white"
                  />
                  <button 
                    type="submit"
                    disabled={!chatInput.trim() || isChatLoading}
                    className="absolute right-2 p-3.5 bg-teal-600 rounded-xl text-white disabled:opacity-50 transition-all hover:bg-teal-700 active:scale-90 shadow-lg border-0 cursor-pointer"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Features Modal */}
        <AnimatePresence>
          {isAIFeaturesOpen && (
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="absolute inset-0 z-50 bg-slate-900 flex flex-col"
            >
              <div className="p-6 bg-slate-800 border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-600 p-2.5 rounded-xl">
                    <Lightbulb size={20} className="text-white" />
                  </div>
                  <h3 className="font-black text-sm uppercase tracking-tight">Fitur Pintar AI</h3>
                </div>
                <button onClick={() => setIsAIFeaturesOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 border-0 cursor-pointer">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Motivasi */}
                <div className="glass-card p-6 rounded-3xl space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <BookOpen className="text-indigo-400" size={20} />
                    <h4 className="font-black text-xs uppercase tracking-widest">Motivasi Islami</h4>
                  </div>
                  {motivation ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-slate-900/50 p-4 rounded-xl text-sm italic text-slate-300 border-l-4 border-indigo-500"
                    >
                      "{motivation}"
                    </motion.div>
                  ) : (
                    <p className="text-xs text-slate-500">Butuh semangat hari ini? Klik tombol di bawah.</p>
                  )}
                  <button 
                    onClick={handleGetMotivation}
                    disabled={isMotivationLoading}
                    className="w-full bg-indigo-600 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 text-white border-0 cursor-pointer"
                  >
                    {isMotivationLoading ? <Loader2 className="animate-spin" size={14} /> : 'Generate Motivasi ✨'}
                  </button>
                </div>

                {/* SPMB Tips */}
                <div className="glass-card p-6 rounded-3xl space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <ClipboardCheck className="text-emerald-400" size={20} />
                    <h4 className="font-black text-xs uppercase tracking-widest">Tips Persiapan SPMB</h4>
                  </div>
                  {spmbTips ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-slate-900/50 p-4 rounded-xl text-xs text-slate-300 whitespace-pre-wrap"
                    >
                      <Markdown>{spmbTips}</Markdown>
                    </motion.div>
                  ) : (
                    <p className="text-xs text-slate-500">Persiapan tes atau wawancara? Tanya AI kami.</p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => handleGetSpmbTips("Wawancara Orang Tua")}
                      disabled={isSpmbLoading}
                      className="bg-white/5 hover:bg-white/10 py-3 rounded-xl text-[9px] font-bold uppercase tracking-widest border border-white/10 text-white cursor-pointer"
                    >
                      Tips Wawancara
                    </button>
                    <button 
                      onClick={() => handleGetSpmbTips("Observasi Anak")}
                      disabled={isSpmbLoading}
                      className="bg-white/5 hover:bg-white/10 py-3 rounded-xl text-[9px] font-bold uppercase tracking-widest border border-white/10 text-white cursor-pointer"
                    >
                      Tips Observasi
                    </button>
                  </div>
                  {isSpmbLoading && <div className="flex justify-center"><Loader2 className="animate-spin text-emerald-500" size={16} /></div>}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game Modal */}
        <AnimatePresence>
          {isGameOpen && (
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="absolute inset-0 z-50 bg-slate-900 flex flex-col"
            >
              <div className="p-6 bg-slate-800 border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-orange-500 p-2.5 rounded-xl shadow-lg shadow-orange-500/20">
                    <Globe size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm uppercase tracking-tight">Tic-Tac-Toe</h3>
                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">
                      {gameMode === 'Online' ? 'Mode Online' : gameMode === 'PvE' ? 'Vs Bot' : 'Mode Offline'}
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsGameOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 border-0 cursor-pointer">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center p-6">
                {/* Mode Selector */}
                <div className="flex bg-white/5 p-1 rounded-2xl mb-10 border border-white/10">
                  {(['Offline', 'PvE', 'Online'] as const).map((mode) => (
                    <button 
                      key={mode}
                      onClick={() => { setGameMode(mode); resetGame(); }}
                      className={cn(
                        "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-0 cursor-pointer",
                        gameMode === mode ? "bg-orange-500 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                {gameMode === 'Online' && !roomId ? (
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-full max-w-[320px] glass-card p-8 rounded-[2.5rem] text-center"
                  >
                    <div className="w-16 h-16 bg-teal-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-teal-500/20">
                      <User className="text-teal-400" size={32} />
                    </div>
                    <h4 className="text-xl font-black mb-6 tracking-tight">Main Bareng Teman</h4>
                    <button 
                      onClick={createRoom}
                      className="w-full bg-teal-600 py-5 rounded-2xl font-black text-xs shadow-xl active:scale-[0.97] transition-all hover:bg-teal-700 uppercase tracking-widest mb-6 text-white border-0 cursor-pointer"
                    >
                      Buat Room Baru
                    </button>
                    <div className="relative mb-6 flex items-center text-slate-600">
                      <div className="flex-1 h-[1px] bg-white/5" />
                      <span className="px-4 text-[9px] font-black uppercase tracking-widest">Atau Gabung</span>
                      <div className="flex-1 h-[1px] bg-white/5" />
                    </div>
                    <form onSubmit={joinRoom} className="flex gap-2">
                      <input 
                        type="text" 
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                        placeholder="KODE ROOM"
                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-xs focus:border-orange-500 outline-none uppercase font-black tracking-widest text-center text-white"
                      />
                      <button type="submit" className="bg-white text-slate-900 font-black px-6 rounded-2xl text-[10px] active:scale-[0.95] transition-all border-0 cursor-pointer">JOIN</button>
                    </form>
                  </motion.div>
                ) : (
                  <div className="w-full flex flex-col items-center">
                    {gameMode === 'Online' && roomId && (
                      <div className="w-full max-w-[320px] glass-card p-4 rounded-2xl mb-8 flex justify-between items-center">
                        <div className="text-left">
                          <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Kode Room</div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-black tracking-widest text-orange-400">{roomId}</span>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(roomId);
                                showToast("Kode disalin!");
                              }}
                              className="p-1.5 hover:bg-white/10 rounded-lg text-teal-400 border-0 cursor-pointer"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Pemain</div>
                          <div className="flex items-center gap-2 justify-end">
                            <div className={cn("w-2 h-2 rounded-full", playerCount === 2 ? "bg-emerald-500" : "bg-orange-500 animate-pulse")} />
                            <span className="text-[10px] font-black">{playerCount}/2</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mb-8 text-center min-h-[80px] flex flex-col justify-center">
                      {winner ? (
                        <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-2">
                          <Trophy className="text-yellow-400" size={40} />
                          <div className="text-2xl font-black text-emerald-400 tracking-tighter uppercase">
                            {gameMode === 'Online' ? (winner === mySymbol ? "MENANG!" : "KALAH!") : `Pemain ${winner} Menang!`}
                          </div>
                        </motion.div>
                      ) : isDraw ? (
                        <div className="text-xl font-black text-amber-400 uppercase tracking-widest">Seri!</div>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <div className={cn(
                            "px-6 py-2 rounded-full border-2 transition-all duration-500",
                            ((xIsNext && (mySymbol === 'X' || !mySymbol)) || (!xIsNext && (mySymbol === 'O' || !mySymbol))) 
                              ? "bg-orange-500/20 border-orange-500 shadow-lg" 
                              : "bg-white/5 border-white/10 opacity-50"
                          )}>
                            <span className="text-sm font-black tracking-widest uppercase">
                              {gameMode === 'Online' 
                                ? (((xIsNext && mySymbol === 'X') || (!xIsNext && mySymbol === 'O')) ? "Giliran Kamu" : "Giliran Lawan")
                                : (xIsNext ? "Giliran X" : "Giliran O")}
                            </span>
                          </div>
                          {isBotThinking && <div className="text-[10px] text-orange-400 animate-pulse font-black uppercase">Bot berpikir...</div>}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3 bg-white/5 p-4 rounded-[2rem] border border-white/10 shadow-2xl">
                      {board.map((square, i) => (
                        <button 
                          key={i} 
                          onClick={() => handleSquareClick(i)}
                          disabled={!!winner || !!isDraw || !!square || (gameMode === 'Online' && playerCount < 2)}
                          className={cn(
                            "h-20 w-20 rounded-2xl text-3xl font-black flex items-center justify-center transition-all duration-300 transform active:scale-90 border-0 cursor-pointer",
                            !square ? "bg-white/5 hover:bg-white/10 border border-white/5" : "bg-slate-800 border-2 border-white/10",
                            square === 'X' ? "text-blue-400" : "text-rose-400"
                          )}
                        >
                          {square}
                        </button>
                      ))}
                    </div>

                    <div className="mt-10 flex gap-4">
                      <button onClick={resetGame} className="flex items-center gap-2 text-[10px] font-black text-slate-500 hover:text-white transition-all uppercase tracking-widest px-6 py-3 rounded-full border border-white/5 bg-transparent cursor-pointer">
                        <RotateCcw size={14} /> Reset
                      </button>
                      {gameMode === 'Online' && roomId && (
                        <button 
                          onClick={() => { socketRef.current?.close(); setRoomId(""); }}
                          className="flex items-center gap-2 text-[10px] font-black text-rose-500 hover:text-rose-400 transition-all uppercase tracking-widest px-6 py-3 rounded-full border border-rose-500/20 bg-transparent cursor-pointer"
                        >
                          Keluar
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}

// --- Sub-components ---

function LinkButton({ title, onClick, icon }: { title: string; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button 
      onClick={onClick}
      className="w-full glass-card hover:bg-white/10 text-slate-200 p-5 rounded-2xl font-bold text-sm shadow-lg transition-all active:scale-[0.98] flex items-center justify-between group border-0 cursor-pointer"
    >
      <span className="text-left">{title}</span>
      <div className="text-slate-500 group-hover:text-teal-400 transition-colors">
        {icon}
      </div>
    </button>
  );
}

function SocialIcon({ icon, href }: { icon: React.ReactNode; href: string }) {
  return (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer"
      className="text-slate-500 hover:text-teal-400 transition-all hover:scale-110"
    >
      {icon}
    </a>
  );
}
