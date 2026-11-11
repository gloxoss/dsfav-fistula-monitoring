import { Controller, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/roles.decorator.js';
import { RolesGuard } from '../../common/roles.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { DevicesService } from './devices.service.js';

interface RequestWithUser { user: { sub: string; role: string } }

@Controller('sync-queue')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SyncQueueController {
  constructor(private readonly devices: DevicesService) {}

  @Post(':id/retry')
  @HttpCode(200)
  @Roles(UserRole.NURSE)
  retry(@Param('id') id: string, @Req() request: RequestWithUser) {
    return this.devices.retry(id, request.user);
  }
}
