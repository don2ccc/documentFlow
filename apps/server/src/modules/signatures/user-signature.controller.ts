import {
  BadRequestException, Controller, Delete, Get, Param, Post, Res, UploadedFile, UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '@document-flow/shared';
import { UserSignatureService } from './user-signature.service';

@Controller('users/me/signature')
export class UserSignatureController {
  constructor(private readonly sig: UserSignatureService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.sig.get(user.id);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }))
  async upload(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File) {
    try {
      return await this.sig.upload(user.id, file);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Delete()
  async remove(@CurrentUser() user: AuthUser) {
    return this.sig.remove(user.id);
  }

  // Stream the raw image for <img src> preview (authenticated via JWT cookie/header)
  @Get('raw')
  async raw(@CurrentUser() user: AuthUser, @Res() res: any) {
    const data = await this.sig.readRawForUser(user.id);
    if (!data) {
      res.status(404).json({ message: 'no signature' });
      return;
    }
    res.setHeader('Content-Type', data.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(data.fileName)}"`);
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    res.end(data.bytes);
  }
}
