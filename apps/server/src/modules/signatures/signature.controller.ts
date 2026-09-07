import { Controller, Get, Param, Res, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ApplicationFile } from '../applications/entities/application-file.entity';
import { AuthUser } from '@document-flow/shared';
import { CurrentUser } from '../../auth/current-user.decorator';

@Controller('applications')
export class SignatureController {
  constructor(
    @InjectRepository(ApplicationFile) private readonly fileRepo: Repository<ApplicationFile>
  ) {}

  /** Download the signed version of an application file. */
  @Get(':id/files/:fileId/signed')
  async downloadSigned(
    @CurrentUser() user: AuthUser,
    @Param('id') applicationId: string,
    @Param('fileId') fileId: string,
    @Res() res: Response
  ): Promise<void> {
    const file = await this.fileRepo.findOne({ where: { id: fileId, applicationId } });
    if (!file) throw new NotFoundException('file not found');
    if (!file.signedPath) throw new NotFoundException('file has no signed version yet');
    // Anyone who can see the application can download the signed version
    try {
      const buf = await fs.readFile(file.signedPath);
      const downloadName = file.fileName.replace(/\.pdf$/i, '_signed.pdf');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
      res.setHeader('Content-Length', buf.length.toString());
      res.end(buf);
    } catch (e) {
      throw new NotFoundException(`signed file missing on disk: ${(e as Error).message}`);
    }
  }
}
