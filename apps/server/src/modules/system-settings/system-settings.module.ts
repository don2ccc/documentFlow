import { Module } from '@nestjs/common';
import { CoreSettingsModule } from '../core-settings/core-settings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SystemSettingsController } from './system-settings.controller';

@Module({
  imports: [CoreSettingsModule, NotificationsModule],
  controllers: [SystemSettingsController]
})
export class SystemSettingsModule {}
