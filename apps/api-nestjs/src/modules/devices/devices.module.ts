import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/roles.guard.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ConfigModule } from '../config/config.module.js';
import { MeasurementsModule } from '../measurements/measurements.module.js';
import { DevicesController } from './devices.controller.js';
import { DevicesService } from './devices.service.js';
import { SyncQueueController } from './sync-queue.controller.js';

@Module({
  imports: [AuthModule, AuditModule, ConfigModule, MeasurementsModule],
  controllers: [DevicesController, SyncQueueController],
  providers: [DevicesService, RolesGuard],
  exports: [DevicesService],
})
export class DevicesModule {}
