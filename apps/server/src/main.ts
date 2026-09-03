import { NestFactory } from '@nestjs/core';
import type { Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { seedAdmin } from './modules/users/seed';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  // 记录所有 API 请求，便于排查前端调用问题
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      console.log(`[req] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
    });
    next();
  });
  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  await seedAdmin(app.get(DataSource)).catch((e) => console.error('seed failed:', e));
}
bootstrap();