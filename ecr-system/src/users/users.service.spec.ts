import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('UsersService', () => {
  let service: UsersService;
  
  const mockRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findAll should return active users with optional filters', async () => {
    mockRepo.find.mockResolvedValue([]);
    await service.findAll('ADMIN', 'IT');
    expect(mockRepo.find).toHaveBeenCalledWith({
      where: { isActive: true, role: 'ADMIN', department: 'IT' },
      order: { name: 'ASC' },
    });
  });

  it('findOne should return user if exists', async () => {
    const user = { id: '1' };
    mockRepo.findOne.mockResolvedValue(user);
    expect(await service.findOne('1')).toEqual(user);
  });

  it('findOne should throw NotFoundException if not exists', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
  });

  it('create should hash password and save', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    mockRepo.create.mockImplementation((dto) => dto);
    mockRepo.save.mockImplementation(async (u) => u);

    const dto = { name: 'Test', email: 'test@example.com', tempPassword: 'pass' };
    const res = await service.create(dto as any);
    expect(mockRepo.save).toHaveBeenCalled();
    expect(res.name).toBe('Test');
    expect(res.passwordHash).toBeDefined();
  });

  it('create should throw ConflictException if active user exists', async () => {
    mockRepo.findOne.mockResolvedValue({ isActive: true });
    await expect(service.create({ email: 'test@example.com' } as any)).rejects.toThrow(ConflictException);
  });

  it('create should hard delete inactive user with same email', async () => {
    const existing = { isActive: false, email: 'test@example.com' };
    mockRepo.findOne.mockResolvedValueOnce(existing).mockResolvedValueOnce(null); // for create
    mockRepo.remove.mockResolvedValue(existing);
    mockRepo.create.mockImplementation((dto) => dto);
    mockRepo.save.mockImplementation(async (u) => u);

    await service.create({ email: 'test@example.com', tempPassword: 'pass' } as any);
    expect(mockRepo.remove).toHaveBeenCalledWith(existing);
  });
  
  it('create should soft delete inactive user with same email on remove failure', async () => {
    const existing = { isActive: false, email: 'test@example.com' };
    mockRepo.findOne.mockResolvedValueOnce(existing).mockResolvedValueOnce(null);
    mockRepo.remove.mockRejectedValue(new Error('foreign key constraint'));
    mockRepo.create.mockImplementation((dto) => dto);
    mockRepo.save.mockImplementation(async (u) => u);

    await service.create({ email: 'test@example.com', tempPassword: 'pass' } as any);
    expect(existing.email).toContain('_deleted_');
    expect(mockRepo.save).toHaveBeenCalledWith(existing);
  });

  it('update should modify and save', async () => {
    const user = { id: '1', name: 'Old' };
    mockRepo.findOne.mockResolvedValue(user);
    mockRepo.save.mockImplementation(async (u) => u);
    await service.update('1', { name: 'New' } as any);
    expect(user.name).toBe('New');
    expect(mockRepo.save).toHaveBeenCalledWith(user);
  });

  it('deactivate should hard delete if possible', async () => {
    const user = { id: '1' };
    mockRepo.findOne.mockResolvedValue(user);
    mockRepo.remove.mockResolvedValue(user);
    await service.deactivate('1');
    expect(mockRepo.remove).toHaveBeenCalledWith(user);
  });

  it('deactivate should soft delete on constraint error', async () => {
    const user: any = { id: '1', email: 'test@example.com', isActive: true };
    mockRepo.findOne.mockResolvedValue(user);
    mockRepo.remove.mockRejectedValue(new Error('foreign key error'));
    mockRepo.save.mockImplementation(async (u) => u);

    await service.deactivate('1');
    expect(user.isActive).toBe(false);
    expect(user.email).toContain('_deleted_');
    expect(mockRepo.save).toHaveBeenCalledWith(user);
  });
});
