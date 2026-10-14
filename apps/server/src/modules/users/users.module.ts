import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../roles/entities/role.entity';
import { AuditModule } from '../audit/audit.module';
import { CoreSettingsModule } from '../core-settings/core-settings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role]), AuditModule, NotificationsModule, CoreSettingsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService]
})
export class UsersModule {}