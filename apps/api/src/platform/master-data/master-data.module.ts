/**
 * SHEHSWAR ONE360 - Master Data Module
 */
import { Module } from '@nestjs/common';
import { MasterDataController } from './master-data.controller';
import { MasterDataService } from './master-data.service';
import { AuditModule } from '../audit/audit.module';
import { CodeGenerationModule } from '../code-generation/code-generation.module';
import { CategoryRouterService } from './category-router.service';
import { UnifiedItemsService } from './unified-items.service';
import { ProductImportService } from './product-import.service';

@Module({
  imports: [AuditModule, CodeGenerationModule],
  controllers: [MasterDataController],
  providers: [
    MasterDataService,
    CategoryRouterService,
    UnifiedItemsService,
    ProductImportService,
  ],
  exports: [
    MasterDataService,
    CategoryRouterService,
    UnifiedItemsService,
    ProductImportService,
  ],
})
export class MasterDataModule {}
