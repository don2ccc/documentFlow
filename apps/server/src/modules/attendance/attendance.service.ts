import {
  BadRequestException, ConflictException, Injectable, Logger, NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { computeDailyResults, validateSegments } from './attendance-calc';
import { buildAttendanceExport, parseAttendanceFile } from './attendance-excel';
import { CreateShiftDto } from './dto/create-shift.dto';
import { ListResultsQueryDto } from './dto/list-results-query.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { AttendanceDaily } from './entities/attendance-daily.entity';
import { AttendancePunch } from './entities/attendance-punch.entity';
import { AttendanceShift } from './entities/attendance-shift.entity';
import { AttendanceUpload } from './entities/attendance-upload.entity';

export const MAX_ATTENDANCE_FILE_SIZE = 20 * 1024 * 1024;
const MAX_ROWS = 100_000;

interface UploaderInfo {
  id: string;
  username: string;
}

/**
 * multer/busboy 按 latin1 解码 multipart 文件名，中文会变成乱码。
 * 已经是中文的文件名保持原样，只有明显乱码时才转回 UTF-8。
 */
function decodeFileName(name: string): string {
  if (!name || /[\u4e00-\u9fa5]/.test(name)) return name;
  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    return /\uFFFD/.test(decoded) ? name : decoded;
  } catch {
    return name;
  }
}

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    @InjectRepository(AttendanceShift) private readonly shifts: Repository<AttendanceShift>,
    @InjectRepository(AttendanceUpload) private readonly uploads: Repository<AttendanceUpload>,
    @InjectRepository(AttendancePunch) private readonly punches: Repository<AttendancePunch>,
    @InjectRepository(AttendanceDaily) private readonly dailies: Repository<AttendanceDaily>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService
  ) {}

  // ---------------- 班次 ----------------

  listShifts() {
    return this.shifts.find({ order: { code: 'ASC' } });
  }

  async createShift(dto: CreateShiftDto, user: UploaderInfo) {
    const code = dto.code.trim();
    if (await this.shifts.findOneBy({ code })) {
      throw new ConflictException(`班次编码「${code}」已存在`);
    }
    this.assertSegments(dto.segments);
    const shift = await this.shifts.save(this.shifts.create({
      code,
      name: dto.name.trim(),
      segments: dto.segments,
      standardMinutes: dto.standardMinutes,
      active: dto.active ?? true
    }));
    await this.audit.log(user.id, 'attendance.shift.create', 'attendance_shift', shift.id, { code, name: shift.name });
    return shift;
  }

  async updateShift(id: string, dto: UpdateShiftDto, user: UploaderInfo) {
    const shift = await this.shifts.findOneBy({ id });
    if (!shift) throw new NotFoundException('班次不存在');

    if (dto.code && dto.code.trim() !== shift.code) {
      const code = dto.code.trim();
      const exists = await this.shifts.findOneBy({ code });
      if (exists) throw new ConflictException(`班次编码「${code}」已存在`);
      shift.code = code;
    }
    if (dto.name !== undefined) shift.name = dto.name.trim();
    if (dto.segments !== undefined) {
      this.assertSegments(dto.segments);
      shift.segments = dto.segments;
    }
    if (dto.standardMinutes !== undefined) shift.standardMinutes = dto.standardMinutes;
    if (dto.active !== undefined) shift.active = dto.active;
    shift.updatedAt = new Date();

    const saved = await this.shifts.save(shift);
    await this.audit.log(user.id, 'attendance.shift.update', 'attendance_shift', id, {
      code: saved.code,
      name: saved.name,
      active: saved.active
    });
    return saved;
  }

  async removeShift(id: string, user: UploaderInfo) {
    const shift = await this.shifts.findOneBy({ id });
    if (!shift) throw new NotFoundException('班次不存在');
    const used = await this.uploads.countBy({ shiftId: id });
    if (used > 0) {
      throw new BadRequestException('该班次已被考勤批次使用，不能删除。可以改为「停用」，历史结果不受影响');
    }
    await this.shifts.delete({ id });
    await this.audit.log(user.id, 'attendance.shift.delete', 'attendance_shift', id, { code: shift.code });
    return { ok: true };
  }

  private assertSegments(segments: CreateShiftDto['segments']) {
    const error = validateSegments(segments);
    if (error) throw new BadRequestException(error);
  }

  // ---------------- 上传与计算 ----------------

  async upload(file: Express.Multer.File | undefined, shiftId: string, user: UploaderInfo) {
    if (!file?.buffer?.length) throw new BadRequestException('请选择要上传的 Excel 文件');
    if (file.size > MAX_ATTENDANCE_FILE_SIZE) throw new BadRequestException('文件不能超过 20MB');
    if (!shiftId) throw new BadRequestException('请选择本次计算使用的班次');

    const fileName = decodeFileName(file.originalname);
    const shift = await this.shifts.findOneBy({ id: shiftId });
    if (!shift) throw new NotFoundException('班次不存在');
    if (!shift.active) throw new BadRequestException('该班次已停用，请先启用或换一个班次');

    let parsed;
    try {
      parsed = parseAttendanceFile(file.buffer);
    } catch (e: any) {
      throw new BadRequestException(e?.message ?? 'Excel 解析失败');
    }
    if (parsed.punches.length === 0) {
      throw new BadRequestException('没有解析到有效打卡记录，请检查表头与日期时间列');
    }
    if (parsed.punches.length > MAX_ROWS) {
      throw new BadRequestException(`单次最多 ${MAX_ROWS} 条打卡记录，请拆分成多个文件`);
    }

    let results;
    try {
      results = computeDailyResults(
        { segments: shift.segments, standardMinutes: shift.standardMinutes },
        parsed.punches
      );
    } catch (e: any) {
      throw new BadRequestException(e?.message ?? '考勤计算失败');
    }

    const dates = parsed.punches.map((p) => p.punchAt.slice(0, 10)).sort();
    const employeeCount = new Set(parsed.punches.map((p) => p.employeeNo)).size;

    const upload = await this.dataSource.transaction(async (manager) => {
      const header = await manager.save(manager.create(AttendanceUpload, {
        fileName,
        shiftId: shift.id,
        shiftCode: shift.code,
        shiftName: shift.name,
        shiftSegments: shift.segments,
        standardMinutes: shift.standardMinutes,
        periodStart: dates[0],
        periodEnd: dates[dates.length - 1],
        punchCount: parsed.punches.length,
        employeeCount,
        resultCount: results.length,
        createdBy: user.id,
        createdByName: user.username
      }));

      const punchRows = parsed.punches.map((p) => manager.create(AttendancePunch, {
        uploadId: header.id,
        employeeNo: p.employeeNo,
        employeeName: p.employeeName,
        department: p.department,
        machine: p.machine,
        punchAt: p.punchAt
      }));
      for (let i = 0; i < punchRows.length; i += 1000) {
        await manager.insert(AttendancePunch, punchRows.slice(i, i + 1000));
      }

      const dailyRows = results.map((r) => manager.create(AttendanceDaily, { uploadId: header.id, ...r }));
      for (let i = 0; i < dailyRows.length; i += 500) {
        await manager.insert(AttendanceDaily, dailyRows.slice(i, i + 500));
      }
      return header;
    });

    await this.audit.log(user.id, 'attendance.upload', 'attendance_upload', upload.id, {
      fileName,
      shiftCode: shift.code,
      punchCount: parsed.punches.length,
      resultCount: results.length
    });

    this.logger.log(
      `考勤上传完成 ${fileName}: ${parsed.punches.length} 条打卡 / ${results.length} 条日结果 (${shift.code})`
    );
    return { upload, skipped: parsed.skipped, sheetName: parsed.sheetName };
  }

  async listUploads(limit = 30) {
    return this.uploads.find({ order: { createdAt: 'DESC' }, take: Math.min(limit, 100) });
  }

  async removeUpload(id: string, user: UploaderInfo) {
    const upload = await this.uploads.findOneBy({ id });
    if (!upload) throw new NotFoundException('批次不存在');
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(AttendancePunch, { uploadId: id });
      await manager.delete(AttendanceDaily, { uploadId: id });
      await manager.delete(AttendanceUpload, { id });
    });
    await this.audit.log(user.id, 'attendance.upload.delete', 'attendance_upload', id, {
      fileName: upload.fileName,
      punchCount: upload.punchCount
    });
    return { ok: true };
  }

  // ---------------- 查询 ----------------

  private buildResultsQuery(uploadId: string, query: ListResultsQueryDto) {
    const qb = this.dailies.createQueryBuilder('d').where('d.uploadId = :uploadId', { uploadId });
    if (query.dateFrom) qb.andWhere('d.workDate >= :dateFrom', { dateFrom: query.dateFrom });
    if (query.dateTo) qb.andWhere('d.workDate <= :dateTo', { dateTo: query.dateTo });
    if (query.department) qb.andWhere('d.department = :department', { department: query.department });
    if (query.status) qb.andWhere('d.status = :status', { status: query.status });
    if (query.keyword) {
      qb.andWhere('(d.employeeNo ILIKE :kw OR d.employeeName ILIKE :kw)', { kw: `%${query.keyword.trim()}%` });
    }
    return qb;
  }

  private async resolveUpload(uploadId?: string) {
    if (uploadId) {
      const found = await this.uploads.findOneBy({ id: uploadId });
      if (!found) throw new NotFoundException('考勤批次不存在');
      return found;
    }
    return this.uploads.findOne({ where: {}, order: { createdAt: 'DESC' } });
  }

  async results(query: ListResultsQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 20));
    const upload = await this.resolveUpload(query.uploadId);
    if (!upload) {
      return {
        upload: null,
        items: [],
        total: 0,
        page,
        pageSize,
        summary: {
          days: 0, employees: 0, workMinutes: 0, overtimeMinutes: 0,
          lateCount: 0, earlyCount: 0, missingCount: 0, normalCount: 0
        }
      };
    }

    const base = this.buildResultsQuery(upload.id, query);
    const aggregate = await base.clone()
      .select('COUNT(*)', 'days')
      .addSelect('COUNT(DISTINCT d.employeeNo)', 'employees')
      .addSelect('COALESCE(SUM(d.workMinutes), 0)', 'workMinutes')
      .addSelect('COALESCE(SUM(d.overtimeMinutes), 0)', 'overtimeMinutes')
      .addSelect("COALESCE(SUM(CASE WHEN d.lateMinutes > 0 THEN 1 ELSE 0 END), 0)", 'lateCount')
      .addSelect("COALESCE(SUM(CASE WHEN d.earlyMinutes > 0 THEN 1 ELSE 0 END), 0)", 'earlyCount')
      .addSelect("COALESCE(SUM(CASE WHEN d.status = '缺卡' THEN 1 ELSE 0 END), 0)", 'missingCount')
      .addSelect("COALESCE(SUM(CASE WHEN d.status = '正常' THEN 1 ELSE 0 END), 0)", 'normalCount')
      .getRawOne<Record<string, string>>();

    const [items, total] = await base
      .orderBy('d.workDate', 'DESC')
      .addOrderBy('d.employeeNo', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      upload,
      items,
      total,
      page,
      pageSize,
      summary: {
        days: Number(aggregate?.days ?? 0),
        employees: Number(aggregate?.employees ?? 0),
        workMinutes: Number(aggregate?.workMinutes ?? 0),
        overtimeMinutes: Number(aggregate?.overtimeMinutes ?? 0),
        lateCount: Number(aggregate?.lateCount ?? 0),
        earlyCount: Number(aggregate?.earlyCount ?? 0),
        missingCount: Number(aggregate?.missingCount ?? 0),
        normalCount: Number(aggregate?.normalCount ?? 0)
      }
    };
  }

  async exportResults(uploadId: string, query: ListResultsQueryDto) {
    const upload = await this.resolveUpload(uploadId);
    if (!upload) throw new NotFoundException('考勤批次不存在');
    const rows = await this.buildResultsQuery(upload.id, query)
      .orderBy('d.workDate', 'ASC')
      .addOrderBy('d.employeeNo', 'ASC')
      .getMany();
    const buffer = buildAttendanceExport(`${upload.shiftCode} ${upload.shiftName}`, rows);
    return {
      buffer,
      fileName: `考勤结果_${upload.periodStart}_${upload.periodEnd}.xlsx`
    };
  }
}
