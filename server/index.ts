import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { Cube } from "./shared/cube";
import type { FaceMove } from "./shared/cubeTypes";

const app = express();
const port = 3001;

// CORS Middleware
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

// Health check endpoint
app.get("/health", (req: express.Request, res: express.Response) => {
  res.json({ status: "OK" });
});

app.get("/", (req: express.Request, res: express.Response) => {
  const cube = Cube.solved();
  res.json({
    message: "Hello from the cubing backend!",
    cubeSolved: cube.isSolved(),
  });
});

app.get("/random", (req: express.Request, res: express.Response) => {
  const cube = Cube.random();
  res.json({
    corners: cube.corners,
    cornerOrientation: cube.cornerOrientation,
    edges: cube.edges,
    edgeOrientation: cube.edgeOrientation,
    isValid: cube.isValid()
  });
});

// Create HTTP server and bind Express
const httpServer = createServer(app);

// Initialize Socket.IO server with CORS enabled
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

interface PlayerStats {
  moveCount: number;
  startTime?: number;
  endTime?: number;
}

// Room interface definition
interface Room {
  roomId: string;
  players: string[];
  createdAt: Date;
  status: "waiting" | "playing" | "finished";
  scramble: {
    corners: number[];
    cornerOrientation: number[];
    edges: number[];
    edgeOrientation: number[];
  };
  readyPlayers: string[];
  cubes: Record<string, Cube>;
  expectedSeq: Record<string, number>;
  gameStartTime?: number;
  playerStats: Record<string, PlayerStats>;
  rematchRequests: string[];
}

// In-memory RoomManager
class RoomManager {
  private rooms = new Map<string, Room>();

  createRoom(roomId: string, player1Id: string, player2Id: string): Room {
    const cube = Cube.random();
    
    // Create distinct Cube instances for each player initialized from the same scramble
    const player1Cube = new Cube(
      [...cube.corners],
      [...cube.cornerOrientation],
      [...cube.edges],
      [...cube.edgeOrientation]
    );
    
    const player2Cube = new Cube(
      [...cube.corners],
      [...cube.cornerOrientation],
      [...cube.edges],
      [...cube.edgeOrientation]
    );

    const room: Room = {
      roomId,
      players: [player1Id, player2Id],
      createdAt: new Date(),
      status: "waiting",
      scramble: {
        corners: [...cube.corners],
        cornerOrientation: [...cube.cornerOrientation],
        edges: [...cube.edges],
        edgeOrientation: [...cube.edgeOrientation],
      },
      readyPlayers: [],
      cubes: {
        [player1Id]: player1Cube,
        [player2Id]: player2Cube,
      },
      expectedSeq: {
        [player1Id]: 0,
        [player2Id]: 0,
      },
      playerStats: {
        [player1Id]: { moveCount: 0 },
        [player2Id]: { moveCount: 0 },
      },
      rematchRequests: [],
    };
    this.rooms.set(roomId, room);
    console.log(`[RoomManager] Room ${roomId} created at ${room.createdAt.toISOString()} with random scramble`);
    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  removeRoom(roomId: string): boolean {
    const deleted = this.rooms.delete(roomId);
    if (deleted) {
      console.log(`[RoomManager] Room ${roomId} removed`);
    }
    return deleted;
  }

  findRoomByPlayer(playerId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.includes(playerId)) {
        return room;
      }
    }
    return undefined;
  }
}

const roomManager = new RoomManager();

// Matchmaking queue storing socket IDs
const matchmakingQueue: string[] = [];

