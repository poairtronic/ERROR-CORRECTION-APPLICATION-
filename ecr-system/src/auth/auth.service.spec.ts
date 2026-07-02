import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import * as bcrypt from 'bcrypt';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let mockUsersRepo: any;
  let mockJwtService: any;

  beforeEach(async () => {
    mockUsersRepo = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };

    mockJwtService = {
      sign: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUsersRepo },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      mockUsersRepo.getOne.mockResolvedValue(null);
      await expect(service.login('admin', 'password', {} as any)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password mismatch', async () => {
      mockUsersRepo.getOne.mockResolvedValue({ id: '1', passwordHash: 'hash' });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);
      
      await expect(service.login('admin', 'wrong_pass', {} as any)).rejects.toThrow(UnauthorizedException);
    });

    it('should return token and set cookie on success', async () => {
      mockUsersRepo.getOne.mockResolvedValue({ id: '1', name: 'Admin', role: 'ADMIN', passwordHash: 'hash' });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      mockJwtService.sign.mockReturnValue('jwt-token');

      const mockRes = { cookie: jest.fn() } as any;

      const result = await service.login('admin', 'correct_pass', mockRes);

      expect(result).toEqual({
        id: '1',
        username: 'Admin',
        role: 'admin',
        accessToken: 'jwt-token',
      });
      expect(mockRes.cookie).toHaveBeenCalledWith('token', 'jwt-token', expect.any(Object));
    });
  });
});
