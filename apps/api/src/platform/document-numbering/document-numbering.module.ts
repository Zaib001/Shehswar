/**
 * SHEHSWAR ONE360 - Document Numbering Module
 */
import { Global, Module } from '@nestjs/common';
import { DocumentNumberingService } from './document-numbering.service';
import { DocumentNumberingController } from './document-numbering.controller';

@Global()
@Module({
  controllers: [DocumentNumberingController],
  providers: [DocumentNumberingService],
  exports: [DocumentNumberingService],
})
export class DocumentNumberingModule {}
