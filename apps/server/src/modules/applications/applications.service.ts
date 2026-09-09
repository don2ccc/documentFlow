import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
function _appNoPrefix(): string { const d = new Date(); return d.getFullYear().toString() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { createHash } from 'crypto';
import { AuthUser, DocumentStatus } from '@document-flow/shared';
import { Application } from './entities/application.entity';
import { ApplicationFile } from './entities/application-file.entity';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ApprovalsModule } from '../approvals/approvals.module';
import { ApprovalEngineService } from '../approvals/approval-engine.service';
import { AuditService } from '../audit/audit.service';
import { ALLOWED_MIME, MAX_FILE_SIZE } from '../documents/documents.storage';

const sha1 = (buf: Buffer) => createHash('sha1').update(buf).digest('hex');
const APP_PREVIEW_DIR = path.resolve(process.env.PREVIEW_DIR || './data/previews', 'applications');

export interface ApplicationListItem {
  id: string;
  title: string;
  status: DocumentStatus;
  ownerId: string;
  ownerName: string | null;
  fileCount: number;
  totalSize: number;
  currentInstanceId: string | null;
  defaultWorkflowId: string | null;
  createdAt: string;
  updatedAt: string;
  resubmissionLocked?: boolean;
}

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(Application) private readonly appRepo: Repository<Application>,
    @InjectRepository(ApplicationFile) private readonly fileRepo: Repository<ApplicationFile>,
    private readonly dataSource: DataSource,
    private readonly engine: ApprovalEngineService,
    private readonly audit: AuditService
  ) {}


  private async generateApplicationNo(datePrefix: string): Promise<string> {
    return await this.dataSource.transaction(async (manager) => {
      const lockKey = parseInt(datePrefix, 10);
      await manager.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);
      const rows = await manager.query(
        "SELECT COALESCE(MAX(CAST(SUBSTRING(\"applicationNo\" FROM 9 FOR 4) AS INTEGER)), 0) AS max_seq " +
        "FROM applications WHERE \"applicationNo\" LIKE $1",
        [datePrefix + '%']
      );
      const next = Number((rows[0] && rows[0].max_seq) || 0) + 1;
      if (next > 9999) throw new Error('今日申请单号已用完');
      return datePrefix + String(next).padStart(4, '0');
    });
  }

  private todayPrefix(): string { const d = new Date(); return d.getFullYear().toString() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
  private validateFile(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('请上传文件');
    if (file.size > MAX_FILE_SIZE) throw new BadRequestException('文件超过 20MB');
    if (!ALLOWED_MIME[file.mimetype]) throw new BadRequestException(`不支持的文件类型: ${file.mimetype}`);
    // multer 2.x sends UTF-8 filename bytes as latin1; re-decode.
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
  }

    async create(user: AuthUser, files: Express.Multer.File[] | undefined, dto: CreateApplicationDto) {
    const incoming = files ?? [];
    if (incoming.length === 0) throw new BadRequestException('请至少上传一个文件');
    for (const f of incoming) this.validateFile(f);
    const datePrefix = this.todayPrefix();
    // Acquire the per-day advisory lock and INSERT in the SAME transaction so the
    // applicationNo we computed cannot collide with a concurrent create.
    const created = await this.dataSource.transaction(async (manager) => {
      const lockKey = parseInt(datePrefix, 10);
      await manager.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);
      const rows = await manager.query(
        "SELECT COALESCE(MAX(CAST(SUBSTRING(\"applicationNo\" FROM 9 FOR 4) AS INTEGER)), 0) AS max_seq " +
        "FROM applications WHERE \"applicationNo\" LIKE $1",
        [datePrefix + '%']
      );
      const next = Number((rows[0] && rows[0].max_seq) || 0) + 1;
      if (next > 9999) throw new Error('今日申请单号已用完');
      const newNo = datePrefix + String(next).padStart(4, '0');
      const appRepoTx = manager.getRepository(Application);
      const fileRepoTx = manager.getRepository(ApplicationFile);
      const app = await appRepoTx.save(
        appRepoTx.create({
          title: dto.title,
          description: dto.description ?? null,
          categoryId: dto.categoryId ?? null,
          amount: dto.amount ?? null,
          ownerId: user.id,
          applicationNo: newNo,
          status: DocumentStatus.Draft,
          defaultWorkflowId: dto.workflowId ?? null
        })
      );
      for (const f of incoming) {
        const checksum = sha1(fs.readFileSync(f.path));
        await fileRepoTx.save(
          fileRepoTx.create({
            applicationId: app.id,
            fileName: f.originalname,
            mimeType: f.mimetype,
            size: f.size,
            filePath: f.path,
            checksum,
            versionNo: 1,
            uploadedBy: user.id
          })
        );
      }
      return app;
    });
    await this.audit.log(user.id, 'application:create', 'application', created.id, { title: created.title, fileCount: incoming.length });
    if (dto.workflowId) {
      const instance = await this.engine.submit(dto.workflowId, created.id, 'application', user.id, {});
      created.status = DocumentStatus.InApproval;
      created.currentInstanceId = instance.id;
      await this.appRepo.save(created);
      await this.audit.log(user.id, 'application:submit', 'application', created.id, { workflowId: dto.workflowId });
    }
    return this.getById(user, created.id);
  }

  async list(user: AuthUser, query: { status?: string; keyword?: string; page?: number; pageSize?: number; ownerOnly?: boolean }) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const qb = this.appRepo.createQueryBuilder('a');
    if (query.status) qb.andWhere('a.status = :s', { s: query.status });
    if (query.keyword) qb.andWhere('a.title ILIKE :k', { k: `%${query.keyword}%` });
    if (query.ownerOnly) qb.andWhere('a."ownerId" = :uid', { uid: user.id });
    qb.orderBy('a."createdAt"', 'DESC').skip((page - 1) * pageSize).take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    const ids = items.map((i) => i.id);
    const counts: Record<string, { count: number; size: number }> = {};
    if (ids.length) {
      const rows = await this.fileRepo
        .createQueryBuilder('f')
        .select('f."applicationId"', 'applicationId')
        .addSelect('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(f.size), 0)', 'size')
        .where({ applicationId: In(ids) })
        .groupBy('f."applicationId"')
        .getRawMany<{ applicationId: string; count: string; size: string }>();
      for (const r of rows) counts[r.applicationId] = { count: Number(r.count), size: Number(r.size) };
    }
    const ownerIds = Array.from(new Set(items.map((i) => i.ownerId)));
    const ownerNames = new Map<string, string>();
    if (ownerIds.length) {
      const rows = await this.dataSource.query(`SELECT id, name FROM users WHERE id = ANY($1::uuid[])`, [ownerIds]);
      for (const r of rows as Array<{ id: string; name: string }>) ownerNames.set(r.id, r.name);
    }
    const currentInstanceIds = items.map((i) => i.currentInstanceId).filter((x): x is string => !!x);
    const reviewersByInstance = new Map<string, Array<{ userId: string; name: string }>>();
    if (currentInstanceIds.length) {
      try {
        const map = await this.engine.getCurrentReviewersForInstances(currentInstanceIds);
        for (const [k, v] of map.entries()) reviewersByInstance.set(k, v as Array<{ userId: string; name: string }>);
      } catch { /* noop */ }
    }
    const result: ApplicationListItem[] = items.map((i) => ({
      id: i.id,
      applicationNo: (i as any).applicationNo ?? null,
      title: i.title,
      status: i.status,
      ownerId: i.ownerId,
      ownerName: ownerNames.get(i.ownerId) ?? null,
      fileCount: counts[i.id]?.count ?? 0,
      totalSize: counts[i.id]?.size ?? 0,
      currentInstanceId: i.currentInstanceId,
      defaultWorkflowId: i.defaultWorkflowId,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
      currentReviewer: i.currentInstanceId ? reviewersByInstance.get(i.currentInstanceId) ?? null : null
    }));
    return { items: result, total, page, pageSize };
  }

  async getById(user: AuthUser, id: string) {
    const app = await this.appRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException('申请项目不存在');
    const ownerRow = await this.dataSource.query(`SELECT name FROM users WHERE id = $1`, [app.ownerId]);
    const ownerName = (ownerRow?.[0]?.name as string | undefined) ?? null;
    const resubmissionLocked = await this.engine.wasWithdrawn(id, 'application');
    const files = await this.fileRepo.find({ where: { applicationId: id }, order: { createdAt: 'ASC' } });
    let currentReviewer: Array<{ userId: string; name: string }> | null = null;
    if (app.currentInstanceId) {
      try {
        const map = await this.engine.getCurrentReviewersForInstances([app.currentInstanceId]);
        currentReviewer = (map.get(app.currentInstanceId) as Array<{ userId: string; name: string }>) ?? null;
      } catch { /* noop */ }
    }
    return {
      id: app.id,
      applicationNo: (app as any).applicationNo ?? null,
      title: app.title,
      description: app.description,
      categoryId: app.categoryId,
      amount: app.amount,
      ownerId: app.ownerId,
      ownerName,
      status: app.status,
      currentInstanceId: app.currentInstanceId,
      defaultWorkflowId: app.defaultWorkflowId,
      createdAt: app.createdAt.toISOString(),
      updatedAt: app.updatedAt.toISOString(),
      currentReviewer,
      resubmissionLocked,
      files: files.map((f) => ({
        id: f.id,
        fileName: f.fileName,
        mimeType: f.mimeType,
        size: f.size,
        versionNo: f.versionNo,
        uploadedBy: f.uploadedBy,
        createdAt: f.createdAt.toISOString(),
        signedPath: f.signedPath ?? null,
        signedAt: f.signedAt ? f.signedAt.toISOString() : null,
        signedByName: f.signedByName ?? null
      }))
    };
  }

  async getFile(user: AuthUser, applicationId: string, fileId: string) {
    const app = await this.appRepo.findOne({ where: { id: applicationId } });
    if (!app) throw new NotFoundException('申请项目不存在');
    const f = await this.fileRepo.findOne({ where: { id: fileId, applicationId } });
    if (!f) throw new NotFoundException('文件不存在');
    return f;
  }


  async streamPreview(user: AuthUser, applicationId: string, fileId: string, res: any) {
    const f = await this.getFile(user, applicationId, fileId);
    const OFFICE_MIME = new Set([
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
      'application/vnd.oasis.opendocument.spreadsheet',
      'application/vnd.oasis.opendocument.text',
      'application/vnd.oasis.opendocument.presentation',
    ]);
    if (OFFICE_MIME.has(f.mimeType)) {
      if (!fs.existsSync(f.filePath)) {
        res.status(404).json({ previewFailed: true, message: '文件不存在' });
        return;
      }
      res.setHeader('X-Preview-Mode', 'raw');
      res.setHeader('Content-Type', f.mimeType);
      res.setHeader('Content-Disposition', `inline; filename=${encodeURIComponent(f.fileName)}`);
      res.sendFile(path.resolve(f.filePath));
      return;
    }
    if (f.mimeType === 'application/pdf') {
      res.type('application/pdf');
      res.sendFile(path.resolve(f.filePath));
      return;
    }
    const previewPath = path.join(APP_PREVIEW_DIR, f.id + '.pdf');
    if (!fs.existsSync(previewPath)) {
      fs.mkdirSync(APP_PREVIEW_DIR, { recursive: true });
      try {
        const proc = execFile('libreoffice', ['--headless', '--convert-to', 'pdf', '--outdir', APP_PREVIEW_DIR, f.filePath]);
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => { try { proc.kill('SIGKILL'); } catch (_) {} reject(new Error('libreoffice 轤换超时(90s)')); }, 90_000);
          proc.on('exit', (code) => { clearTimeout(t); code === 0 ? resolve() : reject(new Error('libreoffice 退出码 ' + code)); });
          proc.on('error', (e) => { clearTimeout(t); reject(e); });
        });
        const base = path.basename(f.filePath, path.extname(f.filePath));
        const produced = path.join(APP_PREVIEW_DIR, base + '.pdf');
        if (fs.existsSync(produced) && produced !== previewPath) fs.renameSync(produced, previewPath);
      } catch (e) {
        res.status(422).json({ previewFailed: true, message: String((e as Error).message) });
        return;
      }
    }
    if (!fs.existsSync(previewPath)) {
      res.status(422).json({ previewFailed: true });
      return;
    }
    res.type('application/pdf');
    res.sendFile(path.resolve(previewPath));
  }
  async remove(user: AuthUser, id: string) {
    if (!user?.permissions || !user.permissions.includes('user:manage')) {
      throw new ForbiddenException('只有系统管理员才能删除申请项目');
    }
    const app = await this.appRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException('申请项目不存在');
    const files = await this.fileRepo.find({ where: { applicationId: id } });
    if (app.currentInstanceId) {
      try { await this.engine.withdraw(app.currentInstanceId, user.id); } catch { /* noop */ }
    }
    await this.dataSource.transaction(async (manager) => {
      const iids = (await manager.query(`SELECT id FROM approval_instances WHERE "documentId" = $1 AND "targetType" = 'application'`, [id])) as Array<{ id: string }>;
      const ids = iids.map((r) => r.id);
      if (ids.length > 0) {
        await manager.query('DELETE FROM approval_records WHERE "instanceId" = ANY($1::uuid[])', [ids]);
        await manager.query('DELETE FROM approval_tasks WHERE "instanceId" = ANY($1::uuid[])', [ids]);
      }
      await manager.query("DELETE FROM approval_instances WHERE \"documentId\" = $1 AND \"targetType\" = 'application'", [id]);
      await manager.query('DELETE FROM application_files WHERE "applicationId" = $1', [id]);
      await manager.query('DELETE FROM applications WHERE id = $1', [id]);
    });
    for (const f of files) {
      try { if (fs.existsSync(f.filePath)) fs.unlinkSync(f.filePath); } catch { /* noop */ }
      const pv = path.join(APP_PREVIEW_DIR, f.id + '.pdf');
      try { if (fs.existsSync(pv)) fs.unlinkSync(pv); } catch { /* noop */ }
    }
    await this.audit.log(user.id, 'application:delete', 'application', id, { title: app.title, fileCount: files.length });
    return { ok: true };
  }

  async withdraw(user: AuthUser, id: string) {
    const app = await this.appRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException('申请项目不存在');
    if (app.ownerId !== user.id) throw new ForbiddenException('只有创建人可以撤回');
    if (!app.currentInstanceId) throw new BadRequestException('当前状态不可撤回');
    await this.engine.withdraw(app.currentInstanceId, user.id);
    app.status = DocumentStatus.Draft;
    app.currentInstanceId = null;
    await this.appRepo.save(app);
    return { ok: true };
  }

  async remind(user: AuthUser, id: string) {
    const app = await this.appRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException('申请项目不存在');
    if (!app.currentInstanceId) throw new BadRequestException('当前没有进行中的审批');
    await this.engine.remind(app.currentInstanceId, user.id);
    return { ok: true };
  }

  async queryApplications(
    user: AuthUser,
    query: {
      keyword?: string;
      status?: string;
      categoryId?: string;
      startDate?: string;
      endDate?: string;
      scope?: 'all' | 'created' | 'reviewed';
      page?: number;
      pageSize?: number;
    }
  ) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const scope = query.scope ?? 'all';
    if (query.categoryId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query.categoryId)) {
      return { items: [], total: 0, page: 1, pageSize: 20 };
    }
    const conds: string[] = [];
    const params: any[] = [];
    let pi = 1;
    if (scope === 'created') {
      conds.push(`a."ownerId" = $${pi++}`);
      params.push(user.id);
    } else if (scope === 'reviewed') {
      conds.push(`EXISTS (SELECT 1 FROM approval_instances i INNER JOIN approval_records r ON r."instanceId" = i.id WHERE i."documentId" = a.id AND i."targetType" = 'application' AND r."actorId" = $${pi++})`);
      params.push(user.id);
    } else {
      conds.push(`(a."ownerId" = $${pi++} OR EXISTS (SELECT 1 FROM approval_instances i INNER JOIN approval_records r ON r."instanceId" = i.id WHERE i."documentId" = a.id AND i."targetType" = 'application' AND r."actorId" = $${pi++}))`);
      params.push(user.id);
      params.push(user.id);
    }
    if (query.keyword) { conds.push(`a.title ILIKE $${pi++}`); params.push(`%${query.keyword}%`); }
    if (query.status) { conds.push(`a.status = $${pi++}`); params.push(query.status); }
    if (query.categoryId) { conds.push(`a."categoryId" = $${pi++}`); params.push(query.categoryId); }
    if (query.startDate) { conds.push(`a."createdAt" >= $${pi++}`); params.push(query.startDate); }
    if (query.endDate) { conds.push(`a."createdAt" <= $${pi++}`); params.push(query.endDate); }
    const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const totalRes = await this.dataSource.query(
      `SELECT COUNT(DISTINCT a.id)::int AS total FROM applications a ${whereSql}`,
      params
    );
    const total = Number(totalRes[0]?.total ?? 0);
    const offset = (page - 1) * pageSize;
    const listRes = await this.dataSource.query(
      `SELECT a.* FROM applications a ${whereSql} ORDER BY a."createdAt" DESC LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );
    if (listRes.length === 0) return { items: [], total, page, pageSize };
    const appIds = listRes.map((r: any) => r.id);
    const ownerIds: string[] = Array.from(new Set(listRes.map((r: any) => r.ownerId))) as string[];
    const categoryIds: string[] = Array.from(new Set(listRes.map((r: any) => r.categoryId).filter(Boolean))) as string[];
    const instanceIds: string[] = listRes.map((r: any) => r.currentInstanceId).filter(Boolean) as string[];
    const [fileAgg, ownerRows, categoryRows, instanceRows] = await Promise.all([
      this.fileRepo.createQueryBuilder('f').select('f."applicationId"', 'applicationId')
        .addSelect('COUNT(*)', 'count').addSelect('COALESCE(SUM(f.size), 0)', 'size')
        .where({ applicationId: In(appIds) }).groupBy('f."applicationId"')
        .getRawMany<{ applicationId: string; count: string; size: string }>(),
      ownerIds.length ? this.dataSource.query(`SELECT id, name FROM users WHERE id = ANY($1::uuid[])`, [ownerIds]) : Promise.resolve([]),
      categoryIds.length ? this.dataSource.query(`SELECT id, name FROM categories WHERE id = ANY($1::uuid[])`, [categoryIds]) : Promise.resolve([]),
      instanceIds.length ? this.dataSource.query(`SELECT id, "currentNodeId", snapshot FROM approval_instances WHERE id = ANY($1::uuid[])`, [instanceIds]) : Promise.resolve([])
    ]);
    const fileMap = new Map<string, { count: number; size: number }>();
    for (const r of fileAgg) fileMap.set(r.applicationId, { count: Number(r.count), size: Number(r.size) });
    const ownerNameMap = new Map<string, string>();
    for (const r of ownerRows as Array<{ id: string; name: string }>) ownerNameMap.set(r.id, r.name);
    const categoryNameMap = new Map<string, string>();
    for (const r of categoryRows as Array<{ id: string; name: string }>) categoryNameMap.set(r.id, r.name);
    const instanceMap = new Map<string, { currentNodeId: string | null; snapshot: any }>();
    for (const r of instanceRows as Array<{ id: string; currentNodeId: string | null; snapshot: any }>) instanceMap.set(r.id, { currentNodeId: r.currentNodeId, snapshot: r.snapshot });
    let reviewersByInstance = new Map<string, Array<{ userId: string; name: string }>>();
    if (instanceIds.length) {
      try {
        const m = await this.engine.getCurrentReviewersForInstances(instanceIds);
        reviewersByInstance = m as Map<string, Array<{ userId: string; name: string }>>;
      } catch { /* noop */ }
    }
    const items = listRes.map((r: any) => {
      const inst = r.currentInstanceId ? instanceMap.get(r.currentInstanceId) : null;
      let currentNodeName: string | null = null;
      if (inst?.currentNodeId) {
        const nodes = (inst.snapshot?.nodes ?? []) as Array<{ id: string; name: string }>;
        currentNodeName = nodes.find((n) => n.id === inst.currentNodeId)?.name ?? null;
      }
      return {
        id: r.id,
      applicationNo: (r as any).applicationNo ?? null, title: r.title, status: r.status, ownerId: r.ownerId,
        ownerName: ownerNameMap.get(r.ownerId) ?? null,
        categoryId: r.categoryId, categoryName: r.categoryId ? categoryNameMap.get(r.categoryId) ?? null : null,
        fileCount: fileMap.get(r.id)?.count ?? 0,
        totalSize: fileMap.get(r.id)?.size ?? 0,
        currentInstanceId: r.currentInstanceId, currentNodeName,
        currentReviewer: r.currentInstanceId ? reviewersByInstance.get(r.currentInstanceId) ?? null : null,
        createdAt: new Date(r.createdAt).toISOString(),
        updatedAt: new Date(r.updatedAt).toISOString()
      };
    });
    return { items, total, page, pageSize };
  }

  async submit(user: AuthUser, id: string, workflowId: string) {
    const app = await this.appRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException('申请项目不存在');
    if (app.ownerId !== user.id) throw new ForbiddenException('只能提交自己的申请项目');
    if (await this.engine.wasWithdrawn(id, 'application')) throw new BadRequestException('该申请项目已撤回，不能修改后再次提交');
    if (![DocumentStatus.Draft, DocumentStatus.Rejected].includes(app.status)) throw new BadRequestException('当前状态不可提交');
    const instance = await this.engine.submit(workflowId, app.id, 'application', user.id, {});
    app.status = DocumentStatus.InApproval;
    app.currentInstanceId = instance.id;
    app.defaultWorkflowId = workflowId;
    await this.appRepo.save(app);
    await this.audit.log(user.id, 'application:submit', 'application', app.id, { workflowId });
    return { ok: true };
  }
}
