import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitterModule, EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { DefectReportsService } from './defect-reports.service';
import { DefectReportsWorkflowService } from './defect-reports-workflow.service';
import { DefectReportsImageService } from './defect-reports-image.service';
import { DefectReport } from './defect-report.entity';
import { ReportSequence } from './report-sequence.entity';
import { InspectionDetail } from '../inspection/inspection-detail.entity';
import { SmReview } from '../sm-review/sm-review.entity';
import { GmApproval } from '../gm-approval/gm-approval.entity';
import { DefectReportsMutationService } from './defect-reports-mutation.service';
import { StatusNotificationHandler } from '../notifications/handlers/status-notification.handler';
import { EventNotificationHandler } from '../notifications/handlers/event-notification.handler';
import { ComponentIssue } from '../component-issue/component-issue.entity';
import { AuditLog, AuditActionType } from '../audit-log/audit-log.entity';
import { User } from '../users/user.entity';
import { SalaryDeduction } from '../salary-deduction/salary-deduction.entity';
import { Notification } from '../notifications/notification.entity';
import { NotificationPreference } from '../email/entities/notification-preference.entity';
import { EmailLog } from '../email/entities/email-log.entity';
import { NotificationListener } from '../notifications/notification.listener';
import { SalaryDeductionService } from '../salary-deduction/salary-deduction.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/services/email.service';
import { GmailSmtpService } from '../email/services/gmail-smtp.service';
import { EmailTemplateService } from '../email/services/email-template.service';
import { ImageUploadService } from '../image-upload/image-upload.service';
import { Role } from '../common/enums/role.enum';
import { ReportStatus } from '../common/enums/report-status.enum';

