import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { AuthUser, DocumentStatus } from '@document-flow/shared';
import { ApprovalEngineService } from '../approvals/approval-engine.service';
import { AuditService } from '../audit/audit.service';
import * as fs from 'fs';
import { CreateVersionDto } from './dto/create-version.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { ConversionJob } from './entities/conversion-job.entity';
import { Document } from './entities/document.entity';
import { DocumentVersion } from './entities/document-version.entity';
import { ConverterService } from './converter.service';
import * as path from 'path';
import { ALLOWED_MIME, MAX_FILE_SIZE, sha1 } from './documents.storage';

export interface DocumentDto {
  id: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  amount: string | null;
  status: DocumentStatus;
  ownerId: string;
  ownerName: string | null;
  currentInstanceId: string | null;
  defaultWorkflowId: string | null;
  currentReviewer: Array<{ userId: string; name: string }> | null;
  createdAt: string;
  latestVersion: { id: string; versionNo: number; fileName: string; size: number; mimeType: string } | null;
}

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document) private readonly docRepo: Repository<Document>,
    @InjectRepository(DocumentVersion) private readonly versionRepo: Repository<DocumentVersion>,
    @InjectRepository(ConversionJob) private readonly jobRepo: Repository<ConversionJob>,
    private readonly converter: ConverterService,
    private readonly dataSource: DataSource,
    private readonly engine: ApprovalEngineService,
    private readonly audit: AuditService
  ) {}

  async upload(userId: string, file: Express.Multer.File, dto: UploadDocumentDto) {
    this.validateFile(file);
    const checksum = sha1(fs.readFileSync(file.path));
    const doc = await this.docRepo.save(
      this.docRepo.create({
        title: dto.title,
        description: dto.description ?? null,
        categoryId: dto.categoryId || null,
        amount: dto.amount ?? null,
        ownerId: userId,
        status: DocumentStatus.Draft,
        defaultWorkflowId: dto.workflowId ?? null
      })
    );
    const version = await this.versionRepo.save(
      this.versionRepo.create({
        documentId: doc.id,
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        filePath: file.path,
        checksum,
        versionNo: 1,
        uploadedBy: userId
      })
    );
    await this.jobRepo.save(this.jobRepo.create({ documentVersionId: version.id }));
    await this.audit.log(userId, 'document:upload', 'document', doc.id, { title: doc.title });
    if (dto.workflowId) {
      const instance = await this.engine.submit(dto.workflowId, doc.id, 'document', userId, {});
      doc.status = DocumentStatus.InApproval;
      doc.currentInstanceId = instance.id;
      await this.docRepo.save(doc);
      await this.audit.log(userId, 'document:submit', 'document', doc.id, { workflowId: dto.workflowId, autoOnUpload: true });
    }
    const ownerNames0 = await this.loadOwnerNames([doc.ownerId]);
    return this.toDto(doc, version, ownerNames0.get(doc.ownerId) ?? null);
  }

  async findVisible(user: AuthUser, query: { status?: string; categoryId?: string; keyword?: string; page?: number; pageSize?: number }) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const applyFilters = (qb: SelectQueryBuilder<Document>) => {
      if (query.status) qb.andWhere('d.status = :status', { status: query.status });
      if (query.categoryId) qb.andWhere('d.categoryId = :categoryId', { categoryId: query.categoryId });
      if (query.keyword) qb.andWhere('d.title ILIKE :k', { k: `%${query.keyword}%` });
      return qb;
    };
    const finish = async (qb: SelectQueryBuilder<Document>) => {
      const [items, total] = await qb.orderBy('d.createdAt', 'DESC').skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
      const names = await this.loadOwnerNames(items.map((d) => d.ownerId));
      const reviewerMap = await this.loadCurrentReviewers(items);
      const dtos = await Promise.all(
        items.map((d) => this.toDto(d, undefined, names.get(d.ownerId) ?? null, reviewerMap.get(d.currentInstanceId ?? '') ?? null))
      );
      return { items: dtos, total, page, pageSize };
    };
    const canSeeAll = user.permissions.includes('user:manage') || user.permissions.includes('application:query');
    if (canSeeAll) {
      return await finish(applyFilters(this.docRepo.createQueryBuilder('d')));
    }
    try {
      const qb = applyFilters(
        this.docRepo.createQueryBuilder('d').where(
          '(d.ownerId = :userId OR EXISTS (SELECT 1 FROM approval_instances ai WHERE ai."documentId" = d.id AND (ai."initiatorId" = :userId OR ai.id IN (SELECT ar."instanceId" FROM approval_records ar WHERE ar."actorId" = :userId))))',
          { userId: user.id }
        )
      );
      return await finish(qb);
    } catch (e) {
      if (String((e as Error).message).includes('does not exist')) {
        return await finish(applyFilters(this.docRepo.createQueryBuilder('d').where('d.ownerId = :userId', { userId: user.id })));
      }
      throw e;
    }
  }

  async submit(user: AuthUser, id: string, workflowId: string, chosenApproverIds?: Record<string, string>) {
    const doc = await this.getDocument(id);
    if (doc.ownerId !== user.id) throw new ForbiddenException('只能提交自己的文档');
    if (![DocumentStatus.Draft, DocumentStatus.Rejected].includes(doc.status)) throw new BadRequestException('当前状态不可提交');
    const wfId = workflowId ?? doc.defaultWorkflowId;
    if (!wfId) throw new BadRequestException('请选择审批流程');
    const instance = await this.engine.submit(wfId, id, 'document', user.id, { chosenApproverIds });
    doc.status = DocumentStatus.InApproval;
    doc.currentInstanceId = instance.id;
    await this.docRepo.save(doc);
    await this.audit.log(user.id, 'document:submit', 'document', id, { workflowId });
    const ownerNamesX = await this.loadOwnerNames([doc.ownerId]);
    return this.toDto(doc, undefined, ownerNamesX.get(doc.ownerId) ?? null);
  }

  async withdraw(user: AuthUser, id: string) {
    const doc = await this.getDocument(id);
    if (doc.ownerId !== user.id) throw new ForbiddenException('只能撤回自己的文档');
    if (!doc.currentInstanceId) throw new BadRequestException('文档未在审批中');
    await this.engine.withdraw(doc.currentInstanceId, user.id);
    doc.status = DocumentStatus.Draft;
    doc.currentInstanceId = null;
    await this.docRepo.save(doc);
    await this.audit.log(user.id, 'document:withdraw', 'document', id);
    const ownerNamesX = await this.loadOwnerNames([doc.ownerId]);
    return this.toDto(doc, undefined, ownerNamesX.get(doc.ownerId) ?? null);
  }

  async remind(user: AuthUser, id: string) {
    const doc = await this.getDocument(id);
    if (doc.ownerId !== user.id) throw new ForbiddenException('只能催办自己的文档');
    if (!doc.currentInstanceId) throw new BadRequestException('文档未在审批中');
    await this.engine.remind(doc.currentInstanceId, user.id);
    return { ok: true };
  }

  async getDetail(user: AuthUser, id: string) {
    const doc = await this.assertCanView(user, id);
    let versions = await this.versionRepo.find({ where: { documentId: id }, order: { versionNo: 'DESC' } });
    if ((doc as any)._fromApplication) {
      const files = await this.dataSource.query(
        'SELECT id, "fileName", "mimeType", size, "versionNo", "createdAt" FROM application_files WHERE "applicationId" = $1 ORDER BY "createdAt" DESC',
        [id]
      );
      versions = files.map((f: any) => ({
        id: f.id, documentId: id, fileName: f.fileName, filePath: '',
        mimeType: f.mimeType, size: f.size, versionNo: f.versionNo,
        checksum: '', uploadedBy: '', createdAt: f.createdAt
      })) as any;
    }
    let progress = null;
    if (doc.currentInstanceId) {
      try { progress = await this.engine.getProgress(user, doc.currentInstanceId); }
      catch { progress = null; }
    }
    const ownerNames = await this.loadOwnerNames([doc.ownerId]);
    return { ...(await this.toDto(doc, versions[0], ownerNames.get(doc.ownerId) ?? null)), versions, progress, currentInstanceId: doc.currentInstanceId };
  }

  async assertCanView(user: AuthUser, documentId: string): Promise<Document> {
    const doc = await this.getDocument(documentId);
    if (user.permissions.includes('user:manage') || user.permissions.includes('application:query')) return doc;
    if (doc.ownerId === user.id) return doc;
    try {
      const involved = await this.dataSource.query(
        'SELECT COUNT(*)::int AS c FROM approval_instances ai WHERE ai."documentId" = $1 AND ( ai."initiatorId" = $2 OR EXISTS (SELECT 1 FROM approval_tasks at WHERE at."instanceId" = ai.id AND (at."assigneeId" = $2 OR at."claimedBy" = $2)) OR EXISTS (SELECT 1 FROM approval_records ar WHERE ar."instanceId" = ai.id AND ar."actorId" = $2))',
        [documentId, user.id]
      );
      if (Number(involved[0]?.c ?? 0) > 0) return doc;
    } catch {
      // 审批表未创建（Task 12 之前），跳过参与人检查
    }
    throw new ForbiddenException('无权查看该文档');
  }

  async getDocument(id: string): Promise<Document> {
    const doc = await this.docRepo.findOneBy({ id });
    if (doc) return doc;
    const appRows = await this.dataSource.query(
      'SELECT id, title, description, "categoryId", amount, "ownerId", status, "currentInstanceId", "defaultWorkflowId", "createdAt", "updatedAt" FROM applications WHERE id = $1',
      [id]
    );
    if (!appRows[0]) throw new NotFoundException('文档不存在');
    const row = appRows[0];
    return {
      id: row.id, title: row.title, description: row.description,
      categoryId: row.categoryId, amount: row.amount, ownerId: row.ownerId,
      status: row.status, currentInstanceId: row.currentInstanceId,
      defaultWorkflowId: row.defaultWorkflowId, createdAt: row.createdAt,
      updatedAt: row.updatedAt, _fromApplication: true
    } as unknown as Document;
  }

  async addVersion(userId: string, documentId: string, file: Express.Multer.File, dto: CreateVersionDto) {
    const doc = await this.getDocument(documentId);
    if (doc.ownerId !== userId) throw new ForbiddenException('只能操作自己的文档');
    if (![DocumentStatus.Draft, DocumentStatus.Rejected].includes(doc.status)) {
      throw new BadRequestException('仅草稿或已驳回的文档可更新版本');
    }
    this.validateFile(file);
    const checksum = sha1(fs.readFileSync(file.path));
    const max = await this.versionRepo
      .createQueryBuilder('v')
      .select('COALESCE(MAX(v.versionNo), 0)', 'max')
      .where('v.documentId = :documentId', { documentId })
      .getRawOne<{ max: string }>();
    const version = await this.versionRepo.save(
      this.versionRepo.create({
        documentId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        filePath: file.path,
        checksum,
        versionNo: Number(max?.max ?? 0) + 1,
        reason: dto.reason ?? null,
        uploadedBy: userId
      })
    );
    await this.jobRepo.save(this.jobRepo.create({ documentVersionId: version.id }));
    doc.updatedAt = new Date();
    await this.docRepo.save(doc);
    const ownerNames0 = await this.loadOwnerNames([doc.ownerId]);
    return this.toDto(doc, version, ownerNames0.get(doc.ownerId) ?? null);
  }

  async listVersions(user: AuthUser, documentId: string) {
    await this.assertCanView(user, documentId);
    return this.versionRepo.find({ where: { documentId }, order: { versionNo: 'DESC' } });
  }

  async streamDownload(user: AuthUser, documentId: string, versionId: string, res: any) {
    await this.assertCanView(user, documentId);
    const version = await this.versionRepo.findOneBy({ id: versionId, documentId });
    if (!version) throw new NotFoundException('版本不存在');
    if (!fs.existsSync(version.filePath)) throw new NotFoundException('文件已丢失');
    res.download(version.filePath, version.fileName);
  }

  async streamPreview(user: AuthUser, documentId: string, versionId: string, res: any) {
    await this.assertCanView(user, documentId);
    let version = await this.versionRepo.findOneBy({ id: versionId, documentId });
    if (!version) {
      const fileRows = await this.dataSource.query(
        'SELECT id, "fileName", "mimeType", "filePath" FROM application_files WHERE id = $1 AND "applicationId" = $2',
        [versionId, documentId]
      );
      if (fileRows[0]) {
        const f = fileRows[0];
        const previewPath = path.resolve(f.filePath);
        if (fs.existsSync(previewPath)) {
          res.type(f.mimeType || 'application/pdf');
          res.sendFile(previewPath);
          return;
        }
        throw new NotFoundException('文件不存在');
      }
      throw new NotFoundException('版本不存在');
    }
    const job = await this.jobRepo.findOneBy({ documentVersionId: versionId });
    if (!job || job.status === 'pending') { res.status(202).json({ converting: true }); return; }
    if (job.status === 'failed' || !job.previewPath || !fs.existsSync(job.previewPath)) {
      res.status(422).json({ previewFailed: true });
      return;
    }
    res.type('application/pdf');
    res.sendFile(path.resolve(job.previewPath));
  }

  async retryConvert(user: AuthUser, versionId: string) {
    const version = await this.versionRepo.findOneBy({ id: versionId });
    if (!version) throw new NotFoundException('版本不存在');
    const doc = await this.getDocument(version.documentId);
    if (doc.ownerId !== user.id && !user.permissions.includes('user:manage')) throw new ForbiddenException('无权操作');
    let job = await this.jobRepo.findOneBy({ documentVersionId: versionId });
    if (!job) job = await this.jobRepo.save(this.jobRepo.create({ documentVersionId: versionId }));
    job.status = 'pending';
    job.error = null;
    await this.jobRepo.save(job);
    await this.converter.convert(job.id);
    const updated = await this.jobRepo.findOneBy({ id: job.id });
    return { status: updated?.status ?? 'failed' };
  }

  private assertBasicView(userId: string, doc: Document) {
    if (doc.ownerId !== userId) throw new ForbiddenException('无权查看该文档');
  }

  private validateFile(file: Express.Multer.File) {
    if (!ALLOWED_MIME[file.mimetype]) {
      fs.unlinkSync(file.path);
      throw new BadRequestException('不支持的文件类型');
    }
    if (file.size > MAX_FILE_SIZE) {
      fs.unlinkSync(file.path);
      throw new BadRequestException('文件超过 20MB');
    }
  }


  private async loadOwnerNames(ownerIds: string[]): Promise<Map<string, string>> {
    const ids = Array.from(new Set(ownerIds.filter(Boolean)));
    if (ids.length === 0) return new Map();
    try {
      const rows = await this.dataSource.query(
        'SELECT id, name FROM users WHERE id = ANY($1::uuid[])',
        [ids]
      );
      const map = new Map<string, string>();
      for (const r of rows as Array<{ id: string; name: string }>) map.set(r.id, r.name);
      return map;
    } catch {
      return new Map();
    }
  }

  private async toDto(
    doc: Document,
    latest?: DocumentVersion,
    ownerName?: string | null,
    currentReviewer: Array<{ userId: string; name: string }> | null = null
  ): Promise<DocumentDto> {
    const version = latest ?? (await this.versionRepo.findOne({ where: { documentId: doc.id }, order: { versionNo: 'DESC' } }));
    const filteredReviewer = currentReviewer && currentReviewer.length > 0 ? currentReviewer : null;
    return {
      id: doc.id,
      title: doc.title,
      description: doc.description,
      categoryId: doc.categoryId,
      amount: doc.amount,
      status: doc.status,
      ownerId: doc.ownerId,
      ownerName: ownerName ?? null,
      currentInstanceId: doc.currentInstanceId,
      defaultWorkflowId: doc.defaultWorkflowId,
      currentReviewer: filteredReviewer,
      createdAt: doc.createdAt.toISOString(),
      latestVersion: version
        ? { id: version.id, versionNo: version.versionNo, fileName: version.fileName, size: version.size, mimeType: version.mimeType }
        : null
    };
  }

  private async loadCurrentReviewers(items: Document[]): Promise<Map<string, Array<{ userId: string; name: string }>>> {
    const inApproval = items.filter((d) => d.status === DocumentStatus.InApproval && !!d.currentInstanceId);
    if (inApproval.length === 0) return new Map();
    const instanceIds = inApproval.map((d) => d.currentInstanceId!).filter((id): id is string => !!id);
    return this.engine.getCurrentReviewersForInstances(instanceIds);
  }

  async remove(user: AuthUser, id: string) {
    const doc = await this.getDocument(id);
    if (!user?.permissions || !user.permissions.includes('user:manage')) {
      throw new ForbiddenException('只有系统管理员才能删除文档');
    }
    const versions = await this.versionRepo.find({ where: { documentId: id } });
    const versionIds = versions.map((v) => v.id);
    if (doc.currentInstanceId) {
      try {
        await this.engine.withdraw(doc.currentInstanceId, user.id);
      } catch (e: any) {
        // 管理员硬删除：如果审批已有节点被处理或已结束，retract() 会报错；
        // 下面的事务会把 approval_instances/records/tasks 全部删掉，所以跳过抽回也不影响一致性。
      }
    }
    await this.dataSource.transaction(async (manager) => {
      const instanceIds = (await manager.query(
        'SELECT id FROM approval_instances WHERE "documentId" = $1',
        [id]
      )) as Array<{ id: string }>;
      const iids = instanceIds.map((r) => r.id);
      if (iids.length > 0) {
        await manager.query('DELETE FROM approval_records WHERE "instanceId" = ANY($1::uuid[])', [iids]);
        await manager.query('DELETE FROM approval_tasks WHERE "instanceId" = ANY($1::uuid[])', [iids]);
        await manager.query('DELETE FROM approval_instances WHERE "documentId" = $1', [id]);
      }
      if (versionIds.length > 0) {
        await manager.query('DELETE FROM conversion_jobs WHERE "documentVersionId" = ANY($1::uuid[])', [versionIds]);
      }
      await manager.query('DELETE FROM document_versions WHERE "documentId" = $1', [id]);
      await manager.query('DELETE FROM documents WHERE id = $1', [id]);
    });
    for (const v of versions) {
      try { if (fs.existsSync(v.filePath)) fs.unlinkSync(v.filePath); } catch { /* noop */ }
    }
    try {
      const jobs = await this.jobRepo.find({ where: versionIds.map((vid) => ({ documentVersionId: vid })) as any });
      for (const j of jobs) {
        if (j.previewPath && fs.existsSync(j.previewPath)) {
          try { fs.unlinkSync(j.previewPath); } catch { /* noop */ }
        }
      }
    } catch { /* noop */ }
    await this.audit.log(user.id, 'document:delete', 'document', id, { title: doc.title, versionCount: versions.length });
    return { ok: true };
  }
}
