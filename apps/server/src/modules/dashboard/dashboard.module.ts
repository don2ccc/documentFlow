import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalsModule } from '../approvals/approvals.module';
import { Document } from '../documents/entities/document.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([Document]), ApprovalsModule],
  controllers: [DashboardController],
  providers: [DashboardService]
})
export class DashboardModule {}