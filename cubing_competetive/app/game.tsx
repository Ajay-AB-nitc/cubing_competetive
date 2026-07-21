"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { Cube3D } from "@/components/Cube3D";
import { MiniCube } from "@/components/MiniCube";
import { Timer } from "@/components/Timer";
import { useCubeKeyboardControls } from "@/lib/useCubeKeyboardControls";
import { useGameLogic } from "@/lib/useGameLogic";
import { formatTime } from "@/lib/timeUtils";
import { socket } from "@/components/SocketStatus";

function GameContent() {
  const {
    cube,
    setCube,
    opponentCube,
    roomId,
    timerRunning,
    startTime,
    elapsedWhenStopped,
    isSolved,
    countdown,
    winner,
    finalSolveTime,
    matchCancelledReason,
    opponentDisconnected,
    playerStats,
    rematchRequested,
    opponentRematchRequested,
    opponentLeft,
    handleMove,
    handleRequestRematch,
    leaveMatch,
  } = useGameLogic();

  // Bind keyboard controls
  useCubeKeyboardControls(setCube, timerRunning && !winner, handleMove);

  return (
    <>
      <Cube3D cube={cube} />

      <Html fullscreen style={{ pointerEvents: "none" }}>
        {/* Countdown Overlay */}
        {countdown !== null && (
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md flex flex-col items-center justify-center z-50 pointer-events-auto">
            <div className="text-center">
              <div className="text-8xl md:text-9xl font-black text-amber-400 font-mono tracking-tight">
                {countdown}
              </div>
              <div className="text-sm font-semibold uppercase tracking-widest text-zinc-400 mt-6">
                Match Starting
              </div>
            </div>
          </div>
        )}

        {/* Match Cancelled Overlay */}
        {matchCancelledReason !== null && (
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md flex flex-col items-center justify-center z-50 pointer-events-auto">
            <div className="text-center max-w-sm px-8 py-8 bg-zinc-900/70 border border-zinc-800 rounded-2xl shadow-xl">
              <div className="text-2xl font-bold text-rose-400 tracking-wider uppercase mb-2">
                Match Cancelled
              </div>
              <p className="text-sm text-zinc-400 font-medium mb-6">
                {matchCancelledReason}
              </p>
              <button
                onClick={leaveMatch}
                className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-sm rounded-xl border border-zinc-700 transition-all duration-150 cursor-pointer"
              >
                Back to Lobby
              </button>
            </div>
          </div>
        )}

        {/* Game Finished Overlay */}
        {winner !== null && (
          <div className="absolute inset-0 bg-zinc-950/85 backdrop-blur-md flex flex-col items-center justify-center z-50 pointer-events-auto">
            <div className="text-center max-w-sm w-full px-8 py-8 bg-zinc-900/80 border border-zinc-800 rounded-2xl shadow-2xl">
              <div className={`text-4xl font-black tracking-widest uppercase mb-6 ${
                winner === socket.id 
                  ? "text-emerald-400" 
                  : "text-rose-400"
              }`}>
                {winner === socket.id ? "VICTORY" : "DEFEAT"}
              </div>

              {opponentDisconnected ? (
                <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider bg-rose-950/30 py-2 rounded-lg border border-rose-900/30 mb-6">
                  Opponent Disconnected
                </p>
              ) : (
                <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-4 mb-6 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">Time</div>
                    <div className="text-sm font-mono font-bold text-amber-400">
                      {formatTime(finalSolveTime || 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">Moves</div>
                    <div className="text-sm font-mono font-bold text-zinc-100">
                      {playerStats ? playerStats.moveCount : 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">TPS</div>
                    <div className="text-sm font-mono font-bold text-zinc-100">
                      {playerStats ? playerStats.tps.toFixed(2) : "0.00"}
                    </div>
                  </div>
                </div>
              )}

              {opponentLeft && !opponentDisconnected && (
                <p className="text-xs font-medium text-zinc-400 mb-4 uppercase tracking-wider">
                  Opponent Left
                </p>
              )}

              {opponentRematchRequested && !rematchRequested && !opponentDisconnected && !opponentLeft && (
                <p className="text-xs font-semibold text-emerald-400 mb-4 uppercase tracking-wider">
                  Rematch Requested
                </p>
              )}

              <div className="flex flex-col gap-3 w-full">
                {!opponentDisconnected && !opponentLeft && (
                  <>
                    {rematchRequested ? (
                      <button
                        disabled
                        className="w-full py-2.5 bg-zinc-800 text-zinc-500 font-semibold text-sm rounded-xl border border-zinc-800 cursor-not-allowed"
                      >
                        Waiting for opponent...
                      </button>
                    ) : (
                      <button
                        onClick={handleRequestRematch}
                        className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm rounded-xl transition-all duration-150 cursor-pointer"
                      >
                        Play Again
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={leaveMatch}
                  className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-sm rounded-xl border border-zinc-700 transition-all duration-150 cursor-pointer"
                >
                  Back to Lobby
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="absolute inset-0 flex flex-col justify-between p-6 text-white font-sans pointer-events-none">
          {/* Top Stats */}
          <div className="flex justify-between items-start pointer-events-auto">
            <div className="bg-zinc-900/70 backdrop-blur-md px-4 py-2.5 rounded-xl border border-zinc-800">
              <h1 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Room</h1>
              <p className="text-sm font-bold text-zinc-200 mt-0.5 font-mono">
                {roomId ?? "Solo"}
              </p>
            </div>

            <div className="bg-zinc-900/70 backdrop-blur-md px-4 py-2.5 rounded-xl border border-zinc-800 text-right">
              <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Status</h2>
              <p className={`text-xs font-bold tracking-wider mt-0.5 uppercase ${
                winner 
                  ? winner === socket.id 
                    ? "text-emerald-400" 
                    : "text-rose-400"
                  : timerRunning 
                    ? "text-emerald-400" 
                    : isSolved 
                      ? "text-blue-400" 
                      : "text-amber-400"
              }`}>
                {winner 
                  ? winner === socket.id 
                    ? "VICTORY" 
                    : "DEFEAT" 
                  : timerRunning 
                    ? "SOLVING" 
                    : isSolved 
                      ? "SOLVED" 
                      : "READY"}
              </p>
            </div>
          </div>

          {/* Center Timer Display */}
          <div className="flex flex-col items-center justify-center flex-grow pointer-events-auto">
            <div className="text-center">
              <Timer
                isRunning={timerRunning}
                startTime={startTime}
                elapsedWhenStopped={elapsedWhenStopped}
              />
              
              <div className="mt-6 flex justify-center">
                {!timerRunning && !winner && (
                  <button
                    onClick={leaveMatch}
                    className="px-5 py-2 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-semibold text-xs rounded-xl border border-zinc-800 transition-all duration-150 cursor-pointer"
                  >
                    Leave Match
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Opponent Mini Cube */}
          <div className="absolute bottom-6 right-6 z-30 pointer-events-auto">
            <MiniCube cube={opponentCube} />
          </div>

          {/* Bottom Instructions / Keyboard Hints */}
          <div className="flex justify-center pointer-events-auto">
            <div className="bg-zinc-900/70 backdrop-blur-md px-6 py-3 rounded-xl border border-zinc-800 text-center">
              <div className="flex items-center gap-4 text-xs font-mono text-zinc-400">
                <div><kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-zinc-200">U</kbd> Top</div>
                <div><kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-zinc-200">D</kbd> Bottom</div>
                <div><kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-zinc-200">L</kbd> Left</div>
                <div><kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-zinc-200">R</kbd> Right</div>
                <div><kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-zinc-200">F</kbd> Front</div>
                <div><kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-zinc-200">B</kbd> Back</div>
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
