import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { SocketRegistryService } from './socket-registry.service';
import { NotificationsService } from './notifications.service';
export declare class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly jwtService;
    private readonly registry;
    private readonly notificationsService;
    server: Server;
    private readonly logger;
    constructor(jwtService: JwtService, registry: SocketRegistryService, notificationsService: NotificationsService);
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): void;
    pushToUser(userId: string, payload: any): Promise<boolean>;
    handleAcknowledge(payload: {
        id: string;
    }, client: Socket): Promise<void>;
}
