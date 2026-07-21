"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Cube } from "@/lib/shared";
import { socket } from "@/components/SocketStatus";

export function useGameLogic() {
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
  const [playerStats, setPlayerStats] = useState<{ moveCount: number; tps: number } | null>(null);
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
    function onGameFinished(data: {
      winner: string;
      solveTime: number;
      moveCount?: number;
      tps?: number;
      disconnected?: boolean;
      playerStats?: Record<string, { solveTime: number; moveCount: number; tps: number }>;
    }) {
      console.log("[Event: gameFinished] Match finished. Winner:", data.winner, "Data:", data);
      setWinner(data.winner);
      setTimerRunning(false);

      let mySolveTime = data.solveTime;
      let myMoveCount = data.moveCount;
      let myTps = data.tps;

      if (data.playerStats && socket.id && data.playerStats[socket.id]) {
        const myData = data.playerStats[socket.id];
        mySolveTime = myData.solveTime;
        myMoveCount = myData.moveCount;
        myTps = myData.tps;
      }

      setFinalSolveTime(mySolveTime);

      if (myMoveCount !== undefined && myTps !== undefined) {
        setPlayerStats({ moveCount: myMoveCount, tps: myTps });
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
        setElapsedWhenStopped(mySolveTime);
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
      setPlayerStats(null);
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

  const leaveMatch = () => {
    sessionStorage.removeItem("currentMatch");
    router.push("/");
  };

  return {
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
    winnerStats: playerStats,
    rematchRequested,
    opponentRematchRequested,
    opponentLeft,
    handleMove,
    handleRequestRematch,
    leaveMatch,
  };
}
