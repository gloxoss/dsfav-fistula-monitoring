import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/roles.decorator.js';
import { RolesGuard } from '../../common/roles.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ConfigService } from './config.service.js';

@Controller('config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get('active')
  @Roles(UserRole.NURSE, UserRole.NEPHROLOGIST, UserRole.ADMIN)
  getActive() {
    return this.configService.getActive();
  }

  @Post('threshold-proposals')
  @Roles(UserRole.NEPHROLOGIST)
  proposeThreshold(@Body() body: { threshold: number; confidenceNote: string }, @Req() request: { user: { sub: string } }) {
    return this.configService.proposeThreshold(body, request.user);
  }

  @Post('threshold-proposals/:id/approve')
  @Roles(UserRole.NEPHROLOGIST)
  approveThreshold(@Param('id') id: string, @Req() request: { user: { sub: string; role: string } }) {
    return this.configService.approveThresholdProposal(id, request.user);
  }
}
