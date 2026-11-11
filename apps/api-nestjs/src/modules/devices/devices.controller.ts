import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/roles.decorator.js';
import { RolesGuard } from '../../common/roles.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { DeviceCalibrationDto, DeviceSyncDto } from './devices.dto.js';
import { DevicesService } from './devices.service.js';
import type { SyncItemResult } from './devices.service.js';

interface RequestWithUser { user: { sub: string; role: string } }

@Controller('devices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  @Roles(UserRole.NURSE, UserRole.NEPHROLOGIST, UserRole.ADMIN)
  list() { return this.devices.list(); }

  @Get(':id')
  @Roles(UserRole.NURSE, UserRole.NEPHROLOGIST, UserRole.ADMIN)
  get(@Param('id') id: string, @Req() request: RequestWithUser) { return this.devices.getAndAudit(id, request.user); }

  @Post(':id/calibration')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  calibrate(@Param('id') id: string, @Body() dto: DeviceCalibrationDto, @Req() request: RequestWithUser) {
    return this.devices.calibrate(id, dto, request.user);
  }

  @Post('sync')
  @HttpCode(200)
  @Roles(UserRole.NURSE)
  sync(@Body() dto: DeviceSyncDto, @Req() request: RequestWithUser): Promise<{
    syncedCount: number;
    failedCount: number;
    results: SyncItemResult[];
  }> {
    return this.devices.sync(dto, request.user);
  }
}
