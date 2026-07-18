import { ComponentIssueController } from './component-issue.controller';
import { ComponentIssueService } from './component-issue.service';

describe('ComponentIssueController', () => {
  let controller: ComponentIssueController;
  let service: Partial<ComponentIssueService>;

  const mockIssue = {
    id: 'ci-1',
    reportId: 'rpt-1',
    storeManagerId: 'sm-1',
    issuedToId: 'op-1',
    components: [{ componentId: 'comp-1', qty: 2 }],
    remarks: 'Issued',
  };

  beforeEach(() => {
    service = {
      issueComponents: jest.fn().mockResolvedValue(mockIssue),
      getIssuesByReport: jest.fn().mockResolvedValue([mockIssue]),
    };
    controller = new ComponentIssueController(service as ComponentIssueService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('issueComponents', () => {
    it('should issue components for a report', async () => {
      const req = { user: { id: 'sm-1' } };
      const dto = {
        reportId: 'rpt-1',
        issuedToId: 'op-1',
        components: [{ componentId: 'comp-1', qty: 2 }],
        remarks: 'Issued',
      } as any;

      const result = await controller.issueComponents(req, dto);
      expect(service.issueComponents).toHaveBeenCalledWith('sm-1', dto);
      expect(result).toEqual(mockIssue);
    });
  });

  describe('getIssuesByReport', () => {
    it('should return issues for a report', async () => {
      const result = await controller.getIssuesByReport('rpt-1');
      expect(service.getIssuesByReport).toHaveBeenCalledWith('rpt-1');
      expect(result).toEqual([mockIssue]);
    });
  });
});
