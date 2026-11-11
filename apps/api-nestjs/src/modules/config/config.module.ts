import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RolesGuard } from '../../common/roles.guard.js';
import { ConfigController } from './config.controller.js';
import { ConfigService } from './config.service.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [ConfigController],
  providers: [ConfigService, RolesGuard],
  exports: [ConfigService],
})
export class ConfigModule {}
