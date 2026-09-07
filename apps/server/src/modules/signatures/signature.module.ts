import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SignatureService } from './signature.service';
import { SignatureController } from './signature.controller';
import { UserSignatureService } from './user-signature.service';
import { UserSignatureController } from './user-signature.controller';
import { ApplicationFile } from '../applications/entities/application-file.entity';
import { ApprovalRecord } from '../approvals/entities/approval-record.entity';
import { UserSignature } from '../users/entities/user-signature.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ApplicationFile, ApprovalRecord, UserSignature])],
  providers: [SignatureService, UserSignatureService],
  controllers: [SignatureController, UserSignatureController],
  exports: [SignatureService, UserSignatureService]
})
export class SignatureModule {}
