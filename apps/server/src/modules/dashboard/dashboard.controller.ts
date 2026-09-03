import { Controller, Get } from '@nestjs/common';
import { AuthUser } from '@document-flow/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  @RequirePermission('dashboard:view')
  summary(@CurrentUser() user: AuthUser) {
    return this.dashboard.summary(user);
  }
}