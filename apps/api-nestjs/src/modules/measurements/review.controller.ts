import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AlertStatus, UserRole } from '@prisma/client';
import { Roles } from '../../common/roles.decorator.js';
import { RolesGuard } from '../../common/roles.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { MeasurementsService } from './measurements.service.js';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class MeasurementReviewController {
  constructor(private readonly measurements: MeasurementsService) {}

  @Get('queue')
  @Roles(UserRole.NURSE, UserRole.NEPHROLOGIST)
  getQueue(@Query('status') status?: AlertStatus, @Query('deviceId') deviceId?: string) {
    return this.measurements.getQueue(status, deviceId);
  }

  @Get('measurements/:id')
  @Roles(UserRole.NURSE, UserRole.NEPHROLOGIST)
  getDetail(@Param('id') id: string) {
    return this.measurements.getDetail(id);
  }
}
