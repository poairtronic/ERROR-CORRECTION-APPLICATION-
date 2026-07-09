import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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
    const where: any = { isActive: true }; // Only show active users in the admin list
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
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      if (!existing.isActive) {
        // Free up the email address by hard-deleting the inactive record or renaming its email
        try {
          await this.repo.remove(existing);
        } catch (err) {
          existing.email = `${existing.email}_deleted_${Date.now()}`;
          await this.repo.save(existing);
        }
      } else {
        throw new ConflictException('A user with this email already exists.');
      }
    }

    const passwordHash = await bcrypt.hash(dto.tempPassword, 10);
    const user = this.repo.create({
      name: dto.name,
      email: dto.email,
      role: dto.role?.toUpperCase() as any,
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

  // Attempt hard delete first. Fall back to soft delete (isActive = false) if foreign keys (e.g. raised reports) exist
  async deactivate(id: string) {
    const user = await this.findOne(id);
    try {
      return await this.repo.remove(user);
    } catch (err) {
      user.isActive = false;
      // Free the email address by renaming it
      if (!user.email.includes('_deleted_')) {
        user.email = `${user.email}_deleted_${Date.now()}`;
      }
      return this.repo.save(user);
    }
  }
}
