import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Building } from './entities/building.entity';
import { Room } from './entities/room.entity';
import { Bed } from './entities/bed.entity';
import { Asset } from './entities/asset.entity';
import { Resident } from './entities/resident.entity';
import { MeterReading } from './entities/meter-reading.entity';
import { Bill } from './entities/bill.entity';
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

function round2(n: number) { return Math.round(n * 100) / 100; }

@Injectable()
export class DormitoryService {
  constructor(
    @InjectRepository(Building) private readonly buildingRepo: Repository<Building>,
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
    @InjectRepository(Bed) private readonly bedRepo: Repository<Bed>,
    @InjectRepository(Asset) private readonly assetRepo: Repository<Asset>,
    @InjectRepository(Resident) private readonly residentRepo: Repository<Resident>,
    @InjectRepository(MeterReading) private readonly meterRepo: Repository<MeterReading>,
    @InjectRepository(Bill) private readonly billRepo: Repository<Bill>,
    private readonly dataSource: DataSource
  ) {}

  // ====== Buildings ======
  listBuildings() { return this.buildingRepo.find({ order: { name: 'ASC' } }); }
  async createBuilding(dto: CreateBuildingDto) {
    if (await this.buildingRepo.findOneBy({ name: dto.name })) throw new BadRequestException('楼栋名称已存在');
    return this.buildingRepo.save(this.buildingRepo.create(dto));
  }
  async updateBuilding(id: string, dto: UpdateBuildingDto) {
    const b = await this.buildingRepo.findOneBy({ id });
    if (!b) throw new NotFoundException('楼栋不存在');
    Object.assign(b, dto);
    return this.buildingRepo.save(b);
  }
  async removeBuilding(id: string) {
    const b = await this.buildingRepo.findOneBy({ id });
    if (!b) throw new NotFoundException('楼栋不存在');
    return this.buildingRepo.remove(b);
  }

  // ====== Rooms ======
  async listRooms(buildingId?: string) {
    const where = buildingId ? { buildingId } : {};
    const rooms = await this.roomRepo.find({ where, order: { buildingId: 'ASC', floor: 'ASC', roomNo: 'ASC' } });
    // 附带床位数 / 已住床位数
    const ids = rooms.map((r) => r.id);
    const bedCounts = ids.length
      ? await this.bedRepo.createQueryBuilder('b')
          .select('b.roomId', 'roomId')
          .addSelect('COUNT(*)', 'total')
          .addSelect("SUM(CASE WHEN b.status = '已住' THEN 1 ELSE 0 END)", 'occupied')
          .where('b.roomId IN (:...ids)', { ids })
          .groupBy('b.roomId')
          .getRawMany()
      : [];
    interface BedCounts { total: number; occupied: number }
    const map = new Map<string, BedCounts>();
    for (const b of bedCounts) map.set(b.roomId, { total: parseInt(b.total, 10), occupied: parseInt(b.occupied, 10) });
    return rooms.map((r) => ({ ...r, bedTotal: map.get(r.id)?.total ?? 0, bedOccupied: map.get(r.id)?.occupied ?? 0 }));
  }
  async createRoom(dto: CreateRoomDto) {
    if (!(await this.buildingRepo.findOneBy({ id: dto.buildingId }))) throw new BadRequestException('楼栋不存在');
    const dup = await this.roomRepo.findOne({ where: { buildingId: dto.buildingId, floor: dto.floor, roomNo: dto.roomNo } });
    if (dup) throw new BadRequestException('同楼栋同楼层已存在该房间号');
    return this.dataSource.transaction(async (mgr) => {
      const room = await mgr.save(mgr.create(Room, dto));
      // 按 totalBeds 自动生成床位
      const total = dto.totalBeds ?? this.defaultBedsByType(dto.type);
      const beds = Array.from({ length: total }, (_, i) => mgr.create(Bed, { roomId: room.id, bedNo: String(i + 1).padStart(2, '0'), status: '空闲' }));
      await mgr.save(beds);
      return room;
    });
  }
  defaultBedsByType(type: string) {
    if (type === '四人间') return 4;
    if (type === '双人间') return 2;
    return 1;
  }
  async updateRoom(id: string, dto: UpdateRoomDto) {
    const room = await this.roomRepo.findOneBy({ id });
    if (!room) throw new NotFoundException('房间不存在');
    const newType = dto.type ?? room.type;
    const newTotal = dto.totalBeds ?? room.totalBeds;
    Object.assign(room, dto);
    return this.dataSource.transaction(async (mgr) => {
      const saved = await mgr.save(room);
      if (newTotal !== saved.totalBeds) {
        const beds = await mgr.find(Bed, { where: { roomId: id }, order: { bedNo: 'ASC' } });
        if (beds.length < newTotal) {
          const extra = Array.from({ length: newTotal - beds.length }, (_, i) => mgr.create(Bed, { roomId: id, bedNo: String(beds.length + i + 1).padStart(2, '0'), status: '空闲' }));
          await mgr.save(extra);
        } else if (beds.length > newTotal) {
          const removable = beds.slice(newTotal).filter((b) => b.status !== '已住');
          if (removable.length !== beds.length - newTotal) throw new BadRequestException('存在已入住床位，无法减少床位数');
          await mgr.delete(Bed, { id: In(removable.map((b) => b.id)) });
        }
        saved.totalBeds = newTotal;
      }
      return saved;
    });
  }
  async removeRoom(id: string) {
    const room = await this.roomRepo.findOneBy({ id });
    if (!room) throw new NotFoundException('房间不存在');
    const occupied = await this.bedRepo.count({ where: { roomId: id, status: '已住' } });
    if (occupied > 0) throw new BadRequestException('房间存在已入住床位，无法删除');
    return this.roomRepo.remove(room);
  }

