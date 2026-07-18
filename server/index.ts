import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { Cube } from "./shared/cube";
import { RoomManager } from "./RoomManager";
import { Matchmaker } from "./Matchmaker";
import { SocketHandlers } from "./SocketHandlers";

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

const roomManager = new RoomManager();
const matchmaker = new Matchmaker(io, roomManager);
const socketHandlers = new SocketHandlers(io, roomManager, matchmaker);

// Connection handler
io.on("connection", (socket) => {
  socketHandlers.registerEvents(socket);
});

// Start the server using httpServer
httpServer.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
