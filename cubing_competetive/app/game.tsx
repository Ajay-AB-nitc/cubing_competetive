"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { useState, useEffect, useRef } from "react";
import { Cube } from "@/lib/shared";
import { Cube3D } from "@/components/Cube3D";
import { useCubeKeyboardControls } from "@/lib/useCubeKeyboardControls";
import { useRouter } from "next/navigation";
import { socket } from "@/components/SocketStatus";

// Formats millisecond time
function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const centiseconds = Math.floor((ms % 1000) / 10);
  
  const csStr = centiseconds.toString().padStart(2, "0");
  const sStr = seconds.toString().padStart(2, "0");
  if (minutes > 0) {
    return `${minutes}:${sStr}.${csStr}`;
  }
  return `${seconds}.${csStr}`;
}

interface TimerProps {
  isRunning: boolean;
  startTime: number;
  elapsedWhenStopped: number;
}

function Timer({ isRunning, startTime, elapsedWhenStopped }: TimerProps) {
  const [timeElapsed, setTimeElapsed] = useState(0);

  useEffect(() => {
    if (!isRunning) {
      setTimeElapsed(elapsedWhenStopped);
      return;
    }

    const intervalId = setInterval(() => {
      setTimeElapsed(Date.now() - startTime);
    }, 10);

    return () => clearInterval(intervalId);
  }, [isRunning, startTime, elapsedWhenStopped]);

  return (
    <div className="text-7xl md:text-8xl font-black tabular-nums tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
      {formatTime(timeElapsed)}
    </div>
  );
}