  // ====== Beds ======
  async listBeds(roomId?: string) {
    const where = roomId ? { roomId } : {};
    return this.bedRepo.find({ where, order: { roomId: 'ASC', bedNo: 'ASC' } });
  }
  async createBed(dto: CreateBedDto) {
    if (!(await this.roomRepo.findOneBy({ id: dto.roomId }))) throw new BadRequestException('房间不存在');
    const dup = await this.bedRepo.findOne({ where: { roomId: dto.roomId, bedNo: dto.bedNo } });
    if (dup) throw new BadRequestException('同房间已存在该床位号');
    return this.bedRepo.save(this.bedRepo.create(dto));
  }
  async updateBed(id: string, dto: UpdateBedDto) {
    const b = await this.bedRepo.findOneBy({ id });
    if (!b) throw new NotFoundException('床位不存在');
    if (dto.status === '已住') throw new BadRequestException('请通过入住登记将床位标记为已住');
    Object.assign(b, dto);
    return this.bedRepo.save(b);
  }
  async removeBed(id: string) {
    const b = await this.bedRepo.findOneBy({ id });
    if (!b) throw new NotFoundException('床位不存在');
    if (b.status === '已住') throw new BadRequestException('已入住床位不可删除');
    return this.bedRepo.remove(b);
  }

  // ====== Assets ======
  listAssets(roomId?: string) {
    const where = roomId ? { roomId } : {};
    return this.assetRepo.find({ where, order: { roomId: 'ASC', createdAt: 'DESC' } });
  }
  async createAsset(dto: CreateAssetDto) {
    if (!(await this.roomRepo.findOneBy({ id: dto.roomId }))) throw new BadRequestException('房间不存在');
    return this.assetRepo.save(this.assetRepo.create(dto));
  }
  async updateAsset(id: string, dto: UpdateAssetDto) {
    const a = await this.assetRepo.findOneBy({ id });
    if (!a) throw new NotFoundException('资产不存在');
    Object.assign(a, dto);
    return this.assetRepo.save(a);
  }
  async removeAsset(id: string) {
    const a = await this.assetRepo.findOneBy({ id });
    if (!a) throw new NotFoundException('资产不存在');
    return this.assetRepo.remove(a);
  }
  async reportDamage(id: string, note: string) {
    const a = await this.assetRepo.findOneBy({ id });
    if (!a) throw new NotFoundException('资产不存在');
    a.status = '损坏';
    a.damageNote = note;
    return this.assetRepo.save(a);
  }

