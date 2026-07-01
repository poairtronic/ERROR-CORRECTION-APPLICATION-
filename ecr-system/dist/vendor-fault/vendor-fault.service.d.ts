import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { VendorFaultLog } from './vendor-fault-log.entity';
import { CreateVendorFaultDto, UpdateVendorFaultDto } from './dto/vendor-fault.dto';
import { AuditLog } from '../audit-log/audit-log.entity';
export declare class VendorFaultService {
    private readonly faultRepo;
    private readonly auditRepo;
    private readonly events;
    constructor(faultRepo: Repository<VendorFaultLog>, auditRepo: Repository<AuditLog>, events: EventEmitter2);
    create(dto: CreateVendorFaultDto, actorId: string, actorRole: string): Promise<VendorFaultLog>;
    update(id: string, dto: UpdateVendorFaultDto, actorId: string, actorRole: string): Promise<VendorFaultLog>;
    getByReport(reportId: string): Promise<VendorFaultLog[]>;
    getByVendor(vendorId: string): Promise<VendorFaultLog[]>;
    handleVendorFault(payload: {
        report: any;
        gmId: string;
    }): Promise<void>;
}
