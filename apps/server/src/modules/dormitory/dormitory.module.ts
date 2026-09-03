import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Building } from './entities/building.entity';
import { Room } from './entities/room.entity';
import { Bed } from './entities/bed.entity';
import { Asset } from './entities/asset.entity';
import { Resident } from './entities/resident.entity';
import { MeterReading } from './entities/meter-reading.entity';
import { Bill } from './entities/bill.entity';
import { DormitoryService } from './dormitory.service';
import { DormitoryController } from './dormitory.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Building, Room, Bed, Asset, Resident, MeterReading, Bill])],
  providers: [DormitoryService],
  controllers: [DormitoryController]
})
export class DormitoryModule {}
