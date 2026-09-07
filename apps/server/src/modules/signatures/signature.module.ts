import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SignatureService } from './signature.service';
import { SignatureController } from './signature.controller';
import { ApplicationFile } from '../applications/entities/application-file.entity';
import { ApprovalRecord } from '../approvals/entities/approval-record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ApplicationFile, ApprovalRecord])],
  providers: [SignatureService],
  controllers: [SignatureController],
  exports: [SignatureService]
})
export class SignatureModule {}
