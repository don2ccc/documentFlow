import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { AuthUser } from '@document-flow/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ApplicationsService } from './applications.service';
import * as path from 'path';
import { ALLOWED_MIME, MAX_FILE_SIZE } from '../documents/documents.storage';

const storage = diskStorage({
  destination: (_req, _file, cb) => cb(null, process.env.UPLOAD_DIR || './data/documents'),
  filename: (_req, file, cb) => {
    const ext = ALLOWED_MIME[file.mimetype] ?? 'bin';
    cb(null, `${randomUUID()}.${ext}`);
  }
});

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('files', 20, { storage, limits: { fileSize: MAX_FILE_SIZE } }))
  @RequirePermission('document:upload')
  async create(
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Body() dto: CreateApplicationDto,
    @CurrentUser() user: AuthUser
  ) {
    if (!files || files.length === 0) throw new BadRequestException('请至少上传一个文件');
    return this.applications.create(user, files, dto);
  }

  @Get()
  @RequirePermission('document:upload', 'application:query')
  list(@CurrentUser() user: AuthUser, @Query() q: { status?: string; keyword?: string; page?: string; pageSize?: string; ownerOnly?: string }) {
    return this.applications.list(user, {
      status: q.status,
      keyword: q.keyword,
      page: q.page ? Number(q.page) : undefined,
      pageSize: q.pageSize ? Number(q.pageSize) : undefined,
      ownerOnly: q.ownerOnly === 'true'
    });
  }

  @Get('query')
  @RequirePermission('document:upload', 'application:query')
  query(
    @CurrentUser() user: AuthUser,
    @Query() q: { keyword?: string; status?: string; categoryId?: string; startDate?: string; endDate?: string; scope?: string; page?: string; pageSize?: string }
  ) {
    return this.applications.queryApplications(user, {
      keyword: q.keyword,
      status: q.status,
      categoryId: q.categoryId,
      startDate: q.startDate,
      endDate: q.endDate,
      scope: (q.scope as 'all' | 'created' | 'reviewed' | undefined),
      page: q.page ? Number(q.page) : undefined,
      pageSize: q.pageSize ? Number(q.pageSize) : undefined
    });
  }

  @Get(':id')
  @RequirePermission('document:upload', 'application:query')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.applications.getById(user, id);
  }

  @Get(':id/files/:fileId/download')
  async download(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: any
  ) {
    const f = await this.applications.getFile(user, id, fileId);
    res.setHeader('Content-Type', f.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8\'\'${encodeURIComponent(f.fileName)}`);
    res.sendFile(path.resolve(f.filePath));
  }

  @Get(':id/files/:fileId/preview')
  @RequirePermission('document:preview')
  preview(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: any
  ) {
    return this.applications.streamPreview(user, id, fileId, res);
  }

  @Delete(':id')
  @RequirePermission('user:manage')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.applications.remove(user, id);
  }

  @Post(':id/withdraw')
  @RequirePermission('document:upload')
  withdraw(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.applications.withdraw(user, id);
  }

  @Post(':id/remind')
  @RequirePermission('document:upload')
  remind(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.applications.remind(user, id);
  }

  @Post(':id/submit')
  @RequirePermission('document:upload')
  submit(@Param('id') id: string, @Body() body: { workflowId: string }, @CurrentUser() user: AuthUser) {
    return this.applications.submit(user, id, body.workflowId);
  }
}
