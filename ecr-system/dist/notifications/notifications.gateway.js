"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var NotificationsGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const jwt_1 = require("@nestjs/jwt");
const common_1 = require("@nestjs/common");
const socket_registry_service_1 = require("./socket-registry.service");
const notifications_service_1 = require("./notifications.service");
let NotificationsGateway = NotificationsGateway_1 = class NotificationsGateway {
    constructor(jwtService, registry, notificationsService) {
        this.jwtService = jwtService;
        this.registry = registry;
        this.notificationsService = notificationsService;
        this.logger = new common_1.Logger(NotificationsGateway_1.name);
    }
    async handleConnection(client) {
        try {
            const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
            if (!token) {
                this.logger.warn(`Connection rejected: No token provided for socket ${client.id}`);
                client.disconnect();
                return;
            }
            const payload = this.jwtService.verify(token);
            client.data.user = payload;
            client.join(payload.sub);
            this.registry.addConnection(payload.sub, payload.role, client);
            this.logger.log(`Client ${client.id} authenticated and joined room ${payload.sub}`);
        }
        catch (err) {
            this.logger.warn(`Connection rejected: Invalid token for socket ${client.id} - ${err.message}`);
            client.disconnect();
        }
    }
    handleDisconnect(client) {
        const user = client.data?.user;
        if (user) {
            this.registry.removeConnection(user.sub, client.id);
        }
    }
    async pushToUser(userId, payload) {
        if (!this.registry.isUserConnected(userId)) {
            this.logger.debug(`User ${userId} not connected, notification will remain queued`);
            return false;
        }
        const socketIds = this.registry.getUserConnections(userId);
        let delivered = false;
        for (const socketId of socketIds) {
            const socket = this.server.sockets.sockets.get(socketId);
            if (socket) {
                socket.emit('notification', payload, async (ack) => {
                    if (ack && ack.received) {
                        this.logger.log(`Notification ${payload.id || 'N/A'} acknowledged by socket ${socketId}`);
                        if (payload.id) {
                            await this.notificationsService.markDelivered(payload.id);
                        }
                    }
                });
                delivered = true;
            }
        }
        return delivered;
    }
    async handleAcknowledge(payload, client) {
        if (!client.data.user)
            return;
        await this.notificationsService.markDelivered(payload.id);
        this.logger.log(`Notification ${payload.id} manually acknowledged by ${client.data.user.sub}`);
    }
};
exports.NotificationsGateway = NotificationsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], NotificationsGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('acknowledge_notification'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], NotificationsGateway.prototype, "handleAcknowledge", null);
exports.NotificationsGateway = NotificationsGateway = NotificationsGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({ cors: { origin: '*' } }),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => notifications_service_1.NotificationsService))),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        socket_registry_service_1.SocketRegistryService,
        notifications_service_1.NotificationsService])
], NotificationsGateway);
//# sourceMappingURL=notifications.gateway.js.map