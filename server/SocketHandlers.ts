import { Server, Socket } from "socket.io";
import { RoomManager } from "./RoomManager";
import { Matchmaker } from "./Matchmaker";

export class SocketHandlers {
  private io: Server;
  private roomManager: RoomManager;
  private matchmaker: Matchmaker;

  constructor(io: Server, roomManager: RoomManager, matchmaker: Matchmaker) {
    this.io = io;
    this.roomManager = roomManager;
    this.matchmaker = matchmaker;
  }

  registerEvents(socket: Socket) {
    console.log(`Client connected: ${socket.id}`);

    // Join Queue
    socket.on("joinQueue", () => {
      const status = this.matchmaker.joinQueue(socket.id);
      if (status) {
        socket.emit("queueStatus", status);
      }
    });

    // Leave Queue
    socket.on("leaveQueue", () => {
      const left = this.matchmaker.leaveQueue(socket.id);
      if (left) {
        socket.emit("queueStatus", { status: "idle" });
      }
    });

    // Client scramble ready
    socket.on("scrambleReady", (data: { roomId: string }) => {
      console.log(`Player ${socket.id} is ready with scramble in room ${data.roomId}`);
      const room = this.roomManager.getRoom(data.roomId);
      if (room) {
        const bothReady = room.markPlayerReady(socket.id);
        if (bothReady) {
          const startTime = Date.now() + 10000;
          room.startGame(startTime);
          console.log(`Both players ready in room ${room.roomId}. Starting game at ${startTime}`);
          this.io.to(room.roomId).emit("gameStart", { startTime });
        }
      }
    });

    // Client makes move
    socket.on("move", (data: { roomId: string; move: string; seq: number }) => {
      const room = this.roomManager.getRoom(data.roomId);
      if (!room) {
        console.warn(`[Move] Room ${data.roomId} not found for move ${data.move}`);
        return;
      }

      const result = room.applyMove(socket.id, data.move, data.seq);
      if (!result.success) {
        if (result.error) {
          if (result.isOldMove) {
            console.warn(`[Move] Duplicate or old move rejected for Player ${socket.id} in Room ${data.roomId}. ${result.error}`);
          } else {
            console.warn(`[Move] Out-of-order or future move rejected for Player ${socket.id} in Room ${data.roomId}. ${result.error}`);
          }
        }
        return;
      }

      // Broadcast move to opponent
      const opponentId = room.players.find((id) => id !== socket.id);
      if (opponentId && data.move !== "DEBUG_SOLVE") {
        this.io.to(opponentId).emit("opponentMove", { move: data.move });
      }

      // If solved, emit gameFinished
      if (result.isSolved) {
        this.io.to(room.roomId).emit("gameFinished", {
          winner: socket.id,
          solveTime: result.solveTime ?? 0,
          moveCount: result.moveCount ?? 0,
          tps: result.tps ?? 0,
          disconnected: false,
          playerStats: result.playerStats
        });
      }
    });

    // Rematch request
    socket.on("requestRematch", (data: { roomId: string }) => {
      const room = this.roomManager.getRoom(data.roomId);
      if (!room) {
        console.warn(`[Rematch] Room ${data.roomId} not found for rematch request from ${socket.id}`);
        return;
      }

      const opponentId = room.players.find((id) => id !== socket.id);
      if (opponentId) {
        this.io.to(opponentId).emit("opponentRequestedRematch");
      }

      const rematchResult = room.requestRematch(socket.id);
      if (rematchResult.ready) {
        this.io.to(room.roomId).emit("rematchStart", {
          startTime: rematchResult.startTime,
          scramble: rematchResult.scramble
        });
      }
    });

    // Disconnection
    socket.on("disconnect", (reason) => {
      console.log(`Client disconnected: ${socket.id} (reason: ${reason})`);
      
      this.matchmaker.removeFromQueue(socket.id);

      const room = this.roomManager.findRoomByPlayer(socket.id);
      if (room) {
        const disconnectResult = room.handleDisconnect(socket.id);
        const opponentId = disconnectResult.opponentId;

        if (disconnectResult.wasWaiting) {
          console.log(`Player ${socket.id} disconnected before match started. Room ${room.roomId} cancelled.`);
          if (opponentId) {
            this.io.to(opponentId).emit("matchCancelled", { reason: "Opponent disconnected before start" });
          }
          this.roomManager.removeRoom(room.roomId);
        } else if (disconnectResult.wasPlaying) {
          console.log(`Player ${socket.id} disconnected while game running. Declaring Player ${opponentId} the winner.`);
          if (opponentId && disconnectResult.winnerStats) {
            this.io.to(opponentId).emit("gameFinished", {
              winner: opponentId,
              solveTime: disconnectResult.winnerStats.solveTime,
              moveCount: disconnectResult.winnerStats.moveCount,
              tps: disconnectResult.winnerStats.tps,
              disconnected: true
            });
          }
          this.roomManager.removeRoom(room.roomId);
        } else if (disconnectResult.wasFinished) {
          console.log(`Player ${socket.id} disconnected from finished room ${room.roomId}. Removing room.`);
          if (opponentId) {
            this.io.to(opponentId).emit("opponentLeftFinishedRoom");
          }
          this.roomManager.removeRoom(room.roomId);
        }
      }
    });
  }
}