// Matchmaking helper to pair players
function checkAndMatchPlayers() {
  while (matchmakingQueue.length >= 2) {
    const player1Id = matchmakingQueue.shift();
    const player2Id = matchmakingQueue.shift();

    if (player1Id && player2Id) {
      const socket1 = io.sockets.sockets.get(player1Id);
      const socket2 = io.sockets.sockets.get(player2Id);

      if (socket1 && socket2) {
        // Generate a unique room ID
        const roomId = `room-${Math.random().toString(36).substring(2, 11)}`;

        // Register the room in the RoomManager
        const room = roomManager.createRoom(roomId, player1Id, player2Id);

        // Join both sockets to that room
        socket1.join(roomId);
        socket2.join(roomId);

        console.log(`Match found! Created room ${roomId} for players ${player1Id} and ${player2Id}`);

        // Emit matchFound to both players containing the room ID and the scramble
        io.to(roomId).emit("matchFound", {
          roomId,
          scramble: room.scramble,
        });
      } else {
        // Put back any valid socket to the queue if the other disconnected
        if (socket1) {
          matchmakingQueue.unshift(player1Id);
        }
        if (socket2) {
          matchmakingQueue.unshift(player2Id);
        }
        break; // Break loop if we couldn't match due to disconnected socket to avoid loops
      }
    }
  }
}

