import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalaryDeduction } from './salary-deduction.entity';
import { SalaryDeductionService } from './salary-deduction.service';
import { SalaryDeductionController } from './salary-deduction.controller';
import { AuditLog } from '../audit-log/audit-log.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SalaryDeduction, AuditLog, User])],
  providers: [SalaryDeductionService],
  controllers: [SalaryDeductionController],
  exports: [SalaryDeductionService],
})
export class SalaryDeductionModule {}
