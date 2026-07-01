import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VendorFaultLog } from './vendor-fault-log.entity';
import { VendorFaultService } from './vendor-fault.service';
import { VendorFaultController } from './vendor-fault.controller';
import { AuditLog } from '../audit-log/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VendorFaultLog, AuditLog])],
  providers: [VendorFaultService],
  controllers: [VendorFaultController],
  exports: [VendorFaultService],
})
export class VendorFaultModule {}
