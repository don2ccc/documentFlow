import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceDaily } from './entities/attendance-daily.entity';
import { AttendancePunch } from './entities/attendance-punch.entity';
import { AttendanceShift } from './entities/attendance-shift.entity';
import { AttendanceUpload } from './entities/attendance-upload.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AttendanceShift, AttendanceUpload, AttendancePunch, AttendanceDaily]),
    AuditModule
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService]
})
export class AttendanceModule {}
