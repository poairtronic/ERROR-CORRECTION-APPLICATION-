import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { SocketRegistryService } from './socket-registry.service';
import { NotificationsService } from './notifications.service';
import { NotificationStatus } from '../common/enums/report-status.enum';

import { OnEvent } from '@nestjs/event-emitter';

@WebSocketGateway({ cors: { origin: '*' } })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly registry: SocketRegistryService,
    @Inject(forwardRef(() => NotificationsService)) private readonly notificationsService: NotificationsService,
  ) {}

  @OnEvent('email.logs.updated')
  handleEmailLogsUpdated() {
    try {
      this.logger.debug('Email logs updated, broadcasting to clients...');
      if (this.server) {
        this.server.emit('email_logs_updated');
      }
    } catch (err: any) {
      this.logger.warn(`Failed to broadcast email logs update: ${err.message}`);
    }
  }

  async handleConnection(client: Socket) {
    try {
      // 1. Extract Token from handshake auth or headers
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
      
      if (!token) {
        this.logger.warn(`Connection rejected: No token provided for socket ${client.id}`);
        client.disconnect();
        return;
      }

      // 2. Validate Token
      const payload = this.jwtService.verify(token);
      
      // 3. Attach user info to socket
      client.data.user = payload;
      
      // 4. Auto-Join user-specific room safely
      client.join(payload.sub);
      
      // 5. Register connection
      this.registry.addConnection(payload.sub, payload.role, client);
      
      this.logger.log(`Client ${client.id} authenticated and joined room ${payload.sub}`);
    } catch (err) {
      this.logger.warn(`Connection rejected: Invalid token for socket ${client.id} - ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const user = client.data?.user;
    if (user) {
      this.registry.removeConnection(user.sub, client.id);
    }
  }

  // Remove the old @SubscribeMessage('join') to prevent clients from arbitrarily joining rooms!

  /**
   * Push a notification to a specific user with Acknowledgement support
   */
  async pushToUser(userId: string, payload: any) {
    if (!this.registry.isUserConnected(userId)) {
      this.logger.debug(`User ${userId} not connected, notification will remain queued`);
      return false; // Not delivered via socket right now
    }

    // Emit to room (broadcasts to all tabs of the user)
    // For ACK handling, Socket.io doesn't easily support ACKs on room broadcasts out of the box in older versions,
    // but in server.to(room).timeout(5000).emit() we can get ACKs.
    // Alternatively, emit to each specific socket ID in the registry:
    const socketIds = this.registry.getUserConnections(userId);
    let delivered = false;

    for (const socketId of socketIds) {
      const socket = this.server.sockets.sockets.get(socketId);
      if (socket) {
        // Use standard emit with callback if single socket, or just rely on the room.
        // For Step 8: Acknowledgement, we will emit and wait for a response.
        socket.emit('notification', payload, async (ack: any) => {
          try {
            if (ack && ack.received) {
              this.logger.log(`Notification ${payload.id || 'N/A'} acknowledged by socket ${socketId}`);
              // Log delivery status in DB (Step 8)
              if (payload.id) {
                await this.notificationsService.markDelivered(payload.id);
              }
            }
          } catch (error) {
            this.logger.error(`Failed to handle socket acknowledgement for user ${userId}: ${error.message}`, error.stack);
          }
        });
        delivered = true;
      }
    }
    
    return delivered;
  }

  // Allow client to manually acknowledge if they prefer a standard event
  @SubscribeMessage('acknowledge_notification')
  async handleAcknowledge(@MessageBody() payload: { id: string }, @ConnectedSocket() client: Socket) {
    try {
      if (!client.data.user) return;
      await this.notificationsService.markDelivered(payload.id);
      this.logger.log(`Notification ${payload.id} manually acknowledged by ${client.data.user.sub}`);
    } catch (err: any) {
      this.logger.error(`Failed handling manual notification acknowledgement: ${err.message}`, err.stack);
    }
  }
}
