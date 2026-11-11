import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PatientsService } from './patients.service.js';
import {
  CreatePatientDto,
  RebaselineDto,
  CreateNoteDto,
  CreateFollowUpIntentDto,
} from './patients.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../../common/roles.guard.js';
import { Roles } from '../../common/roles.decorator.js';

interface RequestWithUser {
  user: {
    sub: string;
    role: string;
    email: string;
  };
}

@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientsController {
  constructor(private patientsService: PatientsService) {}

  @Get()
  @Roles(UserRole.NURSE, UserRole.NEPHROLOGIST)
  async findAll() {
    return this.patientsService.findAll();
  }

  @Post()
  @Roles(UserRole.NURSE, UserRole.NEPHROLOGIST)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreatePatientDto) {
    return this.patientsService.create(dto);
  }

  @Get(':idPseudo')
  @Roles(UserRole.NURSE, UserRole.NEPHROLOGIST)
  async findOne(@Param('idPseudo') idPseudo: string) {
    return this.patientsService.findByIdPseudo(idPseudo);
  }

  @Get(':idPseudo/history')
  @Roles(UserRole.NURSE, UserRole.NEPHROLOGIST)
  async getHistory(@Param('idPseudo') idPseudo: string) {
    return this.patientsService.getHistory(idPseudo);
  }

  @Post(':idPseudo/rebaseline')
  @Roles(UserRole.NEPHROLOGIST)
  @HttpCode(HttpStatus.OK)
  async rebaseline(
    @Param('idPseudo') idPseudo: string,
    @Body() dto: RebaselineDto,
    @Req() req: RequestWithUser,
  ) {
    return this.patientsService.rebaseline(idPseudo, dto, req.user.sub);
  }

  @Post(':idPseudo/notes')
  @Roles(UserRole.NEPHROLOGIST)
  @HttpCode(HttpStatus.CREATED)
  async addNote(
    @Param('idPseudo') idPseudo: string,
    @Body() dto: CreateNoteDto,
    @Req() req: RequestWithUser,
  ) {
    return this.patientsService.addNote(idPseudo, dto, req.user.sub);
  }

  @Get(':idPseudo/notes')
  @Roles(UserRole.NEPHROLOGIST)
  async getNotes(@Param('idPseudo') idPseudo: string) {
    return this.patientsService.getNotes(idPseudo);
  }

  @Get(':idPseudo/follow-ups')
  @Roles(UserRole.NEPHROLOGIST)
  async getFollowUps(@Param('idPseudo') idPseudo: string) {
    return this.patientsService.getFollowUps(idPseudo);
  }

  @Get(':idPseudo/baseline-versions')
  @Roles(UserRole.NEPHROLOGIST)
  async getBaselineVersions(@Param('idPseudo') idPseudo: string) {
    return this.patientsService.getBaselineVersions(idPseudo);
  }

  @Post(':idPseudo/follow-up-intents')
  @Roles(UserRole.NEPHROLOGIST)
  @HttpCode(HttpStatus.CREATED)
  async recordFollowUpIntent(
    @Param('idPseudo') idPseudo: string,
    @Body() dto: CreateFollowUpIntentDto,
    @Req() req: RequestWithUser,
  ) {
    return this.patientsService.recordFollowUpIntent(idPseudo, dto, req.user.sub);
  }
}
