import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { HealthController } from './modules/health/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { WorkshopsModule } from './modules/workshops/workshops.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { AuditModule } from './modules/audit/audit.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SystemSettingsModule } from './modules/system-settings/system-settings.module';
import { DatabaseModule } from './modules/database/database.module';
import { CoreSettingsModule } from './modules/core-settings/core-settings.module';
import { DormitoryModule } from './modules/dormitory/dormitory.module';
import { SystemMonitorModule } from './modules/system-monitor/system-monitor.module';
import { HrModule } from './modules/hr/hr.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('databaseUrl'),
        autoLoadEntities: true,
        synchronize: process.env.NODE_ENV !== 'production' || process.env.DB_SYNC === 'true',
      })
    }),
    AuthModule,
    UsersModule,
    RolesModule,
    DepartmentsModule,
    WorkshopsModule,
    CategoriesModule,
    DocumentsModule,
    ApplicationsModule,
    WorkflowsModule,
    ApprovalsModule,
    AuditModule,
    DashboardModule,
    SystemSettingsModule,
    DatabaseModule,
    CoreSettingsModule,
    DormitoryModule,
    SystemMonitorModule,
    HrModule
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true, transform: true }) }
  ]
})
export class AppModule {}
