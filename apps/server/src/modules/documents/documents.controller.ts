import { BadRequestException, Body, Controller, Get, Param, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { AuthUser } from '@document-flow/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CreateVersionDto } from './dto/create-version.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentsService } from './documents.service';
import { ALLOWED_MIME, MAX_FILE_SIZE } from './documents.storage';

const storage = diskStorage({
  destination: (_req, _file, cb) => cb(null, process.env.UPLOAD_DIR || './data/documents'),
  filename: (_req, file, cb) => {
    const ext = ALLOWED_MIME[file.mimetype] ?? 'bin';
    cb(null, `${randomUUID()}.${ext}`);
  }
});

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { storage, limits: { fileSize: MAX_FILE_SIZE } }))
  @RequirePermission('document:upload')
  upload(@UploadedFile() file: Express.Multer.File | undefined, @Body() dto: UploadDocumentDto, @CurrentUser() user: AuthUser) {
    if (!file) throw new BadRequestException('请上传文件');
    return this.documents.upload(user.id, file, dto);
  }

  @Get(':id')
  getDetail(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.documents.getDetail(user, id);
  }

  @Get()
  @RequirePermission('document:upload')
  findMy(@Query() query: any, @CurrentUser() user: AuthUser) {
    return this.documents.findVisible(user.id, query);
  }

  @Post(':id/versions')
  @UseInterceptors(FileInterceptor('file', { storage, limits: { fileSize: MAX_FILE_SIZE } }))
  @RequirePermission('document:upload')
  addVersion(@Param('id') id: string, @UploadedFile() file: Express.Multer.File | undefined, @Body() dto: CreateVersionDto, @CurrentUser() user: AuthUser) {
    if (!file) throw new BadRequestException('请上传文件');
    return this.documents.addVersion(user.id, id, file, dto);
  }

  @Get(':id/versions/:versionId/preview')
  preview(@Param('id') id: string, @Param('versionId') versionId: string, @CurrentUser() user: AuthUser, @Res() res: any) {
    return this.documents.streamPreview(user, id, versionId, res);
  }

  @Post('versions/:versionId/retry-convert')
  retryConvert(@Param('versionId') versionId: string, @CurrentUser() user: AuthUser) {
    return this.documents.retryConvert(user, versionId);
  }

  @Get(':id/versions')
  listVersions(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.documents.listVersions(user, id);
  }

  @Get(':id/versions/:versionId/download')
  download(@Param('id') id: string, @Param('versionId') versionId: string, @CurrentUser() user: AuthUser, @Res() res: any) {
    return this.documents.streamDownload(user, id, versionId, res);
  }
}