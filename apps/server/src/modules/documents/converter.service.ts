import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Repository } from 'typeorm';
import { ALLOWED_MIME } from './documents.storage';
import { ConversionJob } from './entities/conversion-job.entity';
import { DocumentVersion } from './entities/document-version.entity';

@Injectable()
export class ConverterService {
  constructor(
    @InjectRepository(ConversionJob) private readonly jobRepo: Repository<ConversionJob>,
    @InjectRepository(DocumentVersion) private readonly versionRepo: Repository<DocumentVersion>,
    @Inject('PREVIEW_DIR') private readonly previewDir: string
  ) {}

  async convert(jobId: string): Promise<void> {
    const job = await this.jobRepo.findOneBy({ id: jobId });
    if (!job || job.status !== 'pending') return;
    const version = await this.versionRepo.findOneBy({ id: job.documentVersionId });
    if (!version) {
      await this.fail(job, 'version missing');
      return;
    }
    const outFile = path.join(this.previewDir, `${version.id}.pdf`);
    try {
      if (version.mimeType === 'application/pdf') {
        fs.mkdirSync(this.previewDir, { recursive: true });
        fs.copyFileSync(version.filePath, outFile);
      } else {
        fs.mkdirSync(this.previewDir, { recursive: true });
        const proc = execFile('libreoffice', ['--headless', '--convert-to', 'pdf', '--outdir', this.previewDir, version.filePath]);
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => {
            try { proc.kill('SIGKILL'); } catch (_) {}
            reject(new Error('libreoffice 转换超时(90s)'));
          }, 90_000);
          let resolved = false;
          proc.on('exit', (code) => {
            clearTimeout(t);
            if (!resolved) { resolved = true; code === 0 ? resolve() : reject(new Error('libreoffice 退出码 ' + code)); }
          });
          proc.on('error', (e) => { if (!resolved) { resolved = true; clearTimeout(t); reject(e); } });
        });
        const produced = fs.readdirSync(this.previewDir).filter((f) => f.endsWith('.pdf') && f.includes(version.id));
        const src = produced[0] ?? path.join(this.previewDir, `${path.basename(version.filePath, path.extname(version.filePath))}.pdf`);
        if (src !== outFile) fs.renameSync(src, outFile);
      }
      await this.jobRepo.save({ ...job, status: 'success', previewPath: outFile, error: null });
    } catch (e) {
      await this.fail(job, String((e as Error).message));
    }
  }

  private async fail(job: ConversionJob, error: string) {
    await this.jobRepo.save({ ...job, status: 'failed', error });
  }
}