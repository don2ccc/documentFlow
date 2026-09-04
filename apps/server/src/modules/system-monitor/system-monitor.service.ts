import { Injectable, Logger } from "@nestjs/common";
import { promises as fs } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface StorageInfo {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usagePercent: number;
  path: string;
}

@Injectable()
export class SystemMonitorService {
  private readonly logger = new Logger(SystemMonitorService.name);
  private cache: { value: StorageInfo; expiresAt: number } | null = null;
  private readonly cacheTtlMs = 5_000;
  private readonly path = "/";

  async getStorage(): Promise<StorageInfo> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache.value;
    }
    let info: StorageInfo;
    try {
      info = await this.statFsFallback();
    } catch (err) {
      this.logger.warn(`statfs failed, falling back to df: ${(err as Error).message}`);
      info = await this.dfFallback();
    }
    this.cache = { value: info, expiresAt: now + this.cacheTtlMs };
    return info;
  }

  private async statFsFallback(): Promise<StorageInfo> {
    const stats = await fs.statfs(this.path);
    const totalBytes = Number(stats.blocks) * Number(stats.bsize);
    const freeBytes = Number(stats.bavail) * Number(stats.bsize);
    const usedBytes = totalBytes - freeBytes;
    return this.makeInfo(totalBytes, usedBytes, freeBytes);
  }

  private async dfFallback(): Promise<StorageInfo> {
    const { stdout } = await execFileAsync("df", ["-k", this.path], { timeout: 2000 });
    const lines = stdout.trim().split("\n");
    const last = lines[lines.length - 1].split(/\s+/);
    const totalBytes = Number(last[1]) * 1024;
    const freeBytes = Number(last[3]) * 1024;
    const usedBytes = Number(last[2]) * 1024;
    return this.makeInfo(totalBytes, usedBytes, freeBytes);
  }

  private makeInfo(totalBytes: number, usedBytes: number, freeBytes: number): StorageInfo {
    return {
      totalBytes,
      usedBytes,
      freeBytes,
      usagePercent: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0,
      path: this.path
    };
  }
}
