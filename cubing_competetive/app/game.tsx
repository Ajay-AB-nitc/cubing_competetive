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
    winnerStats,
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
                onClick={leaveMatch}
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
                onClick={leaveMatch}
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

        {/* Center Timer Display */}
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
                  onClick={leaveMatch}
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
