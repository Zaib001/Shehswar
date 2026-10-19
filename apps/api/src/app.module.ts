/**
 * SHEHSWAR ONE360 - Root Application Module
 */
import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { PlatformModule } from './platform/platform.module';
import { ProcurementModule } from './procurement/procurement.module';
import { OperationsModule } from './operations/operations.module';

@Module({
  imports: [CoreModule, PlatformModule, ProcurementModule, OperationsModule],
})
export class AppModule {}

