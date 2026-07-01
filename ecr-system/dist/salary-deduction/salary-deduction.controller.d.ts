import { SalaryDeductionService } from './salary-deduction.service';
import { CreateSalaryDeductionDto, UpdateSalaryDeductionStatusDto } from './dto/salary-deduction.dto';
export declare class SalaryDeductionController {
    private readonly deductionService;
    constructor(deductionService: SalaryDeductionService);
    create(req: any, dto: CreateSalaryDeductionDto): Promise<import("./salary-deduction.entity").SalaryDeduction>;
    updateStatus(req: any, id: string, dto: UpdateSalaryDeductionStatusDto): Promise<import("./salary-deduction.entity").SalaryDeduction>;
    getByReport(reportId: string): Promise<import("./salary-deduction.entity").SalaryDeduction[]>;
    getByOperator(operatorId: string): Promise<import("./salary-deduction.entity").SalaryDeduction[]>;
}