function GameContent() {
  const router = useRouter();
  const [cube, setCube] = useState(() => new Cube());
  const [roomId, setRoomId] = useState<string | null>(null);

  // Sequence number for moves starting at 0
  const moveSeqRef = useRef(0);

  // Timer states (not running initially)
  const [timerRunning, setTimerRunning] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [elapsedWhenStopped, setElapsedWhenStopped] = useState(0);
  const [isSolved, setIsSolved] = useState(false);

  // Match start and countdown state
  const [matchStartTime, setMatchStartTime] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);

  // Load matched game data and apply scramble
  useEffect(() => {
    const matchDataStr = sessionStorage.getItem("currentMatch");
    if (matchDataStr) {
      try {
        const matchData = JSON.parse(matchDataStr);
        if (matchData) {
          setRoomId(matchData.roomId);
          if (matchData.scramble) {
            const s = matchData.scramble;
            setCube(new Cube(
              s.corners,
              s.cornerOrientation,
              s.edges,
              s.edgeOrientation
            ));

            // Emit scrambleReady to the server
            socket.emit("scrambleReady", { roomId: matchData.roomId });
          }
        }
      } catch (e) {
        console.error("Error loading match data:", e);
      }
    }
  }, []);

  // Listen for gameStart event from the server
  useEffect(() => {
    function onGameStart(data: { startTime: number }) {
      setMatchStartTime(data.startTime);
    }

    socket.on("gameStart", onGameStart);
    return () => {
      socket.off("gameStart", onGameStart);
    };
  }, []);

  // Handle countdown logic
  useEffect(() => {
    if (!matchStartTime) return;

    const intervalId = setInterval(() => {
      const now = Date.now();
      const diff = matchStartTime - now;

      if (diff <= 0) {
        clearInterval(intervalId);
        setCountdown(null);
        setTimerRunning(true);
        setStartTime(matchStartTime);
      } else {
        // Show remaining seconds with 1 decimal point for visual precision
        setCountdown((diff / 1000).toFixed(1));
      }
    }, 50);

    return () => clearInterval(intervalId);
  }, [matchStartTime]);

  // Solve detection
  useEffect(() => {
    const solved = cube.isSolved();
    setIsSolved(solved);
    if (timerRunning && solved) {
      setTimerRunning(false);
      const solveTime = Date.now() - startTime;
      setElapsedWhenStopped(solveTime);
    }
  }, [cube, timerRunning, startTime]);

  // Emit cube moves to the server with sequence number
  const handleMove = (moveStr: string) => {
    if (roomId) {
      const seq = moveSeqRef.current++;
      console.log(`[Move] Emitting move: ${moveStr}, seq: ${seq}`);
      socket.emit("move", {
        roomId,
        move: moveStr,
        seq,
      });
    }
  };

  // Bind keyboard controls
  useCubeKeyboardControls(setCube, timerRunning, handleMove);

  return (
    <>
      <Cube3D cube={cube} />

      <Html fullscreen style={{ pointerEvents: "none" }}>
        {/* Countdown Overlay */}
        {countdown !== null && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center z-50 pointer-events-auto">
            <div className="text-center animate-pulse">
              <div className="text-8xl md:text-9xl font-black text-amber-400 drop-shadow-[0_0_40px_rgba(245,158,11,0.6)] font-mono">
                {countdown}
              </div>
              <div className="text-lg md:text-xl font-bold uppercase tracking-widest text-gray-300 mt-6">
                Match Starting...
              </div>
              <div className="text-xs text-gray-500 mt-2 font-medium">
                Hands off the keyboard!
              </div>
            </div>
          </div>
        )}

        <div className="absolute inset-0 flex flex-col justify-between p-8 text-white font-sans">
          {/* Top Stats */}
          <div className="flex justify-between items-start pointer-events-auto">
            <div className="bg-black/40 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 shadow-2xl">
              <h1 className="text-xs uppercase tracking-widest text-gray-400 font-bold">Match Room</h1>
              <p className="text-lg font-extrabold text-amber-400 mt-1 font-mono">
                {roomId ?? "No Active Room"}
              </p>
            </div>

            <div className="bg-black/40 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 shadow-2xl text-right">
              <h2 className="text-xs uppercase tracking-widest text-gray-400 font-bold">Status</h2>
              <p className={`text-sm font-semibold mt-1 ${
                timerRunning 
                  ? "text-emerald-400 animate-pulse" 
                  : isSolved 
                    ? "text-blue-400" 
                    : "text-amber-400"
              }`}>
                {timerRunning ? "SOLVING" : isSolved ? "SOLVED!" : "READY"}
              </p>
            </div>
          </div>

          {/* Center Timer Display (starts at 0.00 since timerRunning is false) */}
          <div className="flex flex-col items-center justify-center flex-grow pointer-events-auto">
            <div className="text-center">
              <Timer
                isRunning={timerRunning}
                startTime={startTime}
                elapsedWhenStopped={elapsedWhenStopped}
              />
              
              <div className="mt-8 flex gap-4 justify-center">
                {!timerRunning && (
                  <button
                    onClick={() => {
                      sessionStorage.removeItem("currentMatch");
                      router.push("/");
                    }}
                    className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-lg rounded-2xl border border-white/10 shadow-2xl transition-all duration-200 transform hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    Leave Match
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Instructions / Keyboard Hints */}
          <div className="flex justify-center pointer-events-auto">
            <div className="bg-black/60 backdrop-blur-lg px-8 py-4 rounded-3xl border border-white/10 shadow-2xl max-w-xl text-center">
              <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Controls</p>
              <div className="grid grid-cols-6 gap-2 text-xs md:text-sm font-semibold text-gray-300">
                <div><kbd className="px-2 py-1 bg-white/10 rounded">U</kbd> Top</div>
                <div><kbd className="px-2 py-1 bg-white/10 rounded">D</kbd> Bottom</div>
                <div><kbd className="px-2 py-1 bg-white/10 rounded">L</kbd> Left</div>
                <div><kbd className="px-2 py-1 bg-white/10 rounded">R</kbd> Right</div>
                <div><kbd className="px-2 py-1 bg-white/10 rounded">F</kbd> Front</div>
                <div><kbd className="px-2 py-1 bg-white/10 rounded">B</kbd> Back</div>
              </div>
            </div>
          </div>
        </div>
      </Html>
    </>
  );
}

export default function Game() {
  return (
    <div className="w-screen h-screen bg-slate-950">
      <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} />

        <GameContent />

        <OrbitControls />
      </Canvas>
    </div>
  );
}
