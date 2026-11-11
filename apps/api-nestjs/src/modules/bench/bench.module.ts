import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/roles.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { BenchController, BenchReportsController } from './bench.controller.js';
import { BenchService } from './bench.service.js';

@Module({
  imports: [AuthModule],
  controllers: [BenchController, BenchReportsController],
  providers: [BenchService, RolesGuard],
  exports: [BenchService],
})
export class BenchModule {}
