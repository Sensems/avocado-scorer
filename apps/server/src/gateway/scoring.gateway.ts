import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth/auth.service';

export const WS_EVENT_JOIN_ROOM = 'join_room';
export const WS_EVENT_SCORE_UPDATED = 'score_updated';
export const WS_EVENT_ROOM_FINISHED = 'room_finished';

export interface ScoreUpdatedPayload {
  roomId: string;
  players: Array<{ id: string; currentScore: number }>;
  lastLog: { id: string; fromPlayerId: string; toPlayerId: string; amount: number; type: string };
}

export interface RoomFinishedPayload {
  roomId: string;
  settlementUrl?: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  path: '/ws',
  namespace: '/',
})
export class ScoringGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ScoringGateway.name);
  private readonly socketToRoom = new Map<string, string>();
  private readonly socketToUserId = new Map<string, string>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  async handleConnection(
    client: {
      id: string;
      handshake: { auth?: { token?: string }; query?: Record<string, string> };
    },
  ) {
    const token =
      client.handshake?.auth?.token ?? client.handshake?.query?.token;
    if (!token) {
      this.logger.warn(`Socket ${client.id} connected without token`);
      return;
    }
    try {
      const payload = this.jwtService.verify(token);
      const user = await this.authService.validateUserById(payload.sub);
      if (!user) {
        this.logger.warn(`Socket ${client.id} invalid user`);
        return;
      }
      this.socketToUserId.set(client.id, user.id);
    } catch {
      this.logger.warn(`Socket ${client.id} invalid token`);
    }
  }

  handleDisconnect(client: { id: string }) {
    this.socketToRoom.delete(client.id);
    this.socketToUserId.delete(client.id);
  }

  @SubscribeMessage(WS_EVENT_JOIN_ROOM)
  async handleJoinRoom(
    client: { id: string; join: (room: string) => void },
    payload: { roomId: string },
  ): Promise<{ success: boolean; error?: string }> {
    const userId = this.socketToUserId.get(client.id);
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }
    if (!payload?.roomId) {
      return { success: false, error: 'roomId required' };
    }
    const roomId = String(payload.roomId);
    client.join(roomId);
    this.socketToRoom.set(client.id, roomId);
    return { success: true };
  }

  emitScoreUpdated(roomId: string, data: ScoreUpdatedPayload): void {
    this.server.to(roomId).emit(WS_EVENT_SCORE_UPDATED, data);
  }

  emitRoomFinished(roomId: string, data: RoomFinishedPayload): void {
    this.server.to(roomId).emit(WS_EVENT_ROOM_FINISHED, data);
  }
}
