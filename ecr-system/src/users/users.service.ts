import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  findAll(role?: string, department?: string) {
    const where: any = {};
    if (role) where.role = role;
    if (department) where.department = department;
    return this.repo.find({ where, order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  async create(dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.tempPassword, 10);
    const user = this.repo.create({
      name: dto.name,
      email: dto.email,
      role: dto.role,
      department: dto.department,
      salaryRefId: dto.salaryRefId,
      passwordHash,
    });
    return this.repo.save(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.findOne(id);
    Object.assign(user, dto);
    return this.repo.save(user);
  }

  // soft delete only - history must stay linked to the user record
  async deactivate(id: string) {
    const user = await this.findOne(id);
    user.isActive = false;
    return this.repo.save(user);
  }
}