describe('Defect Report Workflow Integration', () => {
  let reportsService: DefectReportsService;
  let deductionService: SalaryDeductionService;
  let eventEmitter: EventEmitter2;

  // Mock repositories
  const mockReportRepo = {
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockImplementation((record) => Promise.resolve({ id: 'report-uuid', reportNumber: 'AGIPL-2026-ERR-00001', ...record })),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }),
  };

  const mockSequenceRepo = {};
  const mockInspectionRepo = {
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockImplementation((record) => Promise.resolve(record)),
    findOne: jest.fn(),
  };
  const mockSmReviewRepo = {
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockImplementation((record) => Promise.resolve(record)),
    findOne: jest.fn(),
  };
  const mockGmApprovalRepo = {
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockImplementation((record) => Promise.resolve(record)),
    findOne: jest.fn(),
  };
  const mockIssueRepo = {};
  const mockAuditRepo = {
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockImplementation((record) => Promise.resolve({ id: 'audit-uuid', ...record })),
  };
  const mockUserRepo = {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
  };
  const mockDeductionRepo = {
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockImplementation((record) => Promise.resolve({ id: 'deduction-uuid', ...record })),
    findOne: jest.fn().mockResolvedValue(null),
  };
  const mockNotificationRepo = {
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockImplementation((record) => Promise.resolve({ id: 'notification-uuid', ...record })),
  };
  const mockPreferenceRepo = {};
  const mockEmailLogRepo = {
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockImplementation((record) => Promise.resolve({ id: 'email-uuid', ...record })),
  };

  // Mock template, smtp, email services
  const mockTemplateService = {};
  const mockGmailSmtpService = {};
  const mockNotificationsService = {
    create: jest.fn().mockImplementation((dto) => Promise.resolve({ id: 'notification-uuid', ...dto })),
  };
  const mockEmailService = {
    queueEmail: jest.fn().mockImplementation((dto) => Promise.resolve({ id: 'email-uuid', ...dto })),
    findAll: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        DefectReportsService,
        DefectReportsWorkflowService,
        DefectReportsImageService,
        DefectReportsMutationService,
        SalaryDeductionService,
        NotificationListener,
        StatusNotificationHandler,
        EventNotificationHandler,
        { provide: getRepositoryToken(DefectReport), useValue: mockReportRepo },
        { provide: getRepositoryToken(ReportSequence), useValue: mockSequenceRepo },
        { provide: getRepositoryToken(InspectionDetail), useValue: mockInspectionRepo },
        { provide: getRepositoryToken(SmReview), useValue: mockSmReviewRepo },
        { provide: getRepositoryToken(GmApproval), useValue: mockGmApprovalRepo },
        { provide: getRepositoryToken(ComponentIssue), useValue: mockIssueRepo },
        { provide: getRepositoryToken(AuditLog), useValue: mockAuditRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(SalaryDeduction), useValue: mockDeductionRepo },
        { provide: getRepositoryToken(Notification), useValue: mockNotificationRepo },
        { provide: getRepositoryToken(NotificationPreference), useValue: mockPreferenceRepo },
        { provide: getRepositoryToken(EmailLog), useValue: mockEmailLogRepo },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: GmailSmtpService, useValue: mockGmailSmtpService },
        { provide: EmailTemplateService, useValue: mockTemplateService },
        { provide: ImageUploadService, useValue: { deleteImage: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key) => {
              if (key === 'FRONTEND_URL') return 'http://localhost:5173';
              return null;
            }),
          },
        },
        {
          provide: 'CONFIG_FRONTEND_URL',
          useValue: 'http://localhost:5173',
        },
      ],
    }).compile();

    await module.init();

    reportsService = module.get<DefectReportsService>(DefectReportsService);
    deductionService = module.get<SalaryDeductionService>(SalaryDeductionService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    // Mock transactional entity manager
    const mockManager = {
      findOne: jest.fn().mockImplementation((entity, criteria) => {
        if (entity === ReportSequence) {
          return Promise.resolve({ id: 'AGIPL', lastValue: 1 });
        }
        return Promise.resolve(null);
      }),
      create: jest.fn().mockImplementation((entity, data) => data),
      save: jest.fn().mockImplementation((entityOrData, data) => {
        if (data) return Promise.resolve(data);
        return Promise.resolve(entityOrData);
      }),
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === DefectReport) return mockReportRepo;
        if (entity === InspectionDetail) return mockInspectionRepo;
        if (entity === SmReview) return mockSmReviewRepo;
        if (entity === GmApproval) return mockGmApprovalRepo;
        if (entity === AuditLog) return mockAuditRepo;
        if (entity === User) return mockUserRepo;
        if (entity === SalaryDeduction) return mockDeductionRepo;
        if (entity === Notification) return mockNotificationRepo;
        if (entity === EmailLog) return mockEmailLogRepo;
      }),
    };

    mockReportRepo['manager'] = {
      transaction: jest.fn().mockImplementation(async (cb) => cb(mockManager)),
    } as any;

    mockDeductionRepo['manager'] = {
      transaction: jest.fn().mockImplementation(async (cb) => cb(mockManager)),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should propagate a General Manager Approval through to SalaryDeduction automatically', async () => {
    // 1. Arrange: Setup defect report that gets approved
    const mockReport: Partial<DefectReport> = {
      id: 'report-uuid',
      reportNumber: 'AGIPL-2026-ERR-00001',
      status: ReportStatus.PENDING_GM_APPROVAL,
      stageOfFailure: 'DESIGN_SRG',
      defectDescription: 'Design mismatch',
      raisedById: 'inspector-123',
      raisedByRole: 'INSPECTOR' as any,
      componentName: 'Digital Micrometer',
      inspectionDetail: {
        id: 'inspect-uuid',
        responsibleParty: 'OPERATOR',
        responsibleId: 'operator-123',
        responsibleName: 'John Doe',
        costEstimate: 200,
        lossAmount: 200,
      } as any,
      smReview: {
        id: 'sm-uuid',
        loopholeNote: 'Loophole check',
        decisionNote: 'Operator error confirmed',
      } as any,
    };

    mockReportRepo.findOne.mockResolvedValue(mockReport);
    mockUserRepo.findOne.mockResolvedValue({ id: 'operator-123', email: 'operator@velan.com' });

    // 2. Act: GM approves the report
    const actor = { id: 'gm-123', role: Role.GENERAL_MANAGER };
    const approvalDto = { budgetApproved: 200, remarks: 'Approve', approved: true };

    await reportsService.gmApprove('report-uuid', approvalDto as any, actor);

    // 3. Assert: Verify the event was fired and listener automatically queued the salary deduction
    // Give event listener a tick to resolve asynchronously
    await new Promise((resolve) => process.nextTick(resolve));

    expect(mockReportRepo.save).toHaveBeenCalled();
    expect(mockDeductionRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      reportId: 'report-uuid',
      operatorId: 'operator-123',
      amount: 200,
      status: 'PENDING',
    }));
  });

  it('should route inspector-created reports to PENDING_ACCOUNTS_REVIEW', async () => {
    const inspectorActor = { id: 'inspector-123', role: Role.INSPECTOR };
    const createDto = {
      scNo: 'SC-123',
      poNo: 'PO-123',
      productId: 'P-123',
      componentId: 'C-123',
      stageOfFailure: 'DESIGN_SRG',
      defectDescription: 'Test defect',
      inlineInspection: {
        costEstimate: 100,
        lossAmount: 50,
        responsibleParty: 'VENDOR',
        responsibleId: 'vendor-123',
      },
    };

    mockReportRepo.findOne.mockResolvedValue(null);

    const report = await reportsService.create(createDto as any, inspectorActor);
    expect(report.status).toBe(ReportStatus.PENDING_ACCOUNTS_REVIEW);
  });

  it('should allow Accounts to edit materialCost, labourCost, otherCost, lossAmount, costRemarks during accounts review', async () => {
    const mockReport: Partial<DefectReport> = {
      id: 'report-uuid',
      status: ReportStatus.PENDING_ACCOUNTS_REVIEW,
      inspectionDetail: {
        id: 'inspect-uuid',
        costEstimate: 0,
      } as any,
    };
    mockReportRepo.findOne.mockResolvedValue(mockReport);

    const accountsActor = { id: 'accounts-123', role: Role.ACCOUNTS };

    // Accounts edits materialCost
    await reportsService.editField('report-uuid', 'materialCost', '150', accountsActor);
    expect(mockReport.inspectionDetail?.materialCost).toBe(150);

    // Accounts edits labourCost
    await reportsService.editField('report-uuid', 'labourCost', '50', accountsActor);
    expect(mockReport.inspectionDetail?.labourCost).toBe(50);

    // Accounts edits otherCost
    await reportsService.editField('report-uuid', 'otherCost', '25', accountsActor);
    expect(mockReport.inspectionDetail?.otherCost).toBe(25);

    // Total cost estimate should be recalculated: 150 + 50 + 25 = 225
    expect(mockReport.inspectionDetail?.costEstimate).toBe(225);
  });

  it('should prevent Accounts from editing non-accounts fields', async () => {
    const mockReport: Partial<DefectReport> = {
      id: 'report-uuid',
      status: ReportStatus.PENDING_ACCOUNTS_REVIEW,
    };
    mockReportRepo.findOne.mockResolvedValue(mockReport);

    const accountsActor = { id: 'accounts-123', role: Role.ACCOUNTS };

    await expect(
      reportsService.editField('report-uuid', 'defectDescription', 'New description', accountsActor)
    ).rejects.toThrow('Accounts can only edit materialCost, labourCost, otherCost, lossAmount, costRemarks, costEstimate, rejectionStageCosts, componentName, or errorTypeName');
  });

  it('should prevent Accounts from editing reports when not in PENDING_ACCOUNTS_REVIEW status', async () => {
    const mockReport: Partial<DefectReport> = {
      id: 'report-uuid',
      status: ReportStatus.PENDING_SM_REVIEW,
    };
    mockReportRepo.findOne.mockResolvedValue(mockReport);

    const accountsActor = { id: 'accounts-123', role: Role.ACCOUNTS };

    await expect(
      reportsService.editField('report-uuid', 'materialCost', '150', accountsActor)
    ).rejects.toThrow('Accounts can only edit reports that are pending accounts review');
  });

  it('should validate status transitions for Accounts', async () => {
    const mockReport: Partial<DefectReport> = {
      id: 'report-uuid',
      status: ReportStatus.PENDING_ACCOUNTS_REVIEW,
      inspectionDetail: {
        materialCost: 100,
        labourCost: 100,
        lossAmount: 0,
        costEstimate: 200,
      } as any,
    };
    mockReportRepo.findOne.mockResolvedValue(mockReport);

    const accountsActor = { id: 'accounts-123', role: Role.ACCOUNTS };

    // Valid transition: PENDING_ACCOUNTS_REVIEW -> PENDING_SM_REVIEW
    await reportsService.transitionStatus('report-uuid', ReportStatus.PENDING_SM_REVIEW, 'cost verified', accountsActor);
    expect(mockReport.status).toBe(ReportStatus.PENDING_SM_REVIEW);

    // Invalid transition: accounts trying to transition to APPROVED directly
    mockReport.status = ReportStatus.PENDING_ACCOUNTS_REVIEW;
    await expect(
      reportsService.transitionStatus('report-uuid', ReportStatus.APPROVED, 'approve', accountsActor)
    ).rejects.toThrow('Accounts can only submit reports pending accounts review to Senior Manager review.');
  });
});
