import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { BaselineService } from './baseline.service.js';

@Module({ imports: [AuditModule], providers: [BaselineService], exports: [BaselineService] })
export class BaselineModule {}