  // ====== Residents ======
  async listResidents() {
    const list = await this.residentRepo.find({ order: { createdAt: 'DESC' } });
    const bedIds = list.map((r) => r.bedId).filter((x): x is string => !!x);
    const beds = bedIds.length ? await this.bedRepo.find({ where: { id: In(bedIds) }, relations: { room: { building: true } } }) : [];
    const map = new Map(beds.map((b) => [b.id, b]));
    return list.map((r) => {
      const b = r.bedId ? map.get(r.bedId) : null;
      const room = b?.room;
      const building = room?.building;
      return {
        ...r,
        bedNo: b?.bedNo ?? null,
        roomNo: room?.roomNo ?? null,
        floor: room?.floor ?? null,
        buildingName: building?.name ?? null,
        roomType: room?.type ?? null
      };
    });
  }
  async createResident(dto: CreateResidentDto) {
    if (await this.residentRepo.findOneBy({ employeeNo: dto.employeeNo })) throw new BadRequestException('该工号已存在入住记录');
    return this.dataSource.transaction(async (mgr) => {
      const r = await mgr.save(mgr.create(Resident, { ...dto, status: '在住' }));
      if (dto.bedId) {
        const bed = await mgr.findOne(Bed, { where: { id: dto.bedId } });
        if (!bed) throw new BadRequestException('床位不存在');
        if (bed.status === '已住') throw new BadRequestException('该床位已被占用');
        bed.status = '已住';
        await mgr.save(bed);
      }
      return r;
    });
  }
  async updateResident(id: string, dto: UpdateResidentDto) {
    const r = await this.residentRepo.findOneBy({ id });
    if (!r) throw new NotFoundException('入住记录不存在');
    return this.dataSource.transaction(async (mgr) => {
      const oldBedId = r.bedId;
      Object.assign(r, dto);
      const saved = await mgr.save(r);
      if (dto.bedId !== undefined && dto.bedId !== oldBedId) {
        if (oldBedId) {
          const oldBed = await mgr.findOne(Bed, { where: { id: oldBedId } });
          if (oldBed && oldBed.status === '已住') { oldBed.status = '空闲'; await mgr.save(oldBed); }
        }
        if (dto.bedId) {
          const newBed = await mgr.findOne(Bed, { where: { id: dto.bedId } });
          if (!newBed) throw new BadRequestException('新床位不存在');
          if (newBed.status === '已住') throw new BadRequestException('新床位已被占用');
          newBed.status = '已住'; await mgr.save(newBed);
        }
      }
      // 退宿：状态切到已退宿 + checkOutDate + 释放床位
      if (dto.status === '已退宿' && r.status === '已退宿') {
        if (r.bedId) {
          const b = await mgr.findOne(Bed, { where: { id: r.bedId } });
          if (b && b.status === '已住') { b.status = '空闲'; await mgr.save(b); }
        }
      }
      // 重新入住：状态从 已退宿 → 在住 且已有 bedId，把床位标回 已住
      if (dto.status === '在住' && saved.status === '在住' && saved.bedId) {
        const b = await mgr.findOne(Bed, { where: { id: saved.bedId } });
        if (b && b.status !== '已住') { b.status = '已住'; await mgr.save(b); }
      }
      return saved;
    });
  }
  async removeResident(id: string) {
    const r = await this.residentRepo.findOneBy({ id });
    if (!r) throw new NotFoundException('入住记录不存在');
    return this.dataSource.transaction(async (mgr) => {
      await mgr.remove(r);
      if (r.bedId) {
        const b = await mgr.findOne(Bed, { where: { id: r.bedId } });
        if (b && b.status === '已住') { b.status = '空闲'; await mgr.save(b); }
      }
    });
  }


