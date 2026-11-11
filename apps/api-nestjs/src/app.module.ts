import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './common/prisma.module.js';
import { RolesGuard } from './common/roles.guard.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BaselineModule } from './modules/baseline/baseline.module.js';
import { BenchModule } from './modules/bench/bench.module.js';
import { ConfigModule } from './modules/config/config.module.js';
import { DevicesModule } from './modules/devices/devices.module.js';
import { MeasurementsModule } from './modules/measurements/measurements.module.js';
import { PatientsModule } from './modules/patients/patients.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    PatientsModule,
    MeasurementsModule,
    BaselineModule,
    AuditModule,
    ConfigModule,
    DevicesModule,
    BenchModule,
    RealtimeModule,
    UsersModule,
  ],
  controllers: [HealthController],
  providers: [RolesGuard],
})
export class AppModule {}
