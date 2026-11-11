import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller.js';
import { PatientsService } from './patients.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../../common/prisma.module.js';
import { RolesGuard } from '../../common/roles.guard.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PatientsController],
  providers: [PatientsService, RolesGuard],
  exports: [PatientsService],
})
export class PatientsModule {}