  // ===================== 抄表 =====================
  async getLatestReading(roomId: string, period?: string) {
    const qb = this.meterRepo.createQueryBuilder('m')
      .where('m.roomId = :roomId', { roomId })
      .orderBy('m.period', 'DESC');
    if (period) qb.andWhere('m.period < :period', { period });
    return qb.getOne();
  }

  async listMeterReadings(roomId?: string, period?: string) {
    const qb = this.meterRepo.createQueryBuilder('m').orderBy('m.period', 'DESC').addOrderBy('m.roomId', 'ASC');
    if (roomId) qb.andWhere('m.roomId = :roomId', { roomId });
    if (period) qb.andWhere('m.period = :period', { period });
    return qb.getMany();
  }

  async recordMeterReading(dto: CreateMeterReadingDto) {
    if (!(await this.roomRepo.findOneBy({ id: dto.roomId }))) throw new BadRequestException('房间不存在');
    const dup = await this.meterRepo.findOne({ where: { roomId: dto.roomId, period: dto.period } });
    if (dup) throw new BadRequestException('房间 ' + dto.roomId + ' 账期 ' + dto.period + ' 已存在抄表记录');
    const prev = await this.getLatestReading(dto.roomId, dto.period);
    const electricUsage = prev ? Math.max(0, dto.electricReading - Number(prev.electricReading)) : dto.electricReading;
    const waterUsage = prev ? Math.max(0, dto.waterReading - Number(prev.waterReading)) : dto.waterReading;
    const row = this.meterRepo.create({
      roomId: dto.roomId,
      period: dto.period,
      electricReading: String(dto.electricReading),
      waterReading: String(dto.waterReading),
      electricUsage: String(electricUsage),
      waterUsage: String(waterUsage),
      publicElectricUsage: String(dto.publicElectricUsage ?? 0),
      publicWaterUsage: String(dto.publicWaterUsage ?? 0),
      readingDate: dto.readingDate,
      recordedBy: dto.recordedBy ?? null,
      notes: dto.notes ?? null
    });
    return this.meterRepo.save(row);
  }

  async updateMeterReading(id: string, dto: UpdateMeterReadingDto) {
    const r = await this.meterRepo.findOneBy({ id });
    if (!r) throw new NotFoundException('抄表记录不存在');
    if (dto.electricReading !== undefined) r.electricReading = String(dto.electricReading);
    if (dto.waterReading !== undefined) r.waterReading = String(dto.waterReading);
    if (dto.publicElectricUsage !== undefined) r.publicElectricUsage = String(dto.publicElectricUsage);
    if (dto.publicWaterUsage !== undefined) r.publicWaterUsage = String(dto.publicWaterUsage);
    if (dto.readingDate !== undefined) r.readingDate = dto.readingDate;
    if (dto.recordedBy !== undefined) r.recordedBy = dto.recordedBy;
    if (dto.notes !== undefined) r.notes = dto.notes;
    const prev = await this.getLatestReading(r.roomId, r.period);
    if (prev && prev.id !== r.id) {
      r.electricUsage = String(Math.max(0, Number(r.electricReading) - Number(prev.electricReading)));
      r.waterUsage = String(Math.max(0, Number(r.waterReading) - Number(prev.waterReading)));
    } else {
      r.electricUsage = r.electricReading;
      r.waterUsage = r.waterReading;
    }
    return this.meterRepo.save(r);
  }

  async removeMeterReading(id: string) {
    const r = await this.meterRepo.findOneBy({ id });
    if (!r) throw new NotFoundException('抄表记录不存在');
    return this.meterRepo.remove(r);
  }

