import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { DormitoryService } from './dormitory.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { CreateBedDto } from './dto/create-bed.dto';
import { UpdateBedDto } from './dto/update-bed.dto';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { CreateResidentDto } from './dto/create-resident.dto';
import { UpdateResidentDto } from './dto/update-resident.dto';
import { CreateMeterReadingDto } from './dto/create-meter-reading.dto';
import { UpdateMeterReadingDto } from './dto/update-meter-reading.dto';
import { GenerateBillsDto } from './dto/generate-bills.dto';
import { MarkBillPaidDto } from './dto/mark-bill-paid.dto';

@Controller('dormitory')
export class DormitoryController {
  constructor(private readonly svc: DormitoryService) {}

  @Get('overview')
  @RequirePermission('dormitory:manage')
  overview() { return this.svc.overview(); }

  // Buildings
  @Get('buildings')
  @RequirePermission('dormitory:manage')
  listBuildings() { return this.svc.listBuildings(); }

  @Post('buildings')
  @RequirePermission('dormitory:manage')
  createBuilding(@Body() dto: CreateBuildingDto) { return this.svc.createBuilding(dto); }

  @Patch('buildings/:id')
  @RequirePermission('dormitory:manage')
  updateBuilding(@Param('id') id: string, @Body() dto: UpdateBuildingDto) { return this.svc.updateBuilding(id, dto); }

  @Delete('buildings/:id')
  @RequirePermission('dormitory:manage')
  removeBuilding(@Param('id') id: string) { return this.svc.removeBuilding(id); }

  // Rooms
  @Get('rooms')
  @RequirePermission('dormitory:manage')
  listRooms(@Query('buildingId') buildingId?: string) { return this.svc.listRooms(buildingId); }

  @Post('rooms')
  @RequirePermission('dormitory:manage')
  createRoom(@Body() dto: CreateRoomDto) { return this.svc.createRoom(dto); }

  @Patch('rooms/:id')
  @RequirePermission('dormitory:manage')
  updateRoom(@Param('id') id: string, @Body() dto: UpdateRoomDto) { return this.svc.updateRoom(id, dto); }

  @Delete('rooms/:id')
  @RequirePermission('dormitory:manage')
  removeRoom(@Param('id') id: string) { return this.svc.removeRoom(id); }

  // Beds
  @Get('beds')
  @RequirePermission('dormitory:manage')
  listBeds(@Query('roomId') roomId?: string) { return this.svc.listBeds(roomId); }

  @Post('beds')
  @RequirePermission('dormitory:manage')
  createBed(@Body() dto: CreateBedDto) { return this.svc.createBed(dto); }

  @Patch('beds/:id')
  @RequirePermission('dormitory:manage')
  updateBed(@Param('id') id: string, @Body() dto: UpdateBedDto) { return this.svc.updateBed(id, dto); }

  @Delete('beds/:id')
  @RequirePermission('dormitory:manage')
  removeBed(@Param('id') id: string) { return this.svc.removeBed(id); }

  // Assets
  @Get('assets')
  @RequirePermission('dormitory:manage')
  listAssets(@Query('roomId') roomId?: string) { return this.svc.listAssets(roomId); }

  @Post('assets')
  @RequirePermission('dormitory:manage')
  createAsset(@Body() dto: CreateAssetDto) { return this.svc.createAsset(dto); }

  @Patch('assets/:id')
  @RequirePermission('dormitory:manage')
  updateAsset(@Param('id') id: string, @Body() dto: UpdateAssetDto) { return this.svc.updateAsset(id, dto); }

  @Delete('assets/:id')
  @RequirePermission('dormitory:manage')
  removeAsset(@Param('id') id: string) { return this.svc.removeAsset(id); }

  @Post('assets/:id/damage')
  @RequirePermission('dormitory:manage')
  reportDamage(@Param('id') id: string, @Body() body: { note: string }) {
    return this.svc.reportDamage(id, body?.note ?? '');
  }

  // Residents
  @Get('residents')
  @RequirePermission('dormitory:manage')
  listResidents() { return this.svc.listResidents(); }

  @Post('residents')
  @RequirePermission('dormitory:manage')
  createResident(@Body() dto: CreateResidentDto) { return this.svc.createResident(dto); }

  @Patch('residents/:id')
  @RequirePermission('dormitory:manage')
  updateResident(@Param('id') id: string, @Body() dto: UpdateResidentDto) { return this.svc.updateResident(id, dto); }

  @Delete('residents/:id')
  @RequirePermission('dormitory:manage')
  removeResident(@Param('id') id: string) { return this.svc.removeResident(id); }

  // ====== 抄表 ======
  @Get('meter-readings')
  @RequirePermission('dormitory:manage')
  listMeterReadings(@Query('roomId') roomId?: string, @Query('period') period?: string) {
    return this.svc.listMeterReadings(roomId, period);
  }

  @Post('meter-readings')
  @RequirePermission('dormitory:manage')
  recordMeterReading(@Body() dto: CreateMeterReadingDto) { return this.svc.recordMeterReading(dto); }

  @Patch('meter-readings/:id')
  @RequirePermission('dormitory:manage')
  updateMeterReading(@Param('id') id: string, @Body() dto: UpdateMeterReadingDto) {
    return this.svc.updateMeterReading(id, dto);
  }

  @Delete('meter-readings/:id')
  @RequirePermission('dormitory:manage')
  removeMeterReading(@Param('id') id: string) { return this.svc.removeMeterReading(id); }

  // ====== 账单 ======
  @Post('bills/generate')
  @RequirePermission('dormitory:manage')
  generateBills(@Body() dto: GenerateBillsDto) { return this.svc.generateBills(dto); }

  @Get('bills')
  @RequirePermission('dormitory:manage')
  listBills(@Query('period') period?: string, @Query('residentId') residentId?: string, @Query('status') status?: string) {
    return this.svc.listBills({ period, residentId, status });
  }

  @Get('bills/arrears')
  @RequirePermission('dormitory:manage')
  arrearsList() { return this.svc.arrearsList(); }

  @Get('bills/statistics')
  @RequirePermission('dormitory:manage')
  billStatistics(@Query('period') period?: string) { return this.svc.billStatistics(period); }

  @Get('bills/:id')
  @RequirePermission('dormitory:manage')
  getBill(@Param('id') id: string) { return this.svc.getBill(id); }

  @Post('bills/:id/pay')
  @RequirePermission('dormitory:manage')
  markBillPaid(@Param('id') id: string, @Body() dto: MarkBillPaidDto) { return this.svc.markBillPaid(id, dto); }

  @Post('bills/:id/void')
  @RequirePermission('dormitory:manage')
  voidBill(@Param('id') id: string) { return this.svc.voidBill(id); }
}

