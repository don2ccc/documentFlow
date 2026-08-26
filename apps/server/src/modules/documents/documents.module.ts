import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as fs from 'fs';
import { ConversionJob } from './entities/conversion-job.entity';
import { Document } from './entities/document.entity';
import { DocumentVersion } from './entities/document-version.entity';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [TypeOrmModule.forFeature([Document, DocumentVersion, ConversionJob])],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService]
})
export class DocumentsModule implements OnModuleInit {
  constructor(private readonly config: ConfigService) {}
  onModuleInit() {
    fs.mkdirSync(this.config.get<string>('uploadDir') ?? './data/documents', { recursive: true });
  }
}