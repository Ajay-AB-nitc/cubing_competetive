"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useRouter } from "next/navigation";

const SOCKET_URL = "http://localhost:3001";

// Create a singleton socket instance for client-side reuse
export const socket = io(SOCKET_URL, {
  autoConnect: false,
});

export default function SocketStatus() {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [queueStatus, setQueueStatus] = useState<"idle" | "queued">("idle");
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [matchedRoomId, setMatchedRoomId] = useState<string | null>(null);

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
      setQueueStatus("idle");
      setQueuePosition(null);
      setMatchedRoomId(null);
    }

    function onQueueStatus(data: { status: "idle" | "queued"; position?: number }) {
      setQueueStatus(data.status);
      setQueuePosition(data.position ?? null);
      if (data.status === "queued") {
        setMatchedRoomId(null);
      }
    }

    function onMatchFound(data: { roomId: string; scramble: any }) {
      setQueueStatus("idle");
      setQueuePosition(null);
      setMatchedRoomId(data.roomId);
      
      // Save current match data for /game page to consume
      sessionStorage.setItem("currentMatch", JSON.stringify(data));
      
      // Route to game page
      router.push("/game");
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("queueStatus", onQueueStatus);
    socket.on("matchFound", onMatchFound);

    // Establish connection if not already connected
    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("queueStatus", onQueueStatus);
      socket.off("matchFound", onMatchFound);
    };
  }, []);

  const handleJoinQueue = () => {
    if (isConnected) {
      setMatchedRoomId(null);
      socket.emit("joinQueue");
    }
  };

  const handleLeaveQueue = () => {
    if (isConnected) {
      socket.emit("leaveQueue");
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4 rounded-3xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl w-60 transition-all duration-300">
      {/* Connection Status Header */}
      <div className="flex items-center justify-between gap-6 border-b border-white/5 pb-2">
        <span className="text-xs uppercase tracking-wider text-gray-400 font-bold">Server Connection</span>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {isConnected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? "bg-emerald-500" : "bg-rose-500"}`}></span>
          </span>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isConnected ? "text-emerald-400" : "text-rose-400"}`}>
            {isConnected ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      {/* Matchmaking Queue / Room Info */}
      <div className="flex flex-col gap-2">
        {matchedRoomId ? (
          <div className="flex flex-col gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400 font-semibold">Match Status:</span>
              <span className="text-emerald-400 font-extrabold tracking-wide uppercase">READY</span>
            </div>
            <div className="flex flex-col gap-1 mt-1">
              <span className="text-[10px] uppercase font-bold text-gray-500">Room ID</span>
              <span className="font-mono text-xs text-white bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/5 truncate select-all" title={matchedRoomId}>
                {matchedRoomId}
              </span>
            </div>
            <button
              onClick={handleJoinQueue}
              className="mt-2 w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs rounded-xl transition-all duration-200 cursor-pointer"
            >
              Find Another Match
            </button>
          </div>
        ) : queueStatus === "queued" ? (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400 font-semibold">Queue Status:</span>
              <span className="text-emerald-400 font-extrabold animate-pulse">SEARCHING...</span>
            </div>
            {queuePosition !== null && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 font-semibold">Position:</span>
                <span className="text-white font-extrabold">{queuePosition}</span>
              </div>
            )}
            <button
              onClick={handleLeaveQueue}
              disabled={!isConnected}
              className="mt-1 w-full py-2 bg-rose-500/20 hover:bg-rose-500/30 active:scale-[0.98] text-rose-400 font-bold text-xs rounded-xl border border-rose-500/30 transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              Cancel Search
            </button>
          </div>
        ) : (
          <button
            onClick={handleJoinQueue}
            disabled={!isConnected}
            className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.98] text-white font-bold text-xs rounded-xl border border-emerald-400/20 shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Find a Match
          </button>
        )}
      </div>
    </div>
  );
}
