import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { AuditModule } from '../audit/audit.module';
import { Employee } from './entities/employee.entity';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({
  imports: [TypeOrmModule.forFeature([Employee]), AuditModule],
  controllers: [EmployeesController],
  providers: [
    EmployeesService,
    { provide: 'HR_PHOTO_DIR', useFactory: (config: ConfigService) => config.get<string>('hrPhotoDir') ?? './data/hr-photos', inject: [ConfigService] }
  ],
  exports: [EmployeesService]
})
export class HrModule implements OnModuleInit {
  constructor(private readonly config: ConfigService) {}
  onModuleInit() {
    fs.mkdirSync(this.config.get<string>('hrPhotoDir') ?? './data/hr-photos', { recursive: true });
  }
}