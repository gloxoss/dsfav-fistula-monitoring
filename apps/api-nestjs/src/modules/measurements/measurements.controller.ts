import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/roles.decorator.js';
import { RolesGuard } from '../../common/roles.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AbandonMeasurementDto, CreateMeasurementDto } from './measurements.dto.js';
import { MeasurementsService } from './measurements.service.js';

interface RequestWithUser extends AsyncIterable<Uint8Array> {
  user: { sub: string; role: string };
  body?: unknown;
}

@Controller('measurements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MeasurementsController {
  constructor(private readonly measurements: MeasurementsService) {}

  @Post()
  @Roles(UserRole.NURSE, UserRole.INTERN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateMeasurementDto, @Req() request: RequestWithUser) {
    return this.measurements.create(dto, request.user);
  }

  @Put(':id/raw')
  @Roles(UserRole.NURSE, UserRole.INTERN)
  @HttpCode(HttpStatus.OK)
  async uploadRaw(@Param('id') id: string, @Req() request: RequestWithUser) {
    let raw: Buffer;
    if (Buffer.isBuffer(request.body)) {
      raw = request.body;
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      raw = Buffer.concat(chunks);
    }
    if (raw.length === 0) throw new BadRequestException({ code: 'EMPTY_UPLOAD', message_fr: 'Le flux binaire est vide', retryable: false });
    return this.measurements.uploadRaw(id, raw, request.user);
  }

  @Post(':id/abandon')
  @Roles(UserRole.NURSE, UserRole.INTERN)
  abandon(@Param('id') id: string, @Body() dto: AbandonMeasurementDto, @Req() request: RequestWithUser) {
    return this.measurements.abandon(id, dto.reason, request.user);
  }
}
