import { Controller, Delete, Get, NotFoundException, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { promises as fs } from 'fs';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AuthUser } from '@document-flow/shared';
import { DatabaseService } from './database.service';

const MAX_RESTORE_BYTES = 500 * 1024 * 1024; // 500 MB 上限

@Controller('database')
export class DatabaseController {
  constructor(private readonly db: DatabaseService) {}

  @Get('info')
  @RequirePermission('database:manage')
  info() {
    return this.db.getInfo();
  }

  @Get('backups')
  @RequirePermission('database:manage')
  list() {
    return this.db.listBackups();
  }

  @Post('backups')
  @RequirePermission('database:manage')
  async create(@CurrentUser() user: AuthUser) {
    const meta = await this.db.createBackup();
    return { ok: true, ...meta, createdBy: user?.username ?? null };
  }

  @Get('backups/:filename/download')
  @RequirePermission('database:manage')
  async download(@Param('filename') filename: string, @Res() res: Response) {
    const path = await this.db.getBackupPath(filename);
    res.download(path, filename);
  }

  @Delete('backups/:filename')
  @RequirePermission('database:manage')
  async remove(@Param('filename') filename: string) {
    await this.db.deleteBackup(filename);
    return { ok: true };
  }

  @Post('restore')
  @RequirePermission('database:manage')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: tmpdir(),
        filename: (_req, file, cb) => {
          // 保留可读的文件名，仅替换不安全字符
          const safe = file.originalname.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80);
          cb(null, `${randomUUID()}-${safe}`);
        }
      }),
      limits: { fileSize: MAX_RESTORE_BYTES }
    })
  )
  async restore(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new NotFoundException('请上传备份文件');
    try {
      await this.db.restoreFromFile(file.path);
      return { ok: true, message: '数据库已恢复，请重新登录' };
    } finally {
      await fs.unlink(file.path).catch(() => undefined);
    }
  }
}