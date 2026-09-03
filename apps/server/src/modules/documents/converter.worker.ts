import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConverterService } from './converter.service';
import { ConversionJob } from './entities/conversion-job.entity';

@Injectable()
export class ConverterWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConverterWorker.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(ConversionJob) private readonly jobRepo: Repository<ConversionJob>,
    private readonly converter: ConverterService
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.runOnce(), 30_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(): Promise<void> {
    const job = await this.jobRepo.findOneBy({ status: 'pending' });
    if (!job) return;
    try {
      await this.converter.convert(job.id);
    } catch (e) {
      this.logger.error(`convert job ${job.id} failed: ${String((e as Error).message)}`);
    }
  }
}