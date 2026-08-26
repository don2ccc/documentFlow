import { NestFactory } from '@nestjs/core';

import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { seedAdmin } from './modules/users/seed';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  await seedAdmin(app.get(DataSource)).catch((e) => console.error('seed failed:', e));
}
bootstrap();