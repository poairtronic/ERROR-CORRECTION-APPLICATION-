import { VendorFaultService } from './vendor-fault.service';
import { CreateVendorFaultDto, UpdateVendorFaultDto } from './dto/vendor-fault.dto';
export declare class VendorFaultController {
    private readonly faultService;
    constructor(faultService: VendorFaultService);
    create(req: any, dto: CreateVendorFaultDto): Promise<import("./vendor-fault-log.entity").VendorFaultLog>;
    update(req: any, id: string, dto: UpdateVendorFaultDto): Promise<import("./vendor-fault-log.entity").VendorFaultLog>;
    getByReport(reportId: string): Promise<import("./vendor-fault-log.entity").VendorFaultLog[]>;
    getByVendor(vendorId: string): Promise<import("./vendor-fault-log.entity").VendorFaultLog[]>;
}
