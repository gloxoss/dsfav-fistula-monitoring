import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/roles.decorator.js';
import { RolesGuard } from '../../common/roles.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AuditService } from './audit.service.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Roles(UserRole.NEPHROLOGIST, UserRole.ADMIN)
  list(
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('from') fromValue?: string,
    @Query('to') toValue?: string,
    @Query('limit') limitValue?: string,
    @Query('cursor') cursor?: string,
  ) {
    const from = this.parseDate(fromValue);
    const to = this.parseDate(toValue);
    if (from && to && from > to) {
      throw new BadRequestException({ code: 'INVALID_DATE_RANGE', message_fr: 'La période demandée est invalide.', retryable: false });
    }
    let limit = 50;
    if (limitValue !== undefined) {
      const parsed = parseInt(limitValue, 10);
      if (Number.isNaN(parsed) || parsed < 1) {
        throw new BadRequestException({ code: 'INVALID_LIMIT', message_fr: 'Le paramètre limit est invalide.', retryable: false });
      }
      limit = Math.min(parsed, 200);
    }
    return this.audit.list({ action, entity, entityId, from, to, limit, cursor });
  }

  private parseDate(value?: string): Date | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException({ code: 'INVALID_DATE', message_fr: 'La date demandée est invalide.', retryable: false });
    }
    return date;
  }
}
