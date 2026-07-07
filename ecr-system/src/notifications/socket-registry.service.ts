import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';

export interface ConnectedUser {
  socketId: string;
  userId: string;
  role: string;
  connectedAt: Date;
}

@Injectable()
export class SocketRegistryService {
  private readonly logger = new Logger(SocketRegistryService.name);
  
  // Map<userId, Map<socketId, ConnectedUser>> to support multiple tabs per user
  private readonly connections = new Map<string, Map<string, ConnectedUser>>();

  addConnection(userId: string, role: string, client: Socket) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Map());
    }
    
    const userConnections = this.connections.get(userId);
    if (userConnections && !userConnections.has(client.id)) {
      userConnections.set(client.id, {
        socketId: client.id,
        userId,
        role,
        connectedAt: new Date(),
      });
      this.logger.log(`User ${userId} (${role}) connected with socket ${client.id}`);
    }
  }

  removeConnection(userId: string, socketId: string) {
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      userConnections.delete(socketId);
      this.logger.log(`User ${userId} disconnected socket ${socketId}`);
      
      if (userConnections.size === 0) {
        this.connections.delete(userId);
        this.logger.log(`User ${userId} has no more active connections`);
      }
    }
  }

  getUserConnections(userId: string): string[] {
    const userConnections = this.connections.get(userId);
    if (!userConnections) return [];
    return Array.from(userConnections.keys());
  }

  isUserConnected(userId: string): boolean {
    const userConnections = this.connections.get(userId);
    return !!(userConnections && userConnections.size > 0);
  }
}
