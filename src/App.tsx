/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Trophy, Play, RotateCcw, Pause, Volume2, VolumeX } from "lucide-react";

// --- Audio System ---
class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private musicInterval: any = null;

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  toggle(state: boolean) {
    this.enabled = state;
    if (!state) this.stopMusic();
  }

  playEat() {
    if (!this.enabled) return;
    this.initCtx();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx!.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.1, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.ctx!.destination);
    
    osc.start();
    osc.stop(this.ctx!.currentTime + 0.1);
  }

  playGameOver() {
    if (!this.enabled) return;
    this.initCtx();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, this.ctx!.currentTime);
    osc.frequency.linearRampToValueAtTime(50, this.ctx!.currentTime + 0.5);
    
    gain.gain.setValueAtTime(0.1, this.ctx!.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx!.currentTime + 0.5);
    
    osc.connect(gain);
    gain.connect(this.ctx!.destination);
    
    osc.start();
    osc.stop(this.ctx!.currentTime + 0.5);
  }

  playPause() {
    if (!this.enabled) return;
    this.initCtx();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    
    osc.type = "triangle";
    osc.frequency.setValueAtTime(440, this.ctx!.currentTime);
    
    gain.gain.setValueAtTime(0.05, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.ctx!.destination);
    
    osc.start();
    osc.stop(this.ctx!.currentTime + 0.1);
  }

  startMusic() {
    if (!this.enabled || this.musicInterval) return;
    this.initCtx();
    
    let count = 0;
    const notes = [130.81, 146.83, 164.81, 174.61]; // C3, D3, E3, F3
    
    this.musicInterval = setInterval(() => {
      if (!this.enabled || !this.ctx) return;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = "square";
      osc.frequency.setValueAtTime(notes[count % notes.length], this.ctx.currentTime);
      
      gain.gain.setValueAtTime(0.01, this.ctx.currentTime); // Very quiet
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
      
      count++;
    }, 250);
  }

  stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}

const soundManager = new SoundManager();

// Konfigurasi dasar game
const GRID_SIZE = 25;
const INITIAL_SPEED = 150;
const SPEED_INCREMENT = 5;
const MIN_SPEED = 50;

