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
import { Logger, Inject, forwardRef, OnApplicationShutdown } from '@nestjs/common';
import { SocketRegistryService } from './socket-registry.service';
import { NotificationsService } from './notifications.service';
import { NotificationStatus } from '../common/enums/report-status.enum';
import { OnEvent } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { runWithTraceContext } from '../common/trace-context';
import { MonitoringService } from '../monitoring/monitoring.service';

@WebSocketGateway({ cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173' } })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnApplicationShutdown {
  @WebSocketServer()
  server: Server;
  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly registry: SocketRegistryService,
    @Inject(forwardRef(() => NotificationsService)) private readonly notificationsService: NotificationsService,
    private readonly monitoringService: MonitoringService,
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
    const traceCtx = {
      correlationId: `ws-conn-${client.id}`,
      requestId: crypto.randomUUID(),
      req: {
        url: `/socket.io/?sid=${client.id}`,
        method: 'WS_CONNECT',
        user: undefined as { id: string; role: string } | undefined,
      },
    };

    return runWithTraceContext(traceCtx, async () => {
      try {
        let token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];

        if (!token) {
          const cookie = client.handshake.headers?.cookie || '';
          const match = cookie.match(/(?:^|;\s*)token=([^;]*)/);
          token = match ? match[1] : null;
        }

        if (!token) {
          this.logger.warn(`Connection rejected: No token provided for socket ${client.id}`);
          client.disconnect();
          return;
        }

        const payload = this.jwtService.verify(token);

        client.data.user = payload;
        traceCtx.req.user = { id: payload.sub, role: payload.role };

        client.join(payload.sub);

        this.registry.addConnection(payload.sub, payload.role, client);

        this.logger.log(`Client ${client.id} authenticated and joined room ${payload.sub}`);
      } catch (err: any) {
        this.logger.warn(`Connection rejected: Invalid token for socket ${client.id} - ${err.message}`);
        client.disconnect();
      }
    });
  }

  handleDisconnect(client: Socket) {
    const user = client.data?.user;
    const traceCtx = {
      correlationId: `ws-disc-${client.id}`,
      requestId: crypto.randomUUID(),
      req: {
        url: `/socket.io/?sid=${client.id}`,
        method: 'WS_DISCONNECT',
        user: user ? { id: user.sub, role: user.role } : undefined,
      },
    };

    runWithTraceContext(traceCtx, () => {
      if (user) {
        this.registry.removeConnection(user.sub, client.id);
      }
    });
  }

  onApplicationShutdown(signal?: string) {
    this.logger.log(`Received shutdown signal (${signal}). Draining and closing Socket.IO connections...`);
    if (this.server) {
      this.server.close();
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

    const socketIds = this.registry.getUserConnections(userId);
    let delivered = false;

    for (const socketId of socketIds) {
      const socket = this.server.sockets.sockets.get(socketId);
      if (socket) {
        const pushStart = Date.now();
        socket.emit('notification', payload, async (ack: any) => {
          const latency = Date.now() - pushStart;
          this.monitoringService.recordNotificationLatency(latency);

          // Threshold Warning (TASK 6 - Slow Operation Detection)
          const slowNotifThreshold = Number(process.env.SLOW_NOTIFICATION_THRESHOLD_MS) || 1000;
          if (latency > slowNotifThreshold) {
            this.logger.warn(`[SLOW_OPERATION] Slow websocket notification delivery detected (${latency}ms) for user ${userId}`);
          }

          try {
            if (ack && ack.received) {
              this.logger.log(`Notification ${payload.id || 'N/A'} acknowledged by socket ${socketId}`);
              // Log delivery status in DB (Step 8)
              if (payload.id) {
                await this.notificationsService.markDelivered(payload.id);
              }
            }
          } catch (error: any) {
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
    const user = client.data.user;
    const traceCtx = {
      correlationId: `ws-ack-${payload.id}`,
      requestId: crypto.randomUUID(),
      req: {
        url: `/socket.io/acknowledge_notification`,
        method: 'WS_ACK',
        user: user ? { id: user.sub, role: user.role } : undefined,
      },
    };

    return runWithTraceContext(traceCtx, async () => {
      try {
        if (!client.data.user) return;
        await this.notificationsService.markDelivered(payload.id);
        this.logger.log(`Notification ${payload.id} manually acknowledged by ${client.data.user.sub}`);
      } catch (err: any) {
        this.logger.error(`Failed handling manual notification acknowledgement: ${err.message}`, err.stack);
      }
    });
  }
}

