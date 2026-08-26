import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionsController } from './permissions.controller';
import { RolesController } from './roles.controller';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { RolesService } from './roles.service';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission])],
  controllers: [RolesController, PermissionsController],
  providers: [RolesService],
  exports: [RolesService]
})
export class RolesModule {}