import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErrorType } from './error-types/error-type.entity';
import { Component } from './components/component.entity';
import { Vendor } from './vendors/vendor.entity';
import { Operator } from './operators/operator.entity';
import { CostRate } from './cost-rates/cost-rate.entity';
import { ErrorTypesController } from './error-types/error-types.controller';
import { ComponentsController } from './components/components.controller';
import { VendorsController } from './vendors/vendors.controller';
import { OperatorsController } from './operators/operators.controller';
import { CostRatesController } from './cost-rates/cost-rates.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ErrorType, Component, Vendor, Operator, CostRate])],
  controllers: [
    ErrorTypesController,
    ComponentsController,
    VendorsController,
    OperatorsController,
    CostRatesController,
  ],
})
export class MasterDataModule {}
