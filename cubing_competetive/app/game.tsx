"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { useState, useEffect, useRef } from "react";
import { Cube } from "@/lib/shared";
import { Cube3D } from "@/components/Cube3D";
import { MiniCube } from "@/components/MiniCube";
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
  const [opponentCube, setOpponentCube] = useState(() => new Cube());
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

  // Game over/winner states
  const [winner, setWinner] = useState<string | null>(null);
  const [finalSolveTime, setFinalSolveTime] = useState<number | null>(null);
  const [matchCancelledReason, setMatchCancelledReason] = useState<string | null>(null);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [winnerStats, setWinnerStats] = useState<{ moveCount: number; tps: number } | null>(null);
  const [rematchRequested, setRematchRequested] = useState(false);
  const [opponentRematchRequested, setOpponentRematchRequested] = useState(false);
  const [opponentLeft, setOpponentLeft] = useState(false);

  // Load matched game data and apply scramble
  useEffect(() => {
    const matchDataStr = sessionStorage.getItem("currentMatch");
    if (matchDataStr) {
      try {
        const matchData = JSON.parse(matchDataStr);
        if (matchData) {
          setRoomId(matchData.roomId);
          moveSeqRef.current = 0; // Reset sequence number on match load
          if (matchData.scramble) {
            const s = matchData.scramble;
            const initialCube = new Cube(
              s.corners,
              s.cornerOrientation,
              s.edges,
              s.edgeOrientation
            );
            setCube(initialCube);
            
            const initialOpponentCube = new Cube(
              s.corners,
              s.cornerOrientation,
              s.edges,
              s.edgeOrientation
            );
            setOpponentCube(initialOpponentCube);
 
            // Emit scrambleReady to the server
            socket.emit("scrambleReady", { roomId: matchData.roomId });
          }
        }
      } catch (e) {
        console.error("Error loading match data:", e);
      }
    }
  }, []);
 
  // Log general socket connection events
  useEffect(() => {
    function onConnect() {
      console.log("[Event: socket] Connected to server. ID:", socket.id);
    }
    function onDisconnect(reason: string) {
      console.log("[Event: socket] Disconnected from server. Reason:", reason);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  // Listen for gameStart event from the server
  useEffect(() => {
    function onGameStart(data: { startTime: number }) {
      console.log("[Event: gameStart] Match starting at:", data.startTime);
      setMatchStartTime(data.startTime);
      moveSeqRef.current = 0; // Reset sequence number when the game starts just in case
    }
 
    socket.on("gameStart", onGameStart);
    return () => {
      socket.off("gameStart", onGameStart);
    };
  }, []);

  // Listen for opponent moves
  useEffect(() => {
    if (winner !== null) return;

    function onOpponentMove(data: { move: string }) {
      if (winner !== null) return;

      console.log("[Event: opponentMove] Opponent made move:", data.move);
      const isReverse = data.move.endsWith("'");
      const physicalMove = isReverse ? data.move.slice(0, -1) : data.move;

      const VALID_FACES = ["U", "D", "R", "L", "F", "B"];
      if (VALID_FACES.includes(physicalMove)) {
        setOpponentCube((prev) => {
          const next = prev.clone();
          if (isReverse) {
            next.applyMove(physicalMove as any);
            next.applyMove(physicalMove as any);
            next.applyMove(physicalMove as any);
          } else {
            next.applyMove(physicalMove as any);
          }
          return next;
        });
      }
    }

    socket.on("opponentMove", onOpponentMove);
    return () => {
      socket.off("opponentMove", onOpponentMove);
    };
  }, [winner]);

  // Listen for gameFinished event from the server
  useEffect(() => {
    function onGameFinished(data: { winner: string; solveTime: number; moveCount?: number; tps?: number; disconnected?: boolean }) {
      console.log("[Event: gameFinished] Match finished. Winner:", data.winner, "Data:", data);
      setWinner(data.winner);
      setFinalSolveTime(data.solveTime);
      setTimerRunning(false);
      
      if (data.moveCount !== undefined && data.tps !== undefined) {
        setWinnerStats({ moveCount: data.moveCount, tps: data.tps });
      }

      // If the player won by opponent disconnection/forfeit, freeze the clock at their current solve time.
      // Otherwise, freeze at the finished solve time.
      if (data.disconnected) {
        setOpponentDisconnected(true);
        setElapsedWhenStopped((prev) => {
          if (prev === 0 && startTime > 0) {
            return Date.now() - startTime;
          }
          return prev;
        });
      } else {
        setElapsedWhenStopped(data.solveTime);
      }
    }

    socket.on("gameFinished", onGameFinished);
    return () => {
      socket.off("gameFinished", onGameFinished);
    };
  }, [startTime]);

  // Listen for matchCancelled event from the server
  useEffect(() => {
    function onMatchCancelled(data: { reason: string }) {
      console.log("[Event: matchCancelled] Match cancelled. Reason:", data.reason);
      setMatchCancelledReason(data.reason);
      setTimerRunning(false);
    }

    socket.on("matchCancelled", onMatchCancelled);
    return () => {
      socket.off("matchCancelled", onMatchCancelled);
    };
  }, []);

  // Listen for rematch events from the server
  useEffect(() => {
    function onRematchStart(data: { startTime: number; scramble: any }) {
      console.log("[Event: rematchStart] Rematch starting. Data:", data);
      
      // Reset all game states
      setWinner(null);
      setFinalSolveTime(null);
      setElapsedWhenStopped(0);
      setIsSolved(false);
      setOpponentDisconnected(false);
      setWinnerStats(null);
      setRematchRequested(false);
      setOpponentRematchRequested(false);
      setOpponentLeft(false);
      setCountdown(null);
      
      // Apply new scramble
      const initialCube = new Cube(
        data.scramble.corners,
        data.scramble.cornerOrientation,
        data.scramble.edges,
        data.scramble.edgeOrientation
      );
      setCube(initialCube);

      const initialOpponentCube = new Cube(
        data.scramble.corners,
        data.scramble.cornerOrientation,
        data.scramble.edges,
        data.scramble.edgeOrientation
      );
      setOpponentCube(initialOpponentCube);

      // Reset sequence
      moveSeqRef.current = 0;

      // Start countdown
      setMatchStartTime(data.startTime);

      // Update sessionStorage match scramble data
      const matchDataStr = sessionStorage.getItem("currentMatch");
      if (matchDataStr) {
        try {
          const matchData = JSON.parse(matchDataStr);
          matchData.scramble = data.scramble;
          sessionStorage.setItem("currentMatch", JSON.stringify(matchData));
        } catch (e) {
          console.error("Error updating scramble in sessionStorage:", e);
        }
      }
    }

    function onOpponentRequestedRematch() {
      console.log("[Event: opponentRequestedRematch] Opponent requested a rematch");
      setOpponentRematchRequested(true);
    }

    function onOpponentLeftFinishedRoom() {
      console.log("[Event: opponentLeftFinishedRoom] Opponent left the room");
      setOpponentLeft(true);
    }

    socket.on("rematchStart", onRematchStart);
    socket.on("opponentRequestedRematch", onOpponentRequestedRematch);
    socket.on("opponentLeftFinishedRoom", onOpponentLeftFinishedRoom);
    return () => {
      socket.off("rematchStart", onRematchStart);
      socket.off("opponentRequestedRematch", onOpponentRequestedRematch);
      socket.off("opponentLeftFinishedRoom", onOpponentLeftFinishedRoom);
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
    if (roomId && winner === null) {
      const seq = moveSeqRef.current++;
      console.log(`[Move] Emitting move: ${moveStr}, seq: ${seq}`);
      socket.emit("move", {
        roomId,
        move: moveStr,
        seq,
      });
    }
  };

  const handleRequestRematch = () => {
    if (roomId) {
      console.log("[Event: client] Emitting requestRematch for room:", roomId);
      setRematchRequested(true);
      socket.emit("requestRematch", { roomId });
    }
  };

  // Bind keyboard controls
  useCubeKeyboardControls(setCube, timerRunning && !winner, handleMove);

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

        {/* Match Cancelled Overlay */}
        {matchCancelledReason !== null && (
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center z-50 pointer-events-auto">
            <div className="text-center max-w-md px-8 py-10 bg-black/40 border border-white/10 rounded-3xl shadow-2xl">
              <div className="text-4xl md:text-5xl font-black text-rose-500 mb-4 drop-shadow-[0_0_30px_rgba(244,63,94,0.4)]">
                MATCH CANCELLED
              </div>
              <p className="text-lg text-gray-300 font-semibold mb-8">
                {matchCancelledReason}
              </p>
              <button
                onClick={() => {
                  sessionStorage.removeItem("currentMatch");
                  router.push("/");
                }}
                className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-lg rounded-2xl border border-white/10 shadow-2xl transition-all duration-200 transform hover:scale-105 active:scale-95 cursor-pointer"
              >
                Back to Lobby
              </button>
            </div>
          </div>
        )}

        {/* Game Finished Overlay */}
        {winner !== null && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center z-50 pointer-events-auto">
            <div className="text-center max-w-md px-8 py-10 bg-black/40 border border-white/10 rounded-3xl shadow-2xl">
              <div className={`text-5xl md:text-6xl font-black mb-4 ${
                winner === socket.id 
                  ? "text-emerald-400 drop-shadow-[0_0_30px_rgba(16,185,129,0.5)]" 
                  : "text-rose-500 drop-shadow-[0_0_30px_rgba(244,63,94,0.5)]"
              }`}>
                {winner === socket.id ? "YOU WIN! 🎉" : "YOU LOSE 😢"}
              </div>
              <p className="text-lg text-gray-300 font-semibold mb-2">
                {opponentDisconnected ? (
                  <span className="text-rose-400 font-bold">Opponent disconnected from the match</span>
                ) : (
                  <>
                    Solve time: <span className="text-amber-400 font-bold">{formatTime(finalSolveTime || 0)}</span>
                  </>
                )}
              </p>
              {!opponentDisconnected && winnerStats && (
                <div className="flex justify-center gap-6 text-sm text-gray-400 font-medium mb-8">
                  <div>Moves: <span className="text-white font-bold">{winnerStats.moveCount}</span></div>
                  <div>TPS: <span className="text-white font-bold">{winnerStats.tps.toFixed(2)}</span></div>
                </div>
              )}
              {opponentDisconnected || opponentLeft ? (
                <p className="text-sm font-semibold text-rose-400 mb-8 uppercase tracking-widest bg-rose-950/20 px-4 py-2 border border-rose-900/30 rounded-xl">
                  {opponentDisconnected ? "Opponent Disconnected" : "Opponent Left"}
                </p>
              ) : (
                opponentRematchRequested && !rematchRequested && (
                  <p className="text-sm font-semibold text-emerald-400 mb-4 animate-bounce uppercase tracking-widest">
                    Opponent wants a rematch!
                  </p>
                )
              )}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full">
                {!opponentDisconnected && !opponentLeft && (
                  <>
                    {rematchRequested ? (
                      <button
                        disabled
                        className="px-8 py-4 bg-slate-700 text-slate-400 font-extrabold text-lg rounded-2xl border border-white/5 shadow-2xl transition-all duration-200 cursor-not-allowed animate-pulse w-full sm:w-auto"
                      >
                        Waiting for opponent...
                      </button>
                    ) : (
                      <button
                        onClick={handleRequestRematch}
                        className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-lg rounded-2xl border border-emerald-400/20 shadow-2xl transition-all duration-200 transform hover:scale-105 active:scale-95 cursor-pointer w-full sm:w-auto"
                      >
                        Play Again
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={() => {
                    sessionStorage.removeItem("currentMatch");
                    router.push("/");
                  }}
                  className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-lg rounded-2xl border border-white/10 shadow-2xl transition-all duration-200 transform hover:scale-105 active:scale-95 cursor-pointer w-full sm:w-auto"
                >
                  Back to Lobby
                </button>
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
                winner 
                  ? winner === socket.id 
                    ? "text-emerald-400" 
                    : "text-rose-400"
                  : timerRunning 
                    ? "text-emerald-400 animate-pulse" 
                    : isSolved 
                      ? "text-blue-400" 
                      : "text-amber-400"
              }`}>
                {winner 
                  ? winner === socket.id 
                    ? "YOU WON!" 
                    : "YOU LOST!" 
                  : timerRunning 
                    ? "SOLVING" 
                    : isSolved 
                      ? "SOLVED!" 
                      : "READY"}
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

          {/* Opponent Mini Cube */}
          <div className="absolute bottom-8 right-8 z-30 pointer-events-auto shadow-2xl transition-transform duration-200 hover:scale-105">
            <MiniCube cube={opponentCube} />
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
