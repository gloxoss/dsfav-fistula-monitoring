import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/roles.guard.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { BaselineModule } from '../baseline/baseline.module.js';
import { ConfigModule } from '../config/config.module.js';
import { DspClient } from './dsp.client.js';
import { MeasurementReviewController } from './review.controller.js';
import { MeasurementsController } from './measurements.controller.js';
import { MeasurementsService } from './measurements.service.js';

@Module({
  imports: [AuthModule, BaselineModule, ConfigModule, AuditModule],
  controllers: [MeasurementsController, MeasurementReviewController],
  providers: [MeasurementsService, DspClient, RolesGuard],
  exports: [MeasurementsService],
})
export class MeasurementsModule {}
