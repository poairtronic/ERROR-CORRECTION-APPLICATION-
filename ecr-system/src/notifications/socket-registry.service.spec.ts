import { Test, TestingModule } from '@nestjs/testing';
import { SocketRegistryService } from './socket-registry.service';
import { MonitoringService } from '../monitoring/monitoring.service';

describe('SocketRegistryService', () => {
  let service: SocketRegistryService;
  const mockMonitoringService = { setSocketCount: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocketRegistryService,
        { provide: MonitoringService, useValue: mockMonitoringService },
      ],
    }).compile();

    service = module.get<SocketRegistryService>(SocketRegistryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('addConnection should add connection and update count', () => {
    service.addConnection('u1', 'USER', { id: 'c1' } as any);
    expect(service.isUserConnected('u1')).toBe(true);
    expect(service.getUserConnections('u1')).toEqual(['c1']);
    expect(service.getConnectionCount()).toBe(1);
    expect(mockMonitoringService.setSocketCount).toHaveBeenCalledWith(1);
  });

  it('addConnection should not add duplicate socket', () => {
    service.addConnection('u1', 'USER', { id: 'c1' } as any);
    service.addConnection('u1', 'USER', { id: 'c1' } as any);
    expect(service.getUserConnections('u1')).toEqual(['c1']);
    expect(mockMonitoringService.setSocketCount).toHaveBeenCalledTimes(1);
  });

  it('removeConnection should remove connection and update count', () => {
    service.addConnection('u1', 'USER', { id: 'c1' } as any);
    service.removeConnection('u1', 'c1');
    expect(service.isUserConnected('u1')).toBe(false);
    expect(service.getUserConnections('u1')).toEqual([]);
    expect(service.getConnectionCount()).toBe(0);
    expect(mockMonitoringService.setSocketCount).toHaveBeenCalledWith(0);
  });

  it('removeConnection should delete user entry when no sockets left', () => {
    service.addConnection('u1', 'USER', { id: 'c1' } as any);
    service.removeConnection('u1', 'c1');
    // internal map should not have 'u1' anymore
    expect((service as any).connections.has('u1')).toBe(false);
  });

  it('removeConnection should do nothing if user not found', () => {
    service.removeConnection('u1', 'c1');
    expect(mockMonitoringService.setSocketCount).not.toHaveBeenCalled();
  });

  it('getUserConnections should return empty array if user not found', () => {
    expect(service.getUserConnections('u2')).toEqual([]);
  });

  it('isUserConnected should return false if user not found', () => {
    expect(service.isUserConnected('u2')).toBe(false);
  });
});
