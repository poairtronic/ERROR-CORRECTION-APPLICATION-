import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

export interface AuditLogFilterDto {
  limit?: number;
  page?: number;
  search?: string;
  actionType?: string;
  reportId?: string;
  actorId?: string;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async findAll(filters: AuditLogFilterDto = {}) {
    const limit = filters.limit ? Math.min(Math.max(1, Number(filters.limit)), 1000) : 500;
    const page = filters.page ? Math.max(1, Number(filters.page)) : 1;
    const skip = (page - 1) * limit;

    const qb = this.auditRepo
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.actor', 'actor')
      .leftJoinAndSelect('audit.report', 'report')
      .orderBy('audit.timestamp', 'DESC')
      .skip(skip)
      .take(limit);

    if (filters.actionType) {
      qb.andWhere('audit.actionType = :actionType', { actionType: filters.actionType });
    }

    if (filters.reportId) {
      qb.andWhere('audit.reportId = :reportId', { reportId: filters.reportId });
    }

    if (filters.actorId) {
      qb.andWhere('audit.actorId = :actorId', { actorId: filters.actorId });
    }

    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(audit.note) LIKE :term OR LOWER(CAST(audit.actionType AS text)) LIKE :term OR LOWER(actor.name) LIKE :term OR LOWER(actor.email) LIKE :term OR LOWER(report.reportNumber) LIKE :term OR LOWER(audit.actorRole) LIKE :term)',
        { term },
      );
    }

    const items = await qb.getMany();

    return items.map((log) => ({
      ...log,
      reportNumber: log.report?.reportNumber || log.entityId || 'N/A',
      notes: log.note,
    }));
  }

  async findOne(id: string) {
    const log = await this.auditRepo.findOne({
      where: { id },
      relations: {
        actor: true,
        report: true,
      },
    });
    if (!log) return null;
    return {
      ...log,
      reportNumber: log.report?.reportNumber || log.entityId || 'N/A',
      notes: log.note,
    };
  }
}

