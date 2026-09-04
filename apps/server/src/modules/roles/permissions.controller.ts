import { Controller, Get } from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RolesService } from './roles.service';

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermission('user:manage', 'role:manage', 'workflow:manage', 'department:manage')
  findAll() {
    return this.roles.findAllPermissions();
  }
}