import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkshopsController } from './workshops.controller';
import { WorkshopsService } from './workshops.service';
import { Workshop } from './entities/workshop.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Workshop])],
  controllers: [WorkshopsController],
  providers: [WorkshopsService],
  exports: [WorkshopsService]
})
export class WorkshopsModule {}
