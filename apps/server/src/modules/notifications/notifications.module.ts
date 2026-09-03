import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { MailerService } from './mailer.service';
import { CoreSettingsModule } from '../core-settings/core-settings.module';

@Module({
  imports: [TypeOrmModule.forFeature([Notification]), CoreSettingsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, MailerService],
  exports: [TypeOrmModule, NotificationsService, MailerService]
})
export class NotificationsModule {}
