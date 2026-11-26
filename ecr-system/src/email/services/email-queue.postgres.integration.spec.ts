import { Test } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EmailLog } from '../entities/email-log.entity';
import { EmailStatus } from '../enums/email-status.enum';
import { NotificationEvent } from '../enums/notification-event.enum';
import { AddEmailProcessingAndResetEnums1783560000000 } from '../../migrations/1783560000000-AddEmailProcessingAndResetEnums';
import { MonitoringService } from '../../monitoring/monitoring.service';
import { Notification } from '../../notifications/notification.entity';
import { EmailQueueService } from './email-queue.service';

const testDbUrl = process.env.TEST_DATABASE_URL;
const describePg = testDbUrl ? describe : describe.skip;

describePg('EmailQueueService & Migration (Real PostgreSQL Integration)', () => {
  let dataSource: DataSource;
  let emailLogRepo: Repository<EmailLog>;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: testDbUrl,
      ssl: false,
      entities: [EmailLog],
      migrations: [AddEmailProcessingAndResetEnums1783560000000],
      synchronize: false,
    });
    await dataSource.initialize();

    // Provision legacy PostgreSQL enum schema (missing PROCESSING, PasswordReset, providerMessageId)
    await dataSource.query(`DROP TABLE IF EXISTS "migrations" CASCADE;`);
    await dataSource.query(`DROP TABLE IF EXISTS "notifications" CASCADE;`);
    await dataSource.query(`DROP TABLE IF EXISTS "email_logs" CASCADE;`);
    await dataSource.query(`DROP TYPE IF EXISTS "public"."email_logs_status_enum" CASCADE;`);
    await dataSource.query(`DROP TYPE IF EXISTS "public"."email_logs_event_enum" CASCADE;`);

    await dataSource.query(
      `CREATE TYPE "public"."email_logs_status_enum" AS ENUM('PENDING', 'SENT', 'FAILED', 'CANCELLED')`,
    );
    await dataSource.query(
      `CREATE TYPE "public"."email_logs_event_enum" AS ENUM('Report Submitted', 'Inspection Completed')`,
    );
    await dataSource.query(`
      CREATE TABLE "email_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "recipient" character varying NOT NULL,
        "cc" character varying,
        "bcc" character varying,
        "subject" character varying NOT NULL,
        "content" text NOT NULL,
        "isHtml" boolean NOT NULL DEFAULT false,
        "event" "public"."email_logs_event_enum" NOT NULL,
        "status" "public"."email_logs_status_enum" NOT NULL DEFAULT 'PENDING',
        "sentTime" TIMESTAMP,
        "retryCount" integer NOT NULL DEFAULT 0,
        "failureReason" text,
        "relatedReportId" character varying,
        "notificationId" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_logs" PRIMARY KEY ("id")
      )
    `);
    await dataSource.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "status" character varying NOT NULL DEFAULT 'QUEUED',
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
      )
    `);

    // Run non-transactional migration through TypeORM migration runner
    const ranMigrations = await dataSource.runMigrations();
    expect(ranMigrations.map((m) => m.name)).toContain('AddEmailProcessingAndResetEnums1783560000000');

    emailLogRepo = dataSource.getRepository(EmailLog);
  }, 20000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.query(`DROP TABLE IF EXISTS "migrations" CASCADE;`);
      await dataSource.query(`DROP TABLE IF EXISTS "notifications" CASCADE;`);
      await dataSource.query(`DROP TABLE IF EXISTS "email_logs" CASCADE;`);
      await dataSource.query(`DROP TYPE IF EXISTS "public"."email_logs_status_enum" CASCADE;`);
      await dataSource.query(`DROP TYPE IF EXISTS "public"."email_logs_event_enum" CASCADE;`);
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    await dataSource.query(`TRUNCATE TABLE "email_logs"`);
    await dataSource.query(
      `UPDATE "email_rate_limit_state" SET "windowStart" = clock_timestamp() - interval '60 seconds', "dispatchedCount" = 0 WHERE "key" = 'global'`,
    );
  });

  const makeWorker = (sendImpl: jest.Mock) => {
    return new EmailQueueService(
      emailLogRepo,
      { sendEmailViaApi: sendImpl } as any,
      { get: jest.fn().mockReturnValue(undefined) } as any,
      { emit: jest.fn() } as any,
      { recordQueueProcessingTime: jest.fn() } as any,
      { recordEmailSend: jest.fn() } as any,
    );
  };

  it('should have applied PROCESSING enum, PasswordReset enum, providerMessageId column, and index cleanly', async () => {
    const statusEnums: Array<{ enumlabel: string }> = await dataSource.query(`
      SELECT e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'email_logs_status_enum'
    `);
    expect(statusEnums.map((r) => r.enumlabel)).toContain('PROCESSING');

    const eventEnums: Array<{ enumlabel: string }> = await dataSource.query(`
      SELECT e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'email_logs_event_enum'
    `);
    expect(eventEnums.map((r) => r.enumlabel)).toContain(NotificationEvent.PASSWORD_RESET);

    const cols: Array<{ column_name: string }> = await dataSource.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'email_logs' AND column_name = 'providerMessageId'
    `);
    expect(cols).toHaveLength(1);

    const rateTable: Array<{ key: string }> = await dataSource.query(`
      SELECT "key" FROM "email_rate_limit_state" WHERE "key" = 'global'
    `);
    expect(rateTable).toHaveLength(1);
  });

  it('should enforce atomic cluster-wide 5-per-12s email quota across two concurrent workers (D-10)', async () => {
    const rows = Array.from({ length: 8 }, (_, idx) =>
      emailLogRepo.create({
        recipient: `cluster-${idx}@example.com`,
        subject: `Cluster Burst ${idx}`,
        content: 'Body',
        isHtml: false,
        event: NotificationEvent.PASSWORD_RESET,
        status: EmailStatus.PENDING,
        retryCount: 0,
      }),
    );
    await emailLogRepo.save(rows);

    const sentIds: string[] = [];
    const sharedSend = jest.fn(async (email: EmailLog) => {
      await new Promise((r) => setTimeout(r, 25));
      sentIds.push(email.id);
      return { messageId: `msg-${email.id}`, responseCode: 200, responseBody: 'ok' };
    });

    const workerA = makeWorker(sharedSend);
    const workerB = makeWorker(sharedSend);

    try {
      await Promise.all([workerA.processEmailQueue(), workerB.processEmailQueue()]);

      // Atomic PostgreSQL rate limiter MUST cap simultaneous dispatch across both workers at <= 5
      expect(sentIds.length).toBe(5);
      expect(new Set(sentIds).size).toBe(5);

      const remainingPending = await emailLogRepo.count({ where: { status: EmailStatus.PENDING } });
      const totalSent = await emailLogRepo.count({ where: { status: EmailStatus.SENT } });
      expect(totalSent).toBe(5);
      expect(remainingPending).toBe(3);
    } finally {
      workerA.clearScheduledTimers();
      workerB.clearScheduledTimers();
    }
  });

  it('should allow only one of two concurrent workers to claim and send a PENDING email', async () => {
    const inserted = await emailLogRepo.save(
      emailLogRepo.create({
        recipient: 'concurrent@example.com',
        subject: 'Concurrency Test',
        content: 'Body',
        isHtml: false,
        event: NotificationEvent.PASSWORD_RESET,
        status: EmailStatus.PENDING,
        retryCount: 0,
      }),
    );

    const sharedSend = jest.fn(async () => {
      await new Promise((r) => setTimeout(r, 40));
      return { messageId: 'pg-msg-1', responseCode: 200, responseBody: 'ok' };
    });

    const workerA = makeWorker(sharedSend);
    const workerB = makeWorker(sharedSend);

    await Promise.all([workerA.processEmailQueue(), workerB.processEmailQueue()]);

    expect(sharedSend).toHaveBeenCalledTimes(1);
    const reloaded = await emailLogRepo.findOneByOrFail({ id: inserted.id });
    expect(reloaded.status).toBe(EmailStatus.SENT);
    expect(reloaded.providerMessageId).toBe('pg-msg-1');
    expect(reloaded.sentTime).toBeInstanceOf(Date);
  });

  it('should prevent a stale finishing worker from overwriting an external CANCELLED update (D-04)', async () => {
    const inserted = await emailLogRepo.save(
      emailLogRepo.create({
        recipient: 'stale@example.com',
        subject: 'Stale Worker Test',
        content: 'Body',
        isHtml: false,
        event: NotificationEvent.PASSWORD_RESET,
        status: EmailStatus.PENDING,
        retryCount: 0,
      }),
    );

    let markSendStarted!: () => void;
    let releaseSend!: () => void;
    const sendStarted = new Promise<void>((r) => {
      markSendStarted = r;
    });
    const gateSend = new Promise<void>((r) => {
      releaseSend = r;
    });

    const worker = makeWorker(
      jest.fn(async () => {
        markSendStarted();
        await gateSend;
        return { messageId: 'late-msg', responseCode: 200, responseBody: 'ok' };
      }),
    );

    const runPromise = worker.processEmailQueue();
    await sendStarted;

    // External operator/watchdog cancels row while worker is blocked in network I/O
    await dataSource.query(`UPDATE "email_logs" SET "status" = 'CANCELLED', "updatedAt" = clock_timestamp() WHERE "id" = $1`, [
      inserted.id,
    ]);

    releaseSend();
    await runPromise;

    const reloaded = await emailLogRepo.findOneByOrFail({ id: inserted.id });
    expect(reloaded.status).toBe(EmailStatus.CANCELLED);
    expect(reloaded.providerMessageId).toBeNull();
  });

  it('should atomically recover old stuck PROCESSING emails using DB clock while keeping recent ones (D-01, D-11)', async () => {
    const retryableStuck = await emailLogRepo.save(
      emailLogRepo.create({
        recipient: 'stuck-retry@example.com',
        subject: 'Stuck Retry',
        content: 'Body',
        isHtml: false,
        event: NotificationEvent.PASSWORD_RESET,
        status: EmailStatus.PROCESSING,
        retryCount: 0,
      }),
    );
    const exhaustedStuck = await emailLogRepo.save(
      emailLogRepo.create({
        recipient: 'stuck-exhausted@example.com',
        subject: 'Stuck Exhausted',
        content: 'Body',
        isHtml: false,
        event: NotificationEvent.PASSWORD_RESET,
        status: EmailStatus.PROCESSING,
        retryCount: 3,
      }),
    );
    const activeProcessing = await emailLogRepo.save(
      emailLogRepo.create({
        recipient: 'active@example.com',
        subject: 'Active Processing',
        content: 'Body',
        isHtml: false,
        event: NotificationEvent.PASSWORD_RESET,
        status: EmailStatus.PROCESSING,
        retryCount: 0,
      }),
    );

    await dataSource.query(
      `UPDATE "email_logs" SET "updatedAt" = clock_timestamp() - interval '20 minutes' WHERE "id" IN ($1, $2)`,
      [retryableStuck.id, exhaustedStuck.id],
    );
    await dataSource.query(
      `UPDATE "email_logs" SET "updatedAt" = clock_timestamp() - interval '30 seconds' WHERE "id" = $1`,
      [activeProcessing.id],
    );

    const worker = makeWorker(jest.fn());
    const recovered = await worker.recoverStuckProcessingEmails(10 * 60 * 1000);
    expect(recovered).toBe(2);

    const r1 = await emailLogRepo.findOneByOrFail({ id: retryableStuck.id });
    const r2 = await emailLogRepo.findOneByOrFail({ id: exhaustedStuck.id });
    const r3 = await emailLogRepo.findOneByOrFail({ id: activeProcessing.id });

    expect(r1.status).toBe(EmailStatus.FAILED);
    expect(r1.retryCount).toBe(1);
    expect(r2.status).toBe(EmailStatus.CANCELLED);
    expect(r2.retryCount).toBe(4);
    expect(r3.status).toBe(EmailStatus.PROCESSING);
  });

  it('should recover only genuine GAS quota failures and leave non-quota GAS errors CANCELLED (D-12)', async () => {
    const quotaRow = await emailLogRepo.save(
      emailLogRepo.create({
        recipient: 'quota@example.com',
        subject: 'Quota',
        content: 'Body',
        isHtml: false,
        event: NotificationEvent.PASSWORD_RESET,
        status: EmailStatus.CANCELLED,
        retryCount: 3,
        failureReason: 'Google Apps Script error: Exception: Service invoked too many times for one day: email.',
      }),
    );
    const invalidRow = await emailLogRepo.save(
      emailLogRepo.create({
        recipient: 'bad@example.com',
        subject: 'Bad Input',
        content: 'Body',
        isHtml: false,
        event: NotificationEvent.PASSWORD_RESET,
        status: EmailStatus.CANCELLED,
        retryCount: 1,
        failureReason: 'Google Apps Script error: Invalid email address',
      }),
    );

    const eventEmitter = { emit: jest.fn() };
    const worker = new EmailQueueService(
      emailLogRepo,
      { sendEmailViaApi: jest.fn() } as any,
      { get: jest.fn() } as any,
      eventEmitter as any,
      { recordQueueProcessingTime: jest.fn() } as any,
      { recordEmailSend: jest.fn() } as any,
    );

    const count = await worker.recoverGasQuotaExceededEmails();
    expect(count).toBe(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith('email.logs.updated');

    const reloadedQuota = await emailLogRepo.findOneByOrFail({ id: quotaRow.id });
    const reloadedInvalid = await emailLogRepo.findOneByOrFail({ id: invalidRow.id });
    expect(reloadedQuota.status).toBe(EmailStatus.PENDING);
    expect(reloadedQuota.retryCount).toBe(0);
    expect(reloadedQuota.failureReason).toBeNull();
    expect(reloadedInvalid.status).toBe(EmailStatus.CANCELLED);
  });

  it('should execute real MonitoringService readiness/health check and cleanly close Nest TypeORM pool', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: testDbUrl,
          ssl: false,
          entities: [EmailLog],
          synchronize: false,
          extra: { max: 5, idleTimeoutMillis: 1000, connectionTimeoutMillis: 3000 },
        }),
        TypeOrmModule.forFeature([EmailLog]),
      ],
      providers: [
        MonitoringService,
        { provide: getRepositoryToken(Notification), useValue: { count: jest.fn().mockResolvedValue(0) } },
      ],
    }).compile();

    const app = moduleRef.createNestApplication();
    app.enableShutdownHooks();

    try {
      await app.init();

      const appDataSource = moduleRef.get(DataSource);
      const origGetRepo = appDataSource.getRepository.bind(appDataSource);
      jest.spyOn(appDataSource, 'getRepository').mockImplementation((entity: any) => {
        if (entity === Notification) {
          return {
            count: async ({ where }: any) => {
              const rows = await appDataSource.query(
                `SELECT COUNT(*)::int AS cnt FROM "notifications" WHERE "status" = $1`,
                [where.status],
              );
              return rows[0]?.cnt || 0;
            },
          } as any;
        }
        return origGetRepo(entity);
      });

      const monitoring = moduleRef.get(MonitoringService);
      const readiness = await monitoring.checkDatabaseHealth(true);
      expect(readiness.status).toBe('healthy');
      expect(readiness.latencyMs).toEqual(expect.any(Number));

      const metrics = await monitoring.getHealthMetrics(true);
      expect(metrics.status).toBe('healthy');
      expect(metrics.queues.status).toBe('available');
    } finally {
      // Graceful shutdown must drain cleanly without throwing pool-ended errors
      await expect(app.close()).resolves.toBeUndefined();
    }
  });
});
