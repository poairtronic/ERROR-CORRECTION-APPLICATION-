import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { NotificationsGateway } from './notifications.gateway';
import { SocketRegistryService } from './socket-registry.service';
import { NotificationsService } from './notifications.service';
import { MonitoringService } from '../monitoring/monitoring.service';

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;
  
  const mockJwtService = { verify: jest.fn() };
  const mockRegistry = {
    addConnection: jest.fn(),
    removeConnection: jest.fn(),
    isUserConnected: jest.fn(),
    getUserConnections: jest.fn(),
  };
  const mockNotificationsService = { markDelivered: jest.fn() };
  const mockMonitoringService = { recordNotificationLatency: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsGateway,
        { provide: JwtService, useValue: mockJwtService },
        { provide: SocketRegistryService, useValue: mockRegistry },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: MonitoringService, useValue: mockMonitoringService },
      ],
    }).compile();

    gateway = module.get<NotificationsGateway>(NotificationsGateway);
    gateway.server = { emit: jest.fn(), close: jest.fn(), sockets: { sockets: new Map() } } as any;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('handleConnection should authenticate and join room', async () => {
    const client = {
      id: 'c1',
      handshake: { auth: { token: 't1' }, headers: {} },
      data: {},
      join: jest.fn(),
      disconnect: jest.fn(),
    } as any;

    mockJwtService.verify.mockReturnValue({ sub: 'u1', role: 'USER' });

    await gateway.handleConnection(client);
    
    expect(mockJwtService.verify).toHaveBeenCalledWith('t1');
    expect(client.join).toHaveBeenCalledWith('u1');
    expect(mockRegistry.addConnection).toHaveBeenCalledWith('u1', 'USER', client);
  });

  it('handleConnection should disconnect if no token', async () => {
    const client = {
      id: 'c1',
      handshake: { headers: {} },
      disconnect: jest.fn(),
    } as any;

    await gateway.handleConnection(client);
    expect(client.disconnect).toHaveBeenCalled();
  });

  it('handleDisconnect should remove connection if user authenticated', () => {
    const client = { id: 'c1', data: { user: { sub: 'u1' } } } as any;
    gateway.handleDisconnect(client);
    expect(mockRegistry.removeConnection).toHaveBeenCalledWith('u1', 'c1');
  });

  it('handleEmailLogsUpdated should broadcast', () => {
    gateway.handleEmailLogsUpdated();
    expect(gateway.server.emit).toHaveBeenCalledWith('email_logs_updated');
  });

  it('onApplicationShutdown should close server', () => {
    gateway.onApplicationShutdown();
    expect(gateway.server.close).toHaveBeenCalled();
  });

  it('pushToUser should emit and mark delivered on ack', async () => {
    mockRegistry.isUserConnected.mockReturnValue(true);
    mockRegistry.getUserConnections.mockReturnValue(['c1']);
    
    const mockSocket = {
      emit: jest.fn((evt, payload, ackFn) => {
        ackFn({ received: true });
      }),
    };
    (gateway.server.sockets.sockets as Map<any, any>).set('c1', mockSocket);

    const delivered = await gateway.pushToUser('u1', { id: 'n1' });
    
    expect(delivered).toBe(true);
    expect(mockSocket.emit).toHaveBeenCalledWith('notification', { id: 'n1' }, expect.any(Function));
    
    // allow async ack to process
    await new Promise(process.nextTick);
    expect(mockNotificationsService.markDelivered).toHaveBeenCalledWith('n1');
    expect(mockMonitoringService.recordNotificationLatency).toHaveBeenCalled();
  });

  it('pushToUser should return false if not connected', async () => {
    mockRegistry.isUserConnected.mockReturnValue(false);
    const delivered = await gateway.pushToUser('u1', { id: 'n1' });
    expect(delivered).toBe(false);
  });

  it('handleAcknowledge should manually mark delivered', async () => {
    const client = { data: { user: { sub: 'u1' } } } as any;
    await gateway.handleAcknowledge({ id: 'n1' }, client);
    expect(mockNotificationsService.markDelivered).toHaveBeenCalledWith('n1');
  });
});
