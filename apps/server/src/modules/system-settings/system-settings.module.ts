import { Module } from '@nestjs/common';
import { CoreSettingsModule } from '../core-settings/core-settings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SystemSettingsController } from './system-settings.controller';
import { SmtpCertService } from './smtp-cert.service';

@Module({
  imports: [CoreSettingsModule, NotificationsModule],
  controllers: [SystemSettingsController],
  providers: [SmtpCertService],
  exports: [SmtpCertService]
})
export class SystemSettingsModule {}