import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Repository } from 'typeorm';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { ListEmployeesQueryDto } from './dto/list-employees-query.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Employee } from './entities/employee.entity';
import { AuditService } from '../audit/audit.service';

export const PHOTO_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif'
};
export const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

/** 身份证/银行卡属 PII，列表页按需脱敏，详情与编辑返回完整值 */
export function maskIdCard(v: string | null): string | null {
  if (!v || v.length < 10) return v;
  return `${v.slice(0, 6)}********${v.slice(-4)}`;
}
export function maskBankNo(v: string | null): string | null {
  if (!v || v.length < 8) return v;
  return `${'*'.repeat(v.length - 4)}${v.slice(-4)}`;
}

function calcAge(birth: Date | string | null): number | null {
  if (!birth) return null;
  const b = new Date(birth);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    @InjectRepository(Employee) private readonly repo: Repository<Employee>,
    private readonly audit: AuditService,
    @Inject('HR_PHOTO_DIR') private readonly photoDir: string
  ) {}

  private toBrief(e: Employee) {
    return {
      id: e.id,
      employeeNo: e.employeeNo,
      name: e.name,
      gender: e.gender,
      department: e.department,
      workGroup: e.workGroup,
      jobTitle: e.jobTitle,
      joinDate: e.joinDate,
      phone: e.phone,
      // 列表页不返回完整证件号与银行卡
      idCardNo: maskIdCard(e.idCardNo),
      bankNo: maskBankNo(e.bankNo),
      cardNo: e.cardNo,
      active: e.active,
      // 不下发内部文件名，前端统一用 /api/hr/employees/:id/photo 取图
      hasPhoto: !!e.photoPath
    };
  }

  private toDetail(e: Employee) {
    // 详情返回完整实体，覆盖 toBrief 中的脱敏字段
    return { ...e, hasPhoto: !!e.photoPath };
  }

  async list(query: ListEmployeesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 200);
    const qb = this.repo.createQueryBuilder('e');
    if (query.keyword) {
      const k = `%${query.keyword}%`;
      qb.andWhere(
        '(e.employeeNo ILIKE :k OR e.name ILIKE :k OR e.namePinyin ILIKE :k OR e.namePinyinRest ILIKE :k OR e.phone ILIKE :k OR e.email ILIKE :k OR e.cardNo ILIKE :k)',
        { k }
      );
    }
    if (query.department) qb.andWhere('e.department = :department', { department: query.department });
    if (query.workGroup) qb.andWhere('e.workGroup = :workGroup', { workGroup: query.workGroup });
    if (query.active !== undefined) qb.andWhere('e.active = :active', { active: query.active === 'true' });

    const [rows, total] = await qb
      .orderBy('e.employeeNo', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items: rows.map((r) => this.toBrief(r)), total, page, pageSize };
  }

  async get(id: string) {
    const e = await this.repo.findOneBy({ id });
    if (!e) throw new NotFoundException('员工不存在');
    return this.toDetail(e);
  }

  async create(dto: CreateEmployeeDto, operatorId: string) {
    await this.assertEmployeeNoFree(dto.employeeNo);
    await this.assertIdCardFree(dto.idCardNo);

    const saved = await this.repo.save(
      this.repo.create({
        employeeNo: dto.employeeNo,
        name: dto.name,
        namePinyin: dto.namePinyin ?? null,
        namePinyinRest: dto.namePinyinRest ?? null,
        gender: dto.gender ?? null,
        nation: dto.nation ?? null,
        birthDate: dto.birthDate ?? null,
        age: dto.age ?? calcAge(dto.birthDate ?? null),
        idCardNo: dto.idCardNo ?? null,
        idCardAddress: dto.idCardAddress ?? null,
        address: dto.address ?? null,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        bankNo: dto.bankNo ?? null,
        cardNo: dto.cardNo ?? null,
        department: dto.department ?? null,
        workGroup: dto.workGroup ?? null,
        jobTitle: dto.jobTitle ?? null,
        workLocation: dto.workLocation ?? null,
        supervisor: dto.supervisor ?? null,
        joinDate: dto.joinDate ?? null,
        leaveDate: dto.leaveDate ?? null,
        entryType: dto.entryType ?? null,
        education: dto.education ?? null,
        major: dto.major ?? null,
        school: dto.school ?? null,
        maritalStatus: dto.maritalStatus ?? null,
        salary: dto.salary ?? null,
        returnedStatus: dto.returnedStatus ?? null,
        active: dto.active ?? true
      })
    );
    await this.audit.log(operatorId, 'employee:create', 'employee', saved.id, { employeeNo: saved.employeeNo, name: saved.name });
    return this.toDetail(saved);
  }

  async update(id: string, dto: UpdateEmployeeDto, operatorId: string) {
    const e = await this.repo.findOneBy({ id });
    if (!e) throw new NotFoundException('员工不存在');
    if (dto.employeeNo && dto.employeeNo !== e.employeeNo) await this.assertEmployeeNoFree(dto.employeeNo, id);
    if (dto.idCardNo && dto.idCardNo !== e.idCardNo) await this.assertIdCardFree(dto.idCardNo, id);

    const fields: Array<keyof Employee> = [
      'employeeNo', 'name', 'namePinyin', 'namePinyinRest', 'gender', 'nation', 'idCardNo', 'idCardAddress',
      'address', 'phone', 'email', 'bankNo', 'cardNo', 'department', 'workGroup', 'jobTitle', 'workLocation',
      'supervisor', 'joinDate', 'leaveDate', 'entryType', 'education', 'major', 'school', 'maritalStatus',
      'salary', 'returnedStatus', 'active'
    ];
    const dtoRec = dto as unknown as Record<string, unknown>;
    const entityRec = e as unknown as Record<string, unknown>;
    for (const f of fields) {
      const v = dtoRec[f];
      if (v !== undefined) entityRec[f] = v === '' ? null : v;
    }
    if (dto.birthDate !== undefined) {
      e.birthDate = dto.birthDate || null;
      e.age = calcAge(e.birthDate);
    }
    const saved = await this.repo.save(e);
    await this.audit.log(operatorId, 'employee:update', 'employee', id, { employeeNo: saved.employeeNo });
    return this.toDetail(saved);
  }

  async setActive(id: string, active: boolean, operatorId: string) {
    const e = await this.repo.findOneBy({ id });
    if (!e) throw new NotFoundException('员工不存在');
    // 恢复在职时，工号/身份证可能已被另一名在职员工占用。
    // 不校验的话会直接撞上数据库的部分唯一索引，报成 500。
    if (active && !e.active) {
      await this.assertEmployeeNoFree(e.employeeNo, e.id);
      await this.assertIdCardFree(e.idCardNo ?? undefined, e.id);
    }
    e.active = active;
    await this.repo.save(e);
    await this.audit.log(operatorId, 'employee:set-active', 'employee', id, { active });
    return this.toDetail(e);
  }

  /** 逻辑删除：置 active=false，与旧系统 Activated 位一致，记录仍可查询 */
  async remove(id: string, operatorId: string) {
    const e = await this.repo.findOneBy({ id });
    if (!e) throw new NotFoundException('员工不存在');
    e.active = false;
    await this.repo.save(e);
    await this.audit.log(operatorId, 'employee:deactivate', 'employee', id, { employeeNo: e.employeeNo });
    return { ok: true };
  }

  /**
   * 彻底删除：物理删除该行与照片文件，删除后无法再查询到。
   *
   * 与 remove()（停用）的区别：停用保留历史供查询，这里是真删。
   * 两道前置校验：
   *   1. 在职员工必须先停用，避免误删；
   *   2. 该员工在宿舍模块仍有入住记录时禁止删除 —— 宿舍那边用的是纯文本
   *      employeeNo 而非外键，删掉员工会留下找不到人的入住记录。
   *
   * 已确认 hr_employees 本身没有任何外键引用，删除不会产生其他悬挂引用。
   */
  async removePermanent(id: string, operatorId: string) {
    const e = await this.repo.findOneBy({ id });
    if (!e) throw new NotFoundException('员工不存在');
    if (e.active) {
      throw new BadRequestException('在职员工不能直接删除，请先停用再删除');
    }

    // 宿舍入住记录用纯文本 employeeNo 关联，不是外键，删掉员工会留下找不到人的入住记录。
    // 这里拦住，让 HR 先去宿舍模块处理。
    const residents = await this.repo.manager.query(
      'SELECT count(*)::int AS c FROM dormitory_residents WHERE "employeeNo" = $1',
      [e.employeeNo]
    );
    const stayCount = Number(residents[0]?.c ?? 0);
    if (stayCount > 0) {
      throw new ConflictException(
        `该员工在宿舍模块仍有 ${stayCount} 条入住记录，请先在「宿舍管理」中办理退住后再删除`
      );
    }

    await this.repo.delete(id);

    // 照片文件一并清掉。失败不阻断删除 —— 行已经没了，文件是残留。
    if (e.photoPath) {
      try {
        fs.unlinkSync(path.join(this.photoDir, path.basename(e.photoPath)));
      } catch {
        /* 文件可能已不存在，忽略 */
      }
    }

    await this.audit.log(operatorId, 'employee:hard-delete', 'employee', id, {
      employeeNo: e.employeeNo,
      name: e.name,
      hadPhoto: !!e.photoPath
    });
    return { ok: true };
  }

  async uploadPhoto(id: string, file: Express.Multer.File | undefined, operatorId: string) {
    const e = await this.repo.findOneBy({ id });
    if (!e) throw new NotFoundException('员工不存在');
    if (!file) throw new BadRequestException('未收到文件');
    const ext = PHOTO_MIME[file.mimetype];
    if (!ext) throw new BadRequestException('仅支持 jpg / png / gif 格式');
    if (file.size > MAX_PHOTO_SIZE) throw new BadRequestException('照片不能超过 5MB');

    fs.mkdirSync(this.photoDir, { recursive: true });
    // 文件名用 uuid，身份证号不进文件系统路径
    const filename = `${e.id}-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(this.photoDir, filename), file.buffer);

    const old = e.photoPath;
    e.photoPath = filename;
    await this.repo.save(e);
    if (old && old !== filename) {
      try { fs.unlinkSync(path.join(this.photoDir, path.basename(old))); } catch { /* 旧文件可能已不存在 */ }
    }
    await this.audit.log(operatorId, 'employee:photo', 'employee', id, { filename: crypto.createHash('sha1').update(file.buffer).digest('hex') });
    return this.toDetail(e);
  }

  /** 供 controller 流式返回照片；找不到时返回 null 而不是抛错，便于区分 404 语义 */
  async getPhotoFile(id: string): Promise<{ absolutePath: string; mime: string } | null> {
    const e = await this.repo.findOneBy({ id });
    if (!e?.photoPath) return null;
    // basename 防止 photoPath 被篡改为 ../ 穿越目录
    const filename = path.basename(e.photoPath);
    const absolutePath = path.join(this.photoDir, filename);
    if (!fs.existsSync(absolutePath)) return null;
    const ext = path.extname(filename).slice(1).toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
    return { absolutePath, mime };
  }

  /**
   * 工号唯一性：只看在职员工。
   *
   * 删除员工是逻辑删除（active=false，行仍留在表里），所以工号并非一离职就释放。
   * 但离职员工不应继续占用工号——同工号可以再次入职，这与 assertIdCardFree
   * 的口径一致，数据库侧也有对应的部分唯一索引
   * hr_employees_employeeNo_active_key（见 migrations/003）。
   */
  private async assertEmployeeNoFree(employeeNo: string, exceptId?: string) {
    const found = await this.repo
      .createQueryBuilder('e')
      .where('e.employeeNo = :no', { no: employeeNo })
      .andWhere('e.active = true')
      .getOne();
    if (found && found.id !== exceptId) throw new ConflictException(`工号 ${employeeNo} 已存在`);
  }

  private async assertIdCardFree(idCardNo: string | undefined, exceptId?: string) {
    if (!idCardNo) return;
    const found = await this.repo
      .createQueryBuilder('e')
      .where('e.idCardNo = :no', { no: idCardNo })
      .andWhere('e.active = true')
      .getOne();
    if (found && found.id !== exceptId) throw new ConflictException('该身份证号对应的在职员工已存在');
  }
}