/**
 * SHEHSWAR ONE360 - Document Extraction & OCR Controller
 */
import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OcrService } from './ocr.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthUser } from '@shehswar/types';

@Controller('api/v1/operations/ocr')
@UseGuards(JwtAuthGuard)
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  /**
   * Upload binary document (PDF, Image, Text) and extract structured ERP data via OCR
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAndExtract(
    @UploadedFile() file: Express.Multer.File,
    @Body('documentType') documentType: 'PURCHASE_ORDER' | 'VENDOR_INVOICE' | 'PURCHASE_INVOICE' | 'GATE_PASS' | 'BANK_RECEIPT',
    @Body('companyId') bodyCompanyId: string,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) {
      throw new BadRequestException('No document file was uploaded');
    }

    const companyId = bodyCompanyId || user?.companyId || user?.context?.companyId;

    return this.ocrService.processDocument({
      companyId,
      organizationId: user?.organizationId,
      documentType: documentType || 'PURCHASE_ORDER',
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileBuffer: file.buffer,
    });
  }

  /**
   * JSON/Base64 extraction endpoint
   */
  @Post('extract')
  async extractDocument(
    @Body() body: {
      documentType: 'PURCHASE_ORDER' | 'VENDOR_INVOICE' | 'PURCHASE_INVOICE' | 'GATE_PASS' | 'BANK_RECEIPT';
      fileName: string;
      fileUrl?: string;
      fileContentBase64?: string;
      rawTextHint?: string;
      companyId?: string;
    },
    @CurrentUser() user: AuthUser,
  ) {
    const companyId = body.companyId || user?.companyId || user?.context?.companyId;

    if (!body.documentType || !body.fileName) {
      throw new BadRequestException('Document type and file name are required');
    }

    let fileBuffer: Buffer | undefined;
    if (body.fileContentBase64) {
      try {
        fileBuffer = Buffer.from(body.fileContentBase64, 'base64');
      } catch {
        // ignore
      }
    }

    return this.ocrService.processDocument({
      companyId,
      organizationId: user?.organizationId,
      documentType: body.documentType,
      fileName: body.fileName,
      fileUrl: body.fileUrl,
      fileBuffer,
      rawTextHint: body.rawTextHint,
    });
  }
}