type Point = { x: number; y: number };
type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
type LeaderboardEntry = { score: number; date: string };

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snake, setSnake] = useState<Point[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Point>({ x: 5, y: 5 });
  const [direction, setDirection] = useState<Direction>("RIGHT");
  const [nextDirection, setNextDirection] = useState<Direction>("RIGHT");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [gameState, setGameState] = useState<"START" | "PLAYING" | "PAUSED" | "GAME_OVER">("START");
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const [isMuted, setIsMuted] = useState(false);
  
  // Efek suara ketika gameState berubah
  useEffect(() => {
    if (gameState === "GAME_OVER") {
      soundManager.playGameOver();
      soundManager.stopMusic();
      saveToLeaderboard(score);
    } else if (gameState === "PAUSED") {
      soundManager.playPause();
      soundManager.stopMusic();
    } else if (gameState === "PLAYING") {
      soundManager.startMusic();
    } else if (gameState === "START") {
      soundManager.stopMusic();
    }
  }, [gameState, score]);

  // Sync mute state ke manager
  useEffect(() => {
    soundManager.toggle(!isMuted);
  }, [isMuted]);

  // Load high score and leaderboard
  useEffect(() => {
    const savedHighScore = localStorage.getItem("snakeHighScore");
    if (savedHighScore) setHighScore(parseInt(savedHighScore));

    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch("/api/leaderboard");
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data);
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
    }
  };

  // Save to leaderboard
  const saveToLeaderboard = async (currentScore: number) => {
    if (currentScore <= 0) return;
    
    const date = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });

    try {
      const response = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: currentScore, date }),
      });
      if (response.ok) {
        fetchLeaderboard();
      }
    } catch (err) {
      console.error("Failed to save score:", err);
    }
  };

  // Simpan high score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem("snakeHighScore", score.toString());
    }
  }, [score, highScore]);

  // Fungsi untuk mendapatkan posisi makanan acak
  const getRandomFood = useCallback((currentSnake: Point[]): Point => {
    let newFood: Point;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      const onSnake = currentSnake.some(
        (segment) => segment.x === newFood.x && segment.y === newFood.y
      );
      if (!onSnake) break;
    }
    return newFood;
  }, []);

  // Reset Game
  const resetGame = () => {
    setSnake([{ x: 10, y: 10 }]);
    setFood({ x: 5, y: 5 });
    setDirection("RIGHT");
    setNextDirection("RIGHT");
    setScore(0);
    setSpeed(INITIAL_SPEED);
    setGameState("PLAYING");
    soundManager.playPause(); // Suara start
  };

  // Handle Keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      switch (key) {
        case "arrowup":
        case "w":
          if (direction !== "DOWN") setNextDirection("UP");
          break;
        case "arrowdown":
        case "s":
          if (direction !== "UP") setNextDirection("DOWN");
          break;
        case "arrowleft":
        case "a":
          if (direction !== "RIGHT") setNextDirection("LEFT");
          break;
        case "arrowright":
        case "d":
          if (direction !== "LEFT") setNextDirection("RIGHT");
          break;
        case " ":
          if (gameState === "PLAYING") setGameState("PAUSED");
          else if (gameState === "PAUSED") setGameState("PLAYING");
          else if (gameState === "START" || gameState === "GAME_OVER") resetGame();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [direction, gameState]);

  // Game Loop
  useEffect(() => {
    if (gameState !== "PLAYING") return;

    const moveSnake = () => {
      setSnake((prevSnake) => {
        const head = { ...prevSnake[0] };
        setDirection(nextDirection);
        
        switch (nextDirection) {
          case "UP": head.y -= 1; break;
          case "DOWN": head.y += 1; break;
          case "LEFT": head.x -= 1; break;
          case "RIGHT": head.x += 1; break;
        }

        if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
          setGameState("GAME_OVER");
          return prevSnake;
        }

        if (prevSnake.some((segment) => segment.x === head.x && segment.y === head.y)) {
          setGameState("GAME_OVER");
          return prevSnake;
        }

        const newSnake = [head, ...prevSnake];

        if (head.x === food.x && head.y === food.y) {
          setScore((s) => s + 10);
          setFood(getRandomFood(newSnake));
          setSpeed((prevSpeed) => Math.max(MIN_SPEED, prevSpeed - SPEED_INCREMENT));
          soundManager.playEat(); // Efek suara makan
        } else {
          newSnake.pop();
        }

        return newSnake;
      });
    };

    const interval = setInterval(moveSnake, speed);
    return () => clearInterval(interval);
  }, [gameState, food, speed, nextDirection, getRandomFood]);

  // Render Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = canvas.width / GRID_SIZE;

    // Background Canvas
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid (Sesuai desain: #1e293b)
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * size, 0);
      ctx.lineTo(i * size, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * size);
      ctx.lineTo(canvas.width, i * size);
      ctx.stroke();
    }

    // Gambar Makanan (#f43f5e)
    ctx.fillStyle = "#f43f5e";
    ctx.beginPath();
    ctx.arc(food.x * size + size / 2, food.y * size + size / 2, size / 3, 0, Math.PI * 2);
    ctx.fill();

    // Gambar Ular
    snake.forEach((part, index) => {
      const isHead = index === 0;
      ctx.fillStyle = isHead ? "#4ade80" : "#166534";
      ctx.strokeStyle = "#020617";
      ctx.lineWidth = 2;
      const p = 1;
      ctx.fillRect(part.x * size + p, part.y * size + p, size - p * 2, size - p * 2);
      ctx.strokeRect(part.x * size + p, part.y * size + p, size - p * 2, size - p * 2);

      if (isHead) {
        ctx.fillStyle = "white";
        const s = size / 6;
        if (direction === "RIGHT") {
          ctx.fillRect(part.x * size + (size * 0.7), part.y * size + (size * 0.2), s, s);
          ctx.fillRect(part.x * size + (size * 0.7), part.y * size + (size * 0.6), s, s);
        } else if (direction === "LEFT") {
          ctx.fillRect(part.x * size + (size * 0.1), part.y * size + (size * 0.2), s, s);
          ctx.fillRect(part.x * size + (size * 0.1), part.y * size + (size * 0.6), s, s);
        } else if (direction === "UP") {
          ctx.fillRect(part.x * size + (size * 0.2), part.y * size + (size * 0.1), s, s);
          ctx.fillRect(part.x * size + (size * 0.6), part.y * size + (size * 0.1), s, s);
        } else {
          ctx.fillRect(part.x * size + (size * 0.2), part.y * size + (size * 0.7), s, s);
          ctx.fillRect(part.x * size + (size * 0.6), part.y * size + (size * 0.7), s, s);
        }
      }
    });

  }, [snake, food, direction]);

  const level = Math.floor((INITIAL_SPEED - speed) / SPEED_INCREMENT) + 1;

  // KeyCap Component
  const KeyCap = ({ children }: { children: React.ReactNode }) => (
    <div className="border-2 border-[#64748b] rounded-[6px] px-2 py-1 text-[12px] font-bold text-[#cbd5e1] bg-[#334155] min-w-[2rem] text-center shadow-sm">
      {children}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-[#f8fafc] font-sans flex items-center justify-center p-4">
      <div className="flex flex-col lg:flex-row gap-8 max-w-6xl w-full items-stretch justify-center">
        
        {/* Sidebar Kiri */}
        <div className="w-full lg:w-72 flex flex-col gap-4">
          {/* Card Judul */}
          <div className="bg-[#1e293b] border-2 border-[#334155] rounded-[1.5rem] p-6 flex flex-col items-center">
            <div className="text-4xl font-black text-lime-400 mb-2 italic tracking-tighter">SNAKE LIKE CAKE</div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400 font-bold">Edisi Arkade Klasik</div>
          </div>

          {/* Card Statistik */}
          <div className="bg-[#1e293b] border-2 border-[#334155] rounded-[1.5rem] p-6 flex-1 flex flex-col gap-6 justify-center">
            <div>
              <div className="text-xs uppercase text-slate-400 font-bold mb-1 tracking-wider">Skor Saat Ini</div>
              <div className="text-5xl font-mono font-bold text-white transition-all duration-300">
                {score.toString().padStart(3, '0')}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-400 font-bold mb-1 tracking-wider">Skor Tertinggi</div>
              <div className="text-3xl font-mono font-bold text-indigo-300">
                {highScore.toString().padStart(3, '0')}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-400 font-bold mb-1 tracking-wider">Level Kecepatan</div>
              <div className="text-2xl font-mono font-bold text-rose-400">
                {level.toString().padStart(2, '0')}
              </div>
            </div>
            <div className="pt-4 border-t border-[#334155] flex justify-center">
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className="flex items-center gap-2 px-4 py-2 bg-[#334155] hover:bg-[#475569] rounded-xl transition-colors text-xs font-bold uppercase tracking-wider"
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                {isMuted ? "Suara Mati" : "Suara Nyala"}
              </button>
            </div>
          </div>

          {/* Card Leaderboard */}
          <div className="bg-[#1e293b] border-2 border-[#334155] rounded-[1.5rem] p-6 flex flex-col gap-4">
            <div className="text-xs uppercase text-slate-400 font-bold tracking-wider">Papan Peringkat</div>
            {leaderboard.length > 0 ? (
              <div className="space-y-3">
                {leaderboard.map((entry, idx) => (
                  <div key={idx} className="flex justify-between items-center group">
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-mono text-slate-500">{idx + 1}.</span>
                       <span className="text-sm font-bold text-slate-200">{entry.score}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 uppercase">{entry.date}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[10px] text-slate-500 italic">Belum ada skor...</div>
            )}
          </div>

          {/* Card Kontrol */}
          <div className="bg-[#1e293b] border-2 border-[#334155] rounded-[1.5rem] p-6">
            <div className="text-xs uppercase text-slate-400 font-bold mb-3 tracking-wider">Kontrol</div>
            <div className="flex flex-col items-center gap-2 mb-4">
              <KeyCap>W</KeyCap>
              <div className="flex gap-2">
                <KeyCap>A</KeyCap>
                <KeyCap>S</KeyCap>
                <KeyCap>D</KeyCap>
              </div>
            </div>
            <p className="text-[10px] text-center text-slate-500 leading-relaxed">
              Gunakan tombol panah atau WASD untuk bergerak. Makan buah untuk tumbuh dan menambah kecepatan.
            </p>
          </div>
        </div>

        {/* Area Game Kanan */}
        <div className="relative flex-none">
          <div className="p-1 bg-[#334155] rounded-[0.6rem] shadow-2xl">
            <canvas
              ref={canvasRef}
              width={550}
              height={550}
              className="bg-[#020617] border-[4px] border-[#334155] rounded-[0.5rem] touch-none shadow-inner"
              style={{ width: 'min(90vw, 550px)', height: 'min(90vw, 550px)', imageRendering: 'pixelated' }}
            />
          </div>

          {/* Overlay Menu */}
          <AnimatePresence>
            {gameState !== "PLAYING" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md rounded-[0.5rem] p-6 text-center"
              >
                {gameState === "START" && (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="space-y-6"
                  >
                    <div className="space-y-2">
                      <h2 className="text-4xl font-black text-white italic tracking-tighter">SIAP BERMAIN?</h2>
                      <p className="text-slate-400 text-sm">Tekan tombol di bawah untuk memulai</p>
                    </div>
                    <button
                      onClick={resetGame}
                      className="bg-lime-500 hover:bg-lime-400 text-slate-950 px-10 py-4 rounded-full font-black text-lg transition-all transform active:scale-95 shadow-xl shadow-lime-500/20"
                    >
                      MULAI GAME
                    </button>
                  </motion.div>
                )}

                {gameState === "PAUSED" && (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="space-y-6"
                  >
                    <h2 className="text-5xl font-black text-white italic tracking-tighter">PAUSE</h2>
                    <button
                      onClick={() => setGameState("PLAYING")}
                      className="bg-white hover:bg-slate-200 text-slate-950 px-10 py-4 rounded-full font-black text-lg transition-all transform active:scale-95"
                    >
                      LANJUTKAN
                    </button>
                  </motion.div>
                )}

                {gameState === "GAME_OVER" && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="space-y-6"
                  >
                    <div className="space-y-1">
                      <h2 className="text-6xl font-black text-rose-500 italic tracking-tighter">KALAH!</h2>
                      <div className="text-xl text-white">
                        Skor Akhir: <span className="text-lime-400 font-bold">{score}</span>
                      </div>
                    </div>
                    <button
                      onClick={resetGame}
                      className="bg-lime-500 hover:bg-lime-400 text-slate-950 px-10 py-4 rounded-full font-black text-lg transition-all transform active:scale-95 shadow-xl shadow-lime-500/20"
                    >
                      MAIN LAGI
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tombol Pause */}
          {gameState === "PLAYING" && (
            <button 
              onClick={() => setGameState("PAUSED")}
              className="absolute top-6 right-6 text-slate-600 hover:text-white transition-colors p-2 bg-slate-900/50 rounded-lg"
            >
              <Pause size={24} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
