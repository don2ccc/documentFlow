import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { existsSync, promises as fs } from 'fs';
import { join } from 'path';

export interface BackupMeta {
  filename: string;
  size: number;
  createdAt: string;
}

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly backupDir: string;
  private readonly filenameRe = /^backup-\d{8}-\d{6}\.sql$/;

  constructor(private readonly config: ConfigService) {
    // 与 UPLOAD_DIR / PREVIEW_DIR 一致放在 data/ 下，部署到 docker 时保持相对路径
    this.backupDir = join(process.cwd(), 'data', 'backups');
  }

  private async ensureBackupDir(): Promise<void> {
    await fs.mkdir(this.backupDir, { recursive: true });
  }

  private parseDbUrl() {
    const url = this.config.get<string>('databaseUrl')!;
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port || '5432',
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, '')
    };
  }

  private runProc(cmd: string, args: string[], password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const env = { ...process.env, PGPASSWORD: password };
      const proc = spawn(cmd, args, { env });
      let stderr = '';
      proc.stderr.on('data', (d) => {
        stderr += d.toString();
      });
      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderr.trim() || `${cmd} exited ${code}`));
      });
    });
  }

  async createBackup(): Promise<BackupMeta> {
    await this.ensureBackupDir();
    const ts = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const filename = `backup-${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.sql`;
    const fullPath = join(this.backupDir, filename);
    const cfg = this.parseDbUrl();
    this.logger.log(`Creating backup -> ${fullPath}`);
    // plain text format, no owner / privileges, include blobs
    await this.runProc('pg_dump', [
      '-h', cfg.host,
      '-p', cfg.port,
      '-U', cfg.user,
      '-d', cfg.database,
      '-F', 'p',
      '-b',
      '--clean',
      '--if-exists',
      '-f', fullPath,
      '--no-owner',
      '--no-privileges'
    ], cfg.password);
    const stat = await fs.stat(fullPath);
    return { filename, size: stat.size, createdAt: ts.toISOString() };
  }

  async listBackups(): Promise<BackupMeta[]> {
    await this.ensureBackupDir();
    const files = await fs.readdir(this.backupDir);
    const out: BackupMeta[] = [];
    for (const f of files) {
      if (!this.filenameRe.test(f)) continue;
      const p = join(this.backupDir, f);
      const s = await fs.stat(p);
      out.push({ filename: f, size: s.size, createdAt: s.mtime.toISOString() });
    }
    out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return out;
  }

  async getBackupPath(filename: string): Promise<string> {
    if (!this.filenameRe.test(filename)) {
      throw new BadRequestException('非法的备份文件名');
    }
    const fullPath = join(this.backupDir, filename);
    if (!existsSync(fullPath)) throw new NotFoundException('备份文件不存在');
    return fullPath;
  }

  async deleteBackup(filename: string): Promise<void> {
    const fullPath = await this.getBackupPath(filename);
    await fs.unlink(fullPath);
  }

  async restoreFromFile(filePath: string): Promise<void> {
    const cfg = this.parseDbUrl();
    this.logger.warn(`Restoring database ${cfg.database} from ${filePath}`);
    // pg_dump 以 --clean --if-exists 输出，每条 CREATE 前面自带 DROP，安全幂等。
    // ON_ERROR_STOP=1 保证首条失败立即终止，避免半截恢复。
    await this.runProc('psql', [
      '-h', cfg.host,
      '-p', cfg.port,
      '-U', cfg.user,
      '-d', cfg.database,
      '-v', 'ON_ERROR_STOP=1',
      '-f', filePath
    ], cfg.password);
  }

  async getInfo() {
    const cfg = this.parseDbUrl();
    const backups = await this.listBackups();
    const totalSize = backups.reduce((acc, b) => acc + b.size, 0);
    return {
      host: cfg.host,
      port: cfg.port,
      database: cfg.database,
      user: cfg.user,
      backupCount: backups.length,
      backupTotalSize: totalSize
    };
  }
}