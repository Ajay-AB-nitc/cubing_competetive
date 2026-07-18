import { GameRoom } from "./GameRoom";

export class RoomManager {
  private rooms = new Map<string, GameRoom>();

  createRoom(roomId: string, player1Id: string, player2Id: string): GameRoom {
    const room = new GameRoom(roomId, player1Id, player2Id);
    this.rooms.set(roomId, room);
    console.log(`[RoomManager] Room ${roomId} created at ${room.createdAt.toISOString()}`);
    return room;
  }

  getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  removeRoom(roomId: string): boolean {
    const deleted = this.rooms.delete(roomId);
    if (deleted) {
      console.log(`[RoomManager] Room ${roomId} removed`);
    }
    return deleted;
  }

  findRoomByPlayer(playerId: string): GameRoom | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.includes(playerId)) {
        return room;
      }
    }
    return undefined;
  }
}
