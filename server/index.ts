import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { Cube } from "./shared/cube";

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

// Room interface definition
interface Room {
  roomId: string;
  players: string[];
  createdAt: Date;
  status: "waiting";
  scramble: {
    corners: number[];
    cornerOrientation: number[];
    edges: number[];
    edgeOrientation: number[];
  };
  readyPlayers: string[];
}

// In-memory RoomManager
class RoomManager {
  private rooms = new Map<string, Room>();

  createRoom(roomId: string, player1Id: string, player2Id: string): Room {
    const cube = Cube.random();
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
        console.log(`Both players ready in room ${room.roomId}. Starting game at ${startTime}`);
        io.to(room.roomId).emit("gameStart", { startTime });
      }
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

    // Clean up room if player was in a room
    const room = roomManager.findRoomByPlayer(socket.id);
    if (room) {
      console.log(`Player ${socket.id} disconnected from room ${room.roomId}. Removing room.`);
      roomManager.removeRoom(room.roomId);
    }
  });
});

// Start the server using httpServer
httpServer.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