  // ===================== 账单 =====================
  async generateBills(dto: GenerateBillsDto) {
    const electricRate = dto.electricRate ?? 0.6;
    const waterRate = dto.waterRate ?? 4;
    const roomRate = dto.roomRate ?? 0;

    const readings = await this.meterRepo.find({ where: { period: dto.period } });
    const readingByRoom = new Map<string, MeterReading>(readings.map(r => [r.roomId, r]));

    const residents = await this.residentRepo.find({
      where: { status: '在住' },
      relations: { bed: { room: true } }
    });
    if (residents.length === 0) throw new BadRequestException('当前无在住员工，无法生成账单');

    interface RoomGroup { roomId: string; members: typeof residents; reading?: MeterReading }
    const roomGroups = new Map<string, RoomGroup>();
    for (const r of residents) {
      if (!r.bed?.room) continue;
      const rid = r.bed.room.id;
      if (!roomGroups.has(rid)) roomGroups.set(rid, { roomId: rid, members: [] });
      roomGroups.get(rid)!.members.push(r);
    }
    for (const g of roomGroups.values()) {
      const reading = readingByRoom.get(g.roomId);
      if (reading) g.reading = reading;
    }

    const existing = await this.billRepo.find({ where: { period: dto.period } });
    const existSet = new Set(existing.map(b => b.residentId));

    const newBills: Bill[] = [];
    const skipped: { residentId: string; reason: string }[] = [];
    for (const g of roomGroups.values()) {
      const n = g.members.length;
      if (n === 0) continue;
      const publicElectricFee = g.reading ? Number(g.reading.publicElectricUsage) * electricRate / Math.max(1, n) : 0;
      const publicWaterFee = g.reading ? Number(g.reading.publicWaterUsage) * waterRate / Math.max(1, n) : 0;
      const privateElectricFee = g.reading ? Number(g.reading.electricUsage) * electricRate / Math.max(1, n) : 0;
      const privateWaterFee = g.reading ? Number(g.reading.waterUsage) * waterRate / Math.max(1, n) : 0;
      for (const member of g.members) {
        if (existSet.has(member.id)) { skipped.push({ residentId: member.id, reason: '本期账单已存在' }); continue; }
        const electricFee = round2(publicElectricFee + privateElectricFee);
        const waterFee = round2(publicWaterFee + privateWaterFee);
        const rFee = round2(roomRate);
        const total = round2(electricFee + waterFee + rFee);
        newBills.push(this.billRepo.create({
          residentId: member.id,
          period: dto.period,
          electricFee: String(electricFee),
          waterFee: String(waterFee),
          roomFee: String(rFee),
          deposit: '0',
          otherFee: '0',
          totalAmount: String(total),
          paidAmount: '0',
          status: '待缴费',
          dueDate: dto.dueDate,
          notes: dto.notes ?? null
        }));
      }
    }
    const saved = await this.billRepo.save(newBills);
    return { generated: saved.length, skipped: skipped.length, bills: saved };
  }

  async listBills(filter: { period?: string; residentId?: string; status?: string }) {
    const where: any = {};
    if (filter.period) where.period = filter.period;
    if (filter.residentId) where.residentId = filter.residentId;
    if (filter.status) where.status = filter.status;
    const bills = await this.billRepo.find({
      where,
      relations: { resident: true },
      order: { period: 'DESC', createdAt: 'DESC' }
    });
    return bills.map(b => ({
      ...b,
      resident: b.resident ? {
        id: b.resident.id, employeeNo: b.resident.employeeNo,
        name: b.resident.name, department: b.resident.department,
        bedId: b.resident.bedId
      } : null
    }));
  }

  async getBill(id: string) {
    const b = await this.billRepo.findOne({ where: { id }, relations: { resident: { bed: { room: true } } } });
    if (!b) throw new NotFoundException('账单不存在');
    return b;
  }

