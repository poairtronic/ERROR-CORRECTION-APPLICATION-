import { ComponentIssueService } from './component-issue.service';
import { CreateComponentIssueDto } from './dto/create-component-issue.dto';
export declare class ComponentIssueController {
    private readonly componentIssueService;
    constructor(componentIssueService: ComponentIssueService);
    issueComponents(req: any, dto: CreateComponentIssueDto): Promise<import("./component-issue.entity").ComponentIssue>;
    getIssuesByReport(reportId: string): Promise<import("./component-issue.entity").ComponentIssue[]>;
}
