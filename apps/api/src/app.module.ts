/**
 * SHEHSWAR ONE360 - Root Application Module
 */
import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { PlatformModule } from './platform/platform.module';

@Module({
  imports: [CoreModule, PlatformModule],
})
export class AppModule {}