// Connection handler
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Handle joining the matchmaking queue
  socket.on("joinQueue", () => {
    if (!matchmakingQueue.includes(socket.id)) {
      matchmakingQueue.push(socket.id);
      console.log(`Player ${socket.id} joined the queue. Queue size: ${matchmakingQueue.length}`);
      socket.emit("queueStatus", { status: "queued", position: matchmakingQueue.length });

      // Check and match players
      checkAndMatchPlayers();
    } else {
      console.log(`Player ${socket.id} tried to join but is already in the queue.`);
    }
  });

  // Handle leaving the matchmaking queue
  socket.on("leaveQueue", () => {
    const index = matchmakingQueue.indexOf(socket.id);
    if (index !== -1) {
      matchmakingQueue.splice(index, 1);
      console.log(`Player ${socket.id} left the queue. Queue size: ${matchmakingQueue.length}`);
      socket.emit("queueStatus", { status: "idle" });
    }
  });

  // Handle client confirming scramble is applied
  socket.on("scrambleReady", (data: { roomId: string }) => {
    console.log(`Player ${socket.id} is ready with scramble in room ${data.roomId}`);
    const room = roomManager.getRoom(data.roomId);
    if (room) {
      if (!room.readyPlayers.includes(socket.id)) {
        room.readyPlayers.push(socket.id);
      }

      // Check if both players are ready
      if (room.readyPlayers.length === 2) {
        const startTime = Date.now() + 10000;
        room.status = "playing";
        room.gameStartTime = startTime;
        const p1 = room.players[0];
        const p2 = room.players[1];
        if (p1 && room.playerStats[p1]) room.playerStats[p1]!.startTime = startTime;
        if (p2 && room.playerStats[p2]) room.playerStats[p2]!.startTime = startTime;
        console.log(`Both players ready in room ${room.roomId}. Starting game at ${startTime}`);
        io.to(room.roomId).emit("gameStart", { startTime });
      }
    }
  });

  // Handle client sending a move
  socket.on("move", (data: { roomId: string; move: string; seq: number }) => {
    const room = roomManager.getRoom(data.roomId);
    if (!room) {
      console.warn(`[Move] Room ${data.roomId} not found for move ${data.move}`);
      return;
    }

    if (room.status === "finished") {
      console.log(`[Move] Room ${data.roomId} is already finished. Ignoring move from ${socket.id}`);
      return;
    }

    const expected = room.expectedSeq[socket.id];
    if (expected === undefined) {
      console.warn(`[Move] Player ${socket.id} not found in room ${data.roomId}`);
      return;
    }

    if (data.seq !== expected) {
      if (data.seq < expected) {
        console.warn(`[Move] Duplicate or old move rejected for Player ${socket.id} in Room ${data.roomId}. Expected ${expected}, got ${data.seq}`);
      } else {
        console.warn(`[Move] Out-of-order or future move rejected for Player ${socket.id} in Room ${data.roomId}. Expected ${expected}, got ${data.seq}`);
      }
      return;
    }

    const playerCube = room.cubes[socket.id];
    if (playerCube) {
      if (data.move === "DEBUG_SOLVE") {
        playerCube.corners = [0, 1, 2, 3, 4, 5, 6, 7];
        playerCube.cornerOrientation = [0, 0, 0, 0, 0, 0, 0, 0];
        playerCube.edges = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        playerCube.edgeOrientation = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        
        room.expectedSeq[socket.id] = expected + 1;
        const stats = room.playerStats[socket.id];
        if (stats) {
          stats.moveCount++;
        }
        
        room.status = "finished";
        const endTime = Date.now();
        if (stats) {
          stats.endTime = endTime;
          const startTime = stats.startTime || room.gameStartTime || Date.now();
          const solveTime = endTime - startTime;
          const tps = solveTime > 0 ? (stats.moveCount / (solveTime / 1000)) : 0;
          
          console.log(`[Move] DEBUG_SOLVE received for Player ${socket.id} in room ${data.roomId}. Solve time: ${solveTime}ms`);
          io.to(room.roomId).emit("gameFinished", {
            winner: socket.id,
            solveTime,
            moveCount: stats.moveCount,
            tps,
            disconnected: false
          });
        }
        return;
      }

      const isReverse = data.move.endsWith("'");
      const physicalMove = (isReverse ? data.move.slice(0, -1) : data.move) as FaceMove;

      const VALID_FACES = ["U", "D", "R", "L", "F", "B"];
      if (VALID_FACES.includes(physicalMove)) {
        if (isReverse) {
          playerCube.applyMove(physicalMove);
          playerCube.applyMove(physicalMove);
          playerCube.applyMove(physicalMove);
        } else {
          playerCube.applyMove(physicalMove);
        }
        room.expectedSeq[socket.id] = expected + 1;
        
        // Track stats
        const stats = room.playerStats[socket.id];
        if (stats) {
          stats.moveCount++;
        }
        
        const isSolved = playerCube.isSolved();
        console.log(`[Move] Applied move ${data.move} for Player ${socket.id} in room ${data.roomId} (expected seq: ${room.expectedSeq[socket.id]}, solved: ${isSolved})`);
        
        // Broadcast the move to the opponent
        const opponentId = room.players.find((id) => id !== socket.id);
        if (opponentId) {
          io.to(opponentId).emit("opponentMove", { move: data.move });
        }

        if (isSolved) {
          room.status = "finished";
          const endTime = Date.now();
          if (stats) {
            stats.endTime = endTime;
            const startTime = stats.startTime || room.gameStartTime || Date.now();
            const solveTime = endTime - startTime;
            const tps = solveTime > 0 ? (stats.moveCount / (solveTime / 1000)) : 0;
            
            console.log(`[Move] Player ${socket.id} solved the cube! Room ${data.roomId} finished. Solve time: ${solveTime}ms, Moves: ${stats.moveCount}, TPS: ${tps.toFixed(2)}`);
            io.to(room.roomId).emit("gameFinished", {
              winner: socket.id,
              solveTime,
              moveCount: stats.moveCount,
              tps,
              disconnected: false
            });
          } else {
            const startTime = room.gameStartTime || Date.now();
            const solveTime = endTime - startTime;
            io.to(room.roomId).emit("gameFinished", {
              winner: socket.id,
              solveTime,
              moveCount: 0,
              tps: 0,
              disconnected: false
            });
          }
        }
      } else {
        console.warn(`[Move] Invalid FaceMove parsed: ${physicalMove}`);
      }
    }
  });

  // Handle rematch request
  socket.on("requestRematch", (data: { roomId: string }) => {
    const room = roomManager.getRoom(data.roomId);
    if (!room) {
      console.warn(`[Rematch] Room ${data.roomId} not found for rematch request from ${socket.id}`);
      return;
    }
    if (room.status !== "finished") {
      console.warn(`[Rematch] Room ${data.roomId} status is ${room.status}, not finished. Ignoring request from ${socket.id}`);
      return;
    }
    if (!room.rematchRequests.includes(socket.id)) {
      room.rematchRequests.push(socket.id);
    }
    console.log(`[Rematch] Player ${socket.id} requested rematch in room ${room.roomId}. Total requests: ${room.rematchRequests.length}`);
    
    const opponentId = room.players.find((id) => id !== socket.id);
    if (opponentId) {
      io.to(opponentId).emit("opponentRequestedRematch");
    }
    
    if (room.rematchRequests.length === 2) {
      // Clear rematch requests
      room.rematchRequests = [];
      
      // Generate a new random scramble
      const newCube = Cube.random();
      
      const p1 = room.players[0];
      const p2 = room.players[1];
      const startTime = Date.now() + 10000;

      if (p1 && p2) {
        // Re-initialize both player cubes from the new scramble
        room.cubes[p1] = new Cube(
          [...newCube.corners],
          [...newCube.cornerOrientation],
          [...newCube.edges],
          [...newCube.edgeOrientation]
        );
        room.cubes[p2] = new Cube(
          [...newCube.corners],
          [...newCube.cornerOrientation],
          [...newCube.edges],
          [...newCube.edgeOrientation]
        );
        
        // Reset expected sequence numbers and stats
        room.expectedSeq[p1] = 0;
        room.expectedSeq[p2] = 0;
        
        room.playerStats[p1] = { moveCount: 0, startTime };
        room.playerStats[p2] = { moveCount: 0, startTime };
      }
      
      // Reset status and start the countdown
      room.status = "playing";
      room.gameStartTime = startTime;
      
      // Set new scramble
      room.scramble = {
        corners: [...newCube.corners],
        cornerOrientation: [...newCube.cornerOrientation],
        edges: [...newCube.edges],
        edgeOrientation: [...newCube.edgeOrientation],
      };
      
      console.log(`[Rematch] Both agreed. Starting new match in room ${room.roomId} at ${startTime}`);
      io.to(room.roomId).emit("rematchStart", {
        startTime,
        scramble: room.scramble,
      });
    }
  });

  // Handle disconnection
  socket.on("disconnect", (reason) => {
    console.log(`Client disconnected: ${socket.id} (reason: ${reason})`);
    
    // Remove player from queue if present
    const index = matchmakingQueue.indexOf(socket.id);
    if (index !== -1) {
      matchmakingQueue.splice(index, 1);
      console.log(`Player ${socket.id} removed from queue due to disconnect. Queue size: ${matchmakingQueue.length}`);
    }
    const room = roomManager.findRoomByPlayer(socket.id);
    if (room) {
      const opponentId = room.players.find((id) => id !== socket.id);
      
      if (room.status === "waiting") {
        console.log(`Player ${socket.id} disconnected before match started. Room ${room.roomId} cancelled.`);
        if (opponentId) {
          io.to(opponentId).emit("matchCancelled", { reason: "Opponent disconnected before start" });
        }
        roomManager.removeRoom(room.roomId);
      } else if (room.status === "playing") {
        console.log(`Player ${socket.id} disconnected while game running. Declaring Player ${opponentId} the winner.`);
        room.status = "finished";
        if (opponentId) {
          const stats = room.playerStats[opponentId];
          if (stats) {
            const endTime = Date.now();
            stats.endTime = endTime;
            const startTime = stats.startTime || room.gameStartTime || Date.now();
            const solveTime = Math.max(0, endTime - startTime);
            const tps = solveTime > 0 ? (stats.moveCount / (solveTime / 1000)) : 0;
            
            io.to(opponentId).emit("gameFinished", {
              winner: opponentId,
              solveTime,
              moveCount: stats.moveCount,
              tps,
              disconnected: true
            });
          } else {
            io.to(opponentId).emit("gameFinished", {
              winner: opponentId,
              solveTime: 0,
              moveCount: 0,
              tps: 0,
              disconnected: true
            });
          }
        }
        roomManager.removeRoom(room.roomId);
      } else {
        console.log(`Player ${socket.id} disconnected from finished room ${room.roomId}. Removing room.`);
        if (opponentId) {
          io.to(opponentId).emit("opponentLeftFinishedRoom");
        }
        roomManager.removeRoom(room.roomId);
      }
    }
  });
});

// Start the server using httpServer
httpServer.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

