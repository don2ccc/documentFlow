import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { promises as fs } from 'fs';
import * as path from 'path';
import { UserSignature } from '../users/entities/user-signature.entity';

const USER_SIG_DIR = process.env.SIGNATURE_DIR || '/opt/documentflow/uploads/signatures';
const ALLOWED_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg'
};
const MAX_SIZE = 2 * 1024 * 1024;

export interface UserSignatureDto {
  hasSignature: boolean;
  fileName?: string;
  mimeType?: string;
  size?: number;
  url?: string;
  createdAt?: string;
}

@Injectable()
export class UserSignatureService {
  private readonly log = new Logger(UserSignatureService.name);

  constructor(
    @InjectRepository(UserSignature) private readonly repo: Repository<UserSignature>
  ) {}

  async get(userId: string): Promise<UserSignatureDto> {
    const row = await this.repo.findOne({ where: { userId } });
    if (!row) return { hasSignature: false };
    return {
      hasSignature: true,
      fileName: row.fileName,
      mimeType: row.mimeType,
      size: row.size,
      url: `/users/me/signature/raw?_t=${row.createdAt.getTime()}`,
      createdAt: row.createdAt.toISOString()
    };
  }

  async upload(userId: string, file: Express.Multer.File): Promise<UserSignatureDto> {
    if (!file) throw new Error('no file uploaded');
    if (!ALLOWED_MIME[file.mimetype]) {
      throw new Error('仅支持 PNG / JPG 图片');
    }
    if (file.size > MAX_SIZE) {
      throw new Error('图片不能超过 2MB');
    }
    const ext = ALLOWED_MIME[file.mimetype];
    const userDir = path.join(USER_SIG_DIR, userId);
    await fs.mkdir(userDir, { recursive: true });
    const filename = `${Date.now()}.${ext}`;
    const fullPath = path.join(userDir, filename);

    // Best-effort delete previous file (any extension)
    const prev = await this.repo.findOne({ where: { userId } });
    if (prev) {
      try { await fs.unlink(prev.filePath); } catch (e) { /* ignore */ }
    }

    await fs.writeFile(fullPath, file.buffer);

    if (prev) {
      // Update in place (unique on userId)
      await this.repo.update({ userId }, {
        fileName: file.originalname,
        filePath: fullPath,
        mimeType: file.mimetype,
        size: file.size,
        createdAt: new Date()
      });
    } else {
      await this.repo.save(this.repo.create({
        userId,
        fileName: file.originalname,
        filePath: fullPath,
        mimeType: file.mimetype,
        size: file.size
      }));
    }
    return this.get(userId);
  }

  async remove(userId: string): Promise<{ ok: true }> {
    const row = await this.repo.findOne({ where: { userId } });
    if (!row) return { ok: true };
    try { await fs.unlink(row.filePath); } catch (e) { /* ignore */ }
    await this.repo.delete({ userId });
    return { ok: true };
  }

  /** Used by SignatureService to read the raw image bytes for stamping. */
  async getRawForUser(userId: string): Promise<{ bytes: Buffer; mimeType: string } | null> {
    const row = await this.repo.findOne({ where: { userId } });
    if (!row) return null;
    try {
      const bytes = await fs.readFile(row.filePath);
      return { bytes, mimeType: row.mimeType };
    } catch (e) {
      this.log.warn(`signature file missing for user ${userId}: ${(e as Error).message}`);
      return null;
    }
  }

  /** Static handler for the GET raw endpoint - streams the file with proper headers. */
  async readRawForUser(userId: string): Promise<{ bytes: Buffer; mimeType: string; fileName: string } | null> {
    const row = await this.repo.findOne({ where: { userId } });
    if (!row) return null;
    try {
      const bytes = await fs.readFile(row.filePath);
      return { bytes, mimeType: row.mimeType, fileName: row.fileName };
    } catch (e) { return null; }
  }
}
