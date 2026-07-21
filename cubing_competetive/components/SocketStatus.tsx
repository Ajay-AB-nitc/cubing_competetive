"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useRouter } from "next/navigation";

const SOCKET_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

// Create a singleton socket instance for client-side reuse
export const socket = io(SOCKET_URL, {
  autoConnect: false,
});

if (typeof window !== "undefined") {
  (window as any).socket = socket;
}

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
    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-zinc-900/80 backdrop-blur-md border border-zinc-800 shadow-xl w-60 transition-all duration-300">
      {/* Connection Status Header */}
      <div className="flex items-center justify-between gap-6 border-b border-zinc-800 pb-2">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Server</span>
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
          <div className="flex flex-col gap-2 bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 font-medium">Match Status</span>
              <span className="text-emerald-400 font-bold tracking-wide uppercase">READY</span>
            </div>
            <div className="flex flex-col gap-1 mt-1">
              <span className="text-[10px] uppercase font-bold text-zinc-500">Room ID</span>
              <span className="font-mono text-xs text-zinc-200 bg-zinc-950/60 px-2 py-1 rounded border border-zinc-800 truncate select-all" title={matchedRoomId}>
                {matchedRoomId}
              </span>
            </div>
            <button
              onClick={handleJoinQueue}
              className="mt-2 w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-lg transition-all duration-150 cursor-pointer"
            >
              Find Another Match
            </button>
          </div>
        ) : queueStatus === "queued" ? (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 font-medium">Queue Status</span>
              <span className="text-emerald-400 font-bold tracking-wide uppercase">Searching...</span>
            </div>
            {queuePosition !== null && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400 font-medium">Position</span>
                <span className="text-zinc-200 font-bold">{queuePosition}</span>
              </div>
            )}
            <button
              onClick={handleLeaveQueue}
              disabled={!isConnected}
              className="mt-1 w-full py-2 bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-rose-400 font-semibold text-xs rounded-lg border border-zinc-700 transition-all duration-150 cursor-pointer disabled:opacity-50"
            >
              Cancel Search
            </button>
          </div>
        ) : (
          <button
            onClick={handleJoinQueue}
            disabled={!isConnected}
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-zinc-950 font-bold text-xs rounded-xl transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Find Match
          </button>
        )}
      </div>
    </div>
  );
}
