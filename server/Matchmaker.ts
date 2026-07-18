import { Server } from "socket.io";
import { RoomManager } from "./RoomManager";

export class Matchmaker {
  private queue: string[] = [];
  private io: Server;
  private roomManager: RoomManager;

  constructor(io: Server, roomManager: RoomManager) {
    this.io = io;
    this.roomManager = roomManager;
  }

  joinQueue(playerId: string): { status: "queued"; position: number } | null {
    if (!this.queue.includes(playerId)) {
      this.queue.push(playerId);
      console.log(`Player ${playerId} joined the queue. Queue size: ${this.queue.length}`);
      this.checkAndMatchPlayers();
      return { status: "queued", position: this.queue.length };
    }
    console.log(`Player ${playerId} tried to join but is already in the queue.`);
    return null;
  }

  leaveQueue(playerId: string): boolean {
    const index = this.queue.indexOf(playerId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      console.log(`Player ${playerId} left the queue. Queue size: ${this.queue.length}`);
      return true;
    }
    return false;
  }

  removeFromQueue(playerId: string) {
    const index = this.queue.indexOf(playerId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      console.log(`Player ${playerId} removed from queue. Queue size: ${this.queue.length}`);
    }
  }

  private checkAndMatchPlayers() {
    while (this.queue.length >= 2) {
      const player1Id = this.queue.shift();
      const player2Id = this.queue.shift();

      if (player1Id && player2Id) {
        const socket1 = this.io.sockets.sockets.get(player1Id);
        const socket2 = this.io.sockets.sockets.get(player2Id);

        if (socket1 && socket2) {
          const roomId = `room-${Math.random().toString(36).substring(2, 11)}`;
          const room = this.roomManager.createRoom(roomId, player1Id, player2Id);

          socket1.join(roomId);
          socket2.join(roomId);

          console.log(`Match found! Created room ${roomId} for players ${player1Id} and ${player2Id}`);

          this.io.to(roomId).emit("matchFound", {
            roomId,
            scramble: room.scramble,
          });
        } else {
          // Put back valid sockets
          if (socket1) {
            this.queue.unshift(player1Id);
          }
          if (socket2) {
            this.queue.unshift(player2Id);
          }
          break;
        }
      }
    }
  }
}
