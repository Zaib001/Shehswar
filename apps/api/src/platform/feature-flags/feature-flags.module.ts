/**
 * SHEHSWAR ONE360 - Feature Flags Module
 */
import { Global, Module } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service';

@Global()
@Module({
  providers: [FeatureFlagService],
  exports: [FeatureFlagService],
})
export class FeatureFlagsModule {}
