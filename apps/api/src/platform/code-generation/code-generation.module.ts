import { Module, Global } from '@nestjs/common';
import { CodeGenerationService } from './code-generation.service';

@Global()
@Module({
  providers: [CodeGenerationService],
  exports: [CodeGenerationService],
})
export class CodeGenerationModule {}

