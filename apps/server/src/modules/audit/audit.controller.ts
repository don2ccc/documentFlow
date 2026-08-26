import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AuditService } from './audit.service';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission('audit:view')
  findAll(@Query() query: { page?: number; pageSize?: number; actorId?: string; action?: string }) {
    return this.audit.findAll(query);
  }
}