import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { EmailLog } from '../email/entities/email-log.entity';
import { EmailStatus } from '../email/enums/email-status.enum';
import { EmailMonitoringAuditLog } from './entities/email-monitoring-audit-log.entity';
import { User } from '../users/user.entity';
import { DefectReport } from '../defect-reports/defect-report.entity';
import { Notification } from '../notifications/notification.entity';

@Injectable()
export class EmailMonitoringService {
  constructor(
    @InjectRepository(EmailLog)
    private readonly emailLogRepo: Repository<EmailLog>,
    @InjectRepository(EmailMonitoringAuditLog)
    private readonly auditLogRepo: Repository<EmailMonitoringAuditLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(DefectReport)
    private readonly reportRepo: Repository<DefectReport>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  async getSummary() {
    const total = await this.emailLogRepo.count();
    const queued = await this.emailLogRepo.count({ where: { status: EmailStatus.PENDING } });
    const processing = await this.emailLogRepo.count({ where: { status: EmailStatus.PROCESSING } });
    const sent = await this.emailLogRepo.count({ where: { status: EmailStatus.SENT } });
    const failed = await this.emailLogRepo.count({ where: { status: EmailStatus.FAILED } });
    const cancelled = await this.emailLogRepo.count({ where: { status: EmailStatus.CANCELLED } });

    // Date bounds
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Today/Week/Month query
    const queryBuilder = this.emailLogRepo.createQueryBuilder('log');
    const todayCount = await queryBuilder.where('log.createdAt >= :todayStart', { todayStart }).getCount();
    const weekCount = await queryBuilder.where('log.createdAt >= :weekStart', { weekStart }).getCount();
    const monthCount = await queryBuilder.where('log.createdAt >= :monthStart', { monthStart }).getCount();

    // Average Delivery Time
    const avgRes = await this.emailLogRepo
      .createQueryBuilder('log')
      .select('AVG(EXTRACT(EPOCH FROM (log.sentTime - log.createdAt)))', 'avg')
      .where('log.status = :status', { status: EmailStatus.SENT })
      .andWhere('log.sentTime IS NOT NULL')
      .getRawOne();
    const avgDeliveryTimeSeconds = avgRes && avgRes.avg ? Math.round(Number(avgRes.avg)) : 0;

    const successRate = total > 0 ? Number(((sent / total) * 100).toFixed(2)) : 0;
    const failureRate = total > 0 ? Number((((failed + cancelled) / total) * 100).toFixed(2)) : 0;

    return {
      total,
      queued,
      processing,
      sent,
      failed,
      cancelled,
      todayCount,
      weekCount,
      monthCount,
      successRate,
      failureRate,
      avgDeliveryTimeSeconds,
    };
  }

  async list(query: any) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(query.limit || 10)));
    const skip = (page - 1) * limit;

    const qb = this.emailLogRepo.createQueryBuilder('log');

    // Status filter
    if (query.status) {
      qb.andWhere('log.status = :status', { status: query.status });
    }

    // Recipient search/filter
    if (query.recipient) {
      qb.andWhere('log.recipient ILIKE :recipient', { recipient: `%${query.recipient}%` });
    }

    // Report search/filter
    if (query.reportNumber) {
      const reports = await this.reportRepo.find({
        where: { reportNumber: Like(`%${query.reportNumber}%`) },
        select: ['id'],
      });
      const reportIds = reports.map(r => r.id);
      if (reportIds.length > 0) {
        qb.andWhere('log.relatedReportId IN (:...reportIds)', { reportIds });
      } else {
        qb.andWhere('1 = 0');
      }
    }

    // General Search (Report Number, Recipient, Subject, Email ID)
    if (query.search) {
      const searchStr = `%${query.search}%`;
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(query.search);
      
      const reports = await this.reportRepo.find({
        where: { reportNumber: Like(searchStr) },
        select: ['id'],
      });
      const reportIds = reports.map(r => r.id);

      qb.andWhere(
        qb => {
          let cond = 'log.recipient ILIKE :search OR log.subject ILIKE :search';
          if (isUuid) {
            cond += ' OR log.id = :searchUuid';
          }
          if (reportIds.length > 0) {
            cond += ' OR log.relatedReportId IN (:...searchReportIds)';
          }
          return qb.andWhere(`(${cond})`, {
            search: searchStr,
            searchUuid: query.search,
            searchReportIds: reportIds,
          });
        }
      );
    }

    // Template name
    if (query.template) {
      qb.andWhere('log.event = :template', { template: query.template });
    }

    // Provider
    if (query.provider) {
      qb.andWhere('log.failureReason LIKE :provider', { provider: `%${query.provider}%` });
    }

    // Date range
    if (query.startDate && query.endDate) {
      qb.andWhere('log.createdAt BETWEEN :startDate AND :endDate', {
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
      });
    }

    // Sorting
    const sortField = query.sortBy || 'createdAt';
    const sortOrder = (query.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`log.${sortField}`, sortOrder);

    // Skip and take
    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    // Map user roles & report numbers dynamically to prevent N+1 queries
    const recipientEmails = items.map(i => i.recipient);
    const reportIds = items.map(i => i.relatedReportId).filter(Boolean) as string[];

    const users = recipientEmails.length > 0 
      ? await this.userRepo.find({ where: { email: Like(`%${recipientEmails.join('%')}%`) } }) 
      : [];
    const reports = reportIds.length > 0
      ? await this.reportRepo.find({ where: { id: Like(`%${reportIds.join('%')}%`) } })
      : [];

    const mappedItems = items.map(item => {
      const user = users.find(u => u.email === item.recipient);
      const report = reports.find(r => r.id === item.relatedReportId);
      
      let parsedProviderRes: any = null;
      try {
        if (item.failureReason && item.failureReason.startsWith('{')) {
          parsedProviderRes = JSON.parse(item.failureReason);
        }
      } catch (e) {}

      return {
        ...item,
        recipientRole: user ? user.role : 'N/A',
        reportNumber: report ? report.reportNumber : 'N/A',
        providerName: parsedProviderRes ? parsedProviderRes.providerName : 'Brevo',
        deliveryTimeSeconds: item.sentTime 
          ? Math.round((item.sentTime.getTime() - item.createdAt.getTime()) / 1000) 
          : null,
      };
    });

    return {
      items: mappedItems,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string) {
    const email = await this.emailLogRepo.findOne({ where: { id } });
    if (!email) {
      throw new NotFoundException('Email log not found');
    }

    const user = await this.userRepo.findOne({ where: { email: email.recipient } });
    const report = email.relatedReportId 
      ? await this.reportRepo.findOne({ where: { id: email.relatedReportId } }) 
      : null;
    const notification = email.notificationId 
      ? await this.notificationRepo.findOne({ where: { id: email.notificationId } })
      : null;

    const auditLogs = await this.auditLogRepo.find({
      where: { emailLogId: id },
      order: { timestamp: 'DESC' },
    });

    let parsedProviderRes: any = null;
    try {
      if (email.failureReason && email.failureReason.startsWith('{')) {
        parsedProviderRes = JSON.parse(email.failureReason);
      }
    } catch (e) {}

    return {
      email,
      recipientRole: user ? user.role : 'N/A',
      report,
      notification,
      auditLogs,
      providerResponse: parsedProviderRes || { raw: email.failureReason },
    };
  }

  async resend(id: string, adminUser: any, reason: string) {
    const email = await this.emailLogRepo.findOne({ where: { id } });
    if (!email) {
      throw new NotFoundException('Email log not found');
    }

    email.status = EmailStatus.PENDING;
    email.retryCount = 0;
    email.failureReason = null as any;
    const saved = await this.emailLogRepo.save(email);

    await this.auditLogRepo.save(
      this.auditLogRepo.create({
        emailLogId: id,
        adminUserId: adminUser.id,
        adminUsername: adminUser.username || adminUser.email,
        action: 'RESEND',
        reason,
      })
    );

    return saved;
  }

  async retry(id: string, adminUser: any, reason: string) {
    const email = await this.emailLogRepo.findOne({ where: { id } });
    if (!email) {
      throw new NotFoundException('Email log not found');
    }

    email.status = EmailStatus.PENDING;
    email.retryCount = 0;
    email.failureReason = null as any;
    const saved = await this.emailLogRepo.save(email);

    await this.auditLogRepo.save(
      this.auditLogRepo.create({
        emailLogId: id,
        adminUserId: adminUser.id,
        adminUsername: adminUser.username || adminUser.email,
        action: 'RETRY',
        reason,
      })
    );

    return saved;
  }

  async cancel(id: string, adminUser: any, reason: string) {
    const email = await this.emailLogRepo.findOne({ where: { id } });
    if (!email) {
      throw new NotFoundException('Email log not found');
    }

    email.status = EmailStatus.CANCELLED;
    const saved = await this.emailLogRepo.save(email);

    await this.auditLogRepo.save(
      this.auditLogRepo.create({
        emailLogId: id,
        adminUserId: adminUser.id,
        adminUsername: adminUser.username || adminUser.email,
        action: 'CANCEL',
        reason,
      })
    );

    return saved;
  }

  async exportToCsv(query: any): Promise<string> {
    const listRes = await this.list({ ...query, page: 1, limit: 1000 });
    const items = listRes.items;

    const headers = [
      'Email ID',
      'Report Number',
      'Recipient',
      'Recipient Role',
      'Subject',
      'Template Name',
      'Status',
      'Provider',
      'Retry Count',
      'Created Time',
      'Sent Time',
      'Delivery Time (s)',
      'Message ID',
      'Failure Reason',
    ];

    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '';
      const text = String(str).replace(/"/g, '""');
      return text.includes(',') || text.includes('\n') || text.includes('"') ? `"${text}"` : text;
    };

    const csvRows = [
      headers.join(','),
      ...items.map(i => [
        escapeCsv(i.id),
        escapeCsv(i.reportNumber),
        escapeCsv(i.recipient),
        escapeCsv(i.recipientRole),
        escapeCsv(i.subject),
        escapeCsv(i.event),
        escapeCsv(i.status),
        escapeCsv(i.providerName),
        escapeCsv(i.retryCount),
        escapeCsv(i.createdAt),
        escapeCsv(i.sentTime),
        escapeCsv(i.deliveryTimeSeconds),
        escapeCsv(i.providerMessageId),
        escapeCsv(i.failureReason),
      ].join(',')),
    ];

    return csvRows.join('\n');
  }
}
