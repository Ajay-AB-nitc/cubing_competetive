import { Cube } from "./shared/cube";
import { GameState } from "./GameState";
import type { FaceMove } from "./shared/cubeTypes";

export class GameRoom {
  roomId: string;
  players: string[];
  createdAt: Date = new Date();
  status: "waiting" | "playing" | "finished" = "waiting";
  scramble: {
    corners: number[];
    cornerOrientation: number[];
    edges: number[];
    edgeOrientation: number[];
  };
  readyPlayers: string[] = [];
  playerStates = new Map<string, GameState>();
  gameStartTime?: number;
  rematchRequests: string[] = [];

  constructor(roomId: string, player1Id: string, player2Id: string) {
    this.roomId = roomId;
    this.players = [player1Id, player2Id];
    
    const initialCube = Cube.random();
    this.scramble = {
      corners: [...initialCube.corners],
      cornerOrientation: [...initialCube.cornerOrientation],
      edges: [...initialCube.edges],
      edgeOrientation: [...initialCube.edgeOrientation]
    };

    this.playerStates.set(player1Id, new GameState(initialCube));
    this.playerStates.set(player2Id, new GameState(initialCube));
  }

  markPlayerReady(playerId: string): boolean {
    if (!this.readyPlayers.includes(playerId)) {
      this.readyPlayers.push(playerId);
    }
    return this.readyPlayers.length === 2;
  }

  startGame(startTime: number) {
    this.status = "playing";
    this.gameStartTime = startTime;
    for (const playerState of this.playerStates.values()) {
      playerState.stats.startTime = startTime;
    }
  }

  applyMove(playerId: string, move: string, seq: number): {
    success: boolean;
    isSolved?: boolean | undefined;
    moveCount?: number | undefined;
    tps?: number | undefined;
    solveTime?: number | undefined;
    error?: string | undefined;
    isOldMove?: boolean | undefined;
  } {
    if (this.status === "finished") {
      return { success: false, error: "Room already finished" };
    }

    const state = this.playerStates.get(playerId);
    if (!state) {
      return { success: false, error: "Player not found in room" };
    }

    const expected = state.expectedSeq;
    if (seq !== expected) {
      return {
        success: false,
        isOldMove: seq < expected,
        error: `Expected sequence ${expected}, got ${seq}`
      };
    }

    if (move === "DEBUG_SOLVE") {
      state.cube.corners = [0, 1, 2, 3, 4, 5, 6, 7];
      state.cube.cornerOrientation = [0, 0, 0, 0, 0, 0, 0, 0];
      state.cube.edges = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      state.cube.edgeOrientation = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      
      state.expectedSeq = expected + 1;
      state.stats.moveCount++;
      
      this.status = "finished";
      const endTime = Date.now();
      state.stats.endTime = endTime;
      const startTime = state.stats.startTime || this.gameStartTime || Date.now();
      const solveTime = endTime - startTime;
      const tps = solveTime > 0 ? (state.stats.moveCount / (solveTime / 1000)) : 0;

      return {
        success: true,
        isSolved: true,
        moveCount: state.stats.moveCount,
        tps,
        solveTime
      };
    }

    const isReverse = move.endsWith("'");
    const physicalMove = (isReverse ? move.slice(0, -1) : move) as FaceMove;
    const VALID_FACES = ["U", "D", "R", "L", "F", "B"];

    if (!VALID_FACES.includes(physicalMove)) {
      return { success: false, error: `Invalid FaceMove: ${physicalMove}` };
    }

    if (isReverse) {
      state.cube.applyMove(physicalMove);
      state.cube.applyMove(physicalMove);
      state.cube.applyMove(physicalMove);
    } else {
      state.cube.applyMove(physicalMove);
    }

    state.expectedSeq = expected + 1;
    state.stats.moveCount++;

    const isSolved = state.cube.isSolved();
    if (isSolved) {
      this.status = "finished";
      const endTime = Date.now();
      state.stats.endTime = endTime;
      const startTime = state.stats.startTime || this.gameStartTime || Date.now();
      const solveTime = endTime - startTime;
      const tps = solveTime > 0 ? (state.stats.moveCount / (solveTime / 1000)) : 0;

      return {
        success: true,
        isSolved: true,
        moveCount: state.stats.moveCount,
        tps,
        solveTime
      };
    }

    return {
      success: true,
      isSolved: false,
      moveCount: state.stats.moveCount
    };
  }

  requestRematch(playerId: string): {
    ready: boolean;
    startTime?: number | undefined;
    scramble?: any | undefined;
  } {
    if (this.status !== "finished") {
      return { ready: false };
    }

    if (!this.rematchRequests.includes(playerId)) {
      this.rematchRequests.push(playerId);
    }

    if (this.rematchRequests.length === 2) {
      this.rematchRequests = [];
      const newCube = Cube.random();
      const startTime = Date.now() + 10000;

      this.scramble = {
        corners: [...newCube.corners],
        cornerOrientation: [...newCube.cornerOrientation],
        edges: [...newCube.edges],
        edgeOrientation: [...newCube.edgeOrientation]
      };

      for (const state of this.playerStates.values()) {
        state.reset(newCube, startTime);
      }

      this.status = "playing";
      this.gameStartTime = startTime;

      return {
        ready: true,
        startTime,
        scramble: this.scramble
      };
    }

    return { ready: false };
  }

  handleDisconnect(playerId: string): {
    wasWaiting: boolean;
    wasPlaying: boolean;
    wasFinished: boolean;
    opponentId?: string | undefined;
    winnerStats?: {
      solveTime: number;
      moveCount: number;
      tps: number;
    } | undefined;
  } {
    const opponentId = this.players.find(id => id !== playerId);

    if (this.status === "waiting") {
      return { wasWaiting: true, wasPlaying: false, wasFinished: false, opponentId };
    }

    if (this.status === "playing") {
      this.status = "finished";
      let winnerStats;
      if (opponentId) {
        const state = this.playerStates.get(opponentId);
        if (state) {
          const endTime = Date.now();
          state.stats.endTime = endTime;
          const startTime = state.stats.startTime || this.gameStartTime || Date.now();
          const solveTime = Math.max(0, endTime - startTime);
          const tps = solveTime > 0 ? (state.stats.moveCount / (solveTime / 1000)) : 0;
          winnerStats = {
            solveTime,
            moveCount: state.stats.moveCount,
            tps
          };
        }
      }
      return {
        wasWaiting: false,
        wasPlaying: true,
        wasFinished: false,
        opponentId,
        winnerStats
      };
    }

    return { wasWaiting: false, wasPlaying: false, wasFinished: true, opponentId };
  }
}
