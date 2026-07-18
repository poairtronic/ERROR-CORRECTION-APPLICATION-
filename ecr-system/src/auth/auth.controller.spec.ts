import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: Partial<AuthService>;

  beforeEach(() => {
    authService = {
      login: jest.fn().mockResolvedValue({ access_token: 'jwt-token', user: { id: '1', username: 'admin' } }),
      getMe: jest.fn().mockResolvedValue({ id: '1', username: 'admin', role: 'ADMIN' }),
      logout: jest.fn().mockResolvedValue({ message: 'Logged out successfully' }),
    };
    controller = new AuthController(authService as AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should call authService.login with correct params', async () => {
      const body = { username: 'admin', password: 'password123' };
      const res = { cookie: jest.fn() } as any;
      const req = { ip: '127.0.0.1', headers: { 'user-agent': 'jest' } } as any;

      await controller.login(body, res, req);

      expect(authService.login).toHaveBeenCalledWith('admin', 'password123', res, '127.0.0.1', 'jest');
    });

    it('should return token response', async () => {
      const body = { username: 'admin', password: 'password123' };
      const res = { cookie: jest.fn() } as any;
      const req = { ip: '127.0.0.1', headers: { 'user-agent': 'jest' } } as any;

      const result = await controller.login(body, res, req);
      expect(result).toEqual({ access_token: 'jwt-token', user: { id: '1', username: 'admin' } });
    });
  });

  describe('getMe', () => {
    it('should return current user profile', async () => {
      const req = { user: { sub: '1' } } as any;
      const result = await controller.getMe(req);
      expect(authService.getMe).toHaveBeenCalledWith('1');
      expect(result).toEqual({ id: '1', username: 'admin', role: 'ADMIN' });
    });
  });

  describe('logout', () => {
    it('should call authService.logout', async () => {
      const res = { clearCookie: jest.fn() } as any;
      const result = await controller.logout(res);
      expect(authService.logout).toHaveBeenCalledWith(res);
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });
});
