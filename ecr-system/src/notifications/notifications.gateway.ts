import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

// Users join a room keyed by their userId after login; server pushes to that room.
// Kept minimal for Phase 1 - JWT verification on socket handshake to be added in Phase 2.
@WebSocketGateway({ cors: { origin: '*' } })
export class NotificationsGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('join')
  handleJoin(@MessageBody() userId: string, @ConnectedSocket() client: Socket) {
    client.join(userId);
  }

  pushToUser(userId: string, payload: any) {
    this.server.to(userId).emit('notification', payload);
  }
}