  async markBillPaid(id: string, dto: MarkBillPaidDto) {
    const b = await this.billRepo.findOneBy({ id });
    if (!b) throw new NotFoundException('账单不存在');
    if (b.status === '作废') throw new BadRequestException('账单已作废，无法缴费');
    const newPaid = Number(b.paidAmount) + dto.paidAmount;
    if (newPaid > Number(b.totalAmount) + 0.001) throw new BadRequestException('缴费金额超过应付');
    b.paidAmount = String(round2(newPaid));
    if (newPaid <= 0) b.status = '待缴费';
    else if (newPaid >= Number(b.totalAmount)) { b.status = '已缴费'; b.paidAt = new Date(); }
    else b.status = '部分缴费';
    if (dto.notes !== undefined) b.notes = dto.notes;
    return this.billRepo.save(b);
  }

  async voidBill(id: string) {
    const b = await this.billRepo.findOneBy({ id });
    if (!b) throw new NotFoundException('账单不存在');
    if (b.status === '已缴费') throw new BadRequestException('已缴费账单不可作废');
    b.status = '作废';
    return this.billRepo.save(b);
  }

  async arrearsList() {
    const bills = await this.billRepo.find({
      where: [{ status: '待缴费' }, { status: '部分缴费' }, { status: '逾期' }],
      relations: { resident: { bed: { room: { building: true } } } },
      order: { period: 'ASC' }
    });
    return bills.map(b => {
      const total = Number(b.totalAmount), paid = Number(b.paidAmount);
      return {
        ...b,
        arrears: round2(total - paid),
        resident: b.resident ? {
          id: b.resident.id, employeeNo: b.resident.employeeNo, name: b.resident.name,
          department: b.resident.department, phone: b.resident.phone,
          bed: b.resident.bed ? {
            bedNo: b.resident.bed.bedNo,
            room: b.resident.bed.room ? {
              roomNo: b.resident.bed.room.roomNo, floor: b.resident.bed.room.floor,
              building: b.resident.bed.room.building ? { id: b.resident.bed.room.building.id, name: b.resident.bed.room.building.name } : null
            } : null
          } : null
        } : null
      };
    });
  }

  async billStatistics(period?: string) {
    const where = period ? { period } : {};
    const bills = await this.billRepo.find({ where });
    let totalAmount = 0, paidAmount = 0, count = 0, paidCount = 0, partialCount = 0, unpaidCount = 0, overdueCount = 0, voidCount = 0;
    for (const b of bills) {
      totalAmount += Number(b.totalAmount);
      paidAmount += Number(b.paidAmount);
      count++;
      if (b.status === '已缴费') paidCount++;
      else if (b.status === '部分缴费') partialCount++;
      else if (b.status === '待缴费') unpaidCount++;
      else if (b.status === '逾期') overdueCount++;
      else if (b.status === '作废') voidCount++;
    }
    return {
      period: period ?? null,
      billCount: count,
      totalAmount: round2(totalAmount),
      paidAmount: round2(paidAmount),
      arrears: round2(totalAmount - paidAmount),
      paidCount, partialCount, unpaidCount, overdueCount, voidCount
    };
  }

  // 首页统计：楼栋 + 入住 + 当期费用概览
  async overview() {
    const [buildings, rooms, beds, residents] = await Promise.all([
      this.buildingRepo.count(),
      this.roomRepo.count(),
      this.bedRepo.count(),
      this.residentRepo.count({ where: { status: '在住' } })
    ]);
    const occupied = await this.bedRepo.count({ where: { status: '已住' } });
    const arrearsAgg = await this.billRepo
      .createQueryBuilder('b')
      .select('COALESCE(SUM(b.totalAmount - b.paidAmount), 0)', 'arrears')
      .addSelect('COUNT(*)', 'count')
      .where('b.status IN (:...statuses)', { statuses: ['待缴费', '部分缴费', '逾期'] })
      .getRawOne();
    return {
      buildings, rooms, beds,
      occupiedBeds: occupied,
      availableBeds: beds - occupied,
      residents,
      arrears: round2(Number(arrearsAgg?.arrears ?? 0)),
      arrearsCount: Number(arrearsAgg?.count ?? 0)
    };
  }
}
