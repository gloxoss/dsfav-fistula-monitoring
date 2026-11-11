import {
  Body,
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/roles.decorator.js';
import { RolesGuard } from '../../common/roles.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import {
  CompleteBenchCaptureDto,
  CreateBenchSessionDto,
  ImportBenchCsvDto,
  SubmitBenchPalpationDto,
} from './bench.dto.js';
import { BenchService } from './bench.service.js';
import { analyzeBenchCsv } from './bench.import.js';

interface RequestWithUser {
  user: { sub: string; role: string };
}

@Controller('bench/sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BenchController {
  constructor(private readonly bench: BenchService) {}

  @Get()
  @Roles(UserRole.INTERN, UserRole.NEPHROLOGIST)
  list(@Req() request: RequestWithUser) {
    return this.bench.list(request.user);
  }

  @Post()
  @Roles(UserRole.INTERN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateBenchSessionDto, @Req() request: RequestWithUser) {
    return this.bench.create(dto, request.user);
  }

  @Post(':id/palpation')
  @Roles(UserRole.INTERN)
  @HttpCode(HttpStatus.OK)
  palpation(
    @Param('id') id: string,
    @Body() dto: SubmitBenchPalpationDto,
    @Req() request: RequestWithUser,
  ) {
    return this.bench.submitPalpation(id, dto, request.user);
  }

  @Post(':id/capture')
  @Roles(UserRole.INTERN)
  @HttpCode(HttpStatus.OK)
  capture(
    @Param('id') id: string,
    @Body() dto: CompleteBenchCaptureDto,
    @Req() request: RequestWithUser,
  ) {
    return this.bench.capture(id, dto, request.user);
  }
}

@Controller('bench/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BenchReportsController {
  @Post('import')
  @Roles(UserRole.INTERN, UserRole.NEPHROLOGIST)
  @HttpCode(HttpStatus.OK)
  import(@Body() dto: ImportBenchCsvDto) {
    try {
      return analyzeBenchCsv(dto.csvContent);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Impossible de lire le CSV du banc');
    }
  }
}
