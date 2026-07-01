import { Server, Socket } from 'socket.io';
export declare class NotificationsGateway {
    server: Server;
    handleJoin(userId: string, client: Socket): void;
    pushToUser(userId: string, payload: any): void;
}
