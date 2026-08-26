import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { AuthUser, DocumentStatus } from '@document-flow/shared';
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
    private readonly dataSource: DataSource
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
        status: DocumentStatus.Draft
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
    return this.toDto(doc, version);
  }

  async findVisible(userId: string, query: { status?: string; categoryId?: string; keyword?: string; page?: number; pageSize?: number }) {
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
      const dtos = await Promise.all(items.map((d) => this.toDto(d)));
      return { items: dtos, total, page, pageSize };
    };
    try {
      const qb = applyFilters(
        this.docRepo.createQueryBuilder('d').where(
          '(d.ownerId = :userId OR EXISTS (SELECT 1 FROM approval_instances ai WHERE ai."documentId" = d.id AND (ai."initiatorId" = :userId OR ai.id IN (SELECT ar."instanceId" FROM approval_records ar WHERE ar."actorId" = :userId))))',
          { userId }
        )
      );
      return await finish(qb);
    } catch (e) {
      if (String((e as Error).message).includes('does not exist')) {
        return await finish(applyFilters(this.docRepo.createQueryBuilder('d').where('d.ownerId = :userId', { userId })));
      }
      throw e;
    }
  }

  async getDetail(user: AuthUser, id: string) {
    const doc = await this.assertCanView(user, id);
    const versions = await this.versionRepo.find({ where: { documentId: id }, order: { versionNo: 'DESC' } });
    return { ...(await this.toDto(doc)), versions, progress: null };
  }

  async assertCanView(user: AuthUser, documentId: string): Promise<Document> {
    const doc = await this.getDocument(documentId);
    if (user.permissions.includes('user:manage')) return doc;
    if (doc.ownerId === user.id) return doc;
    try {
      const involved = await this.dataSource.query(
        'SELECT COUNT(*)::int AS c FROM approval_instances ai WHERE ai."documentId" = $1 AND (ai."initiatorId" = $2 OR EXISTS (SELECT 1 FROM approval_records ar WHERE ar."instanceId" = ai.id AND ar."actorId" = $2))',
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
    if (!doc) throw new NotFoundException('文档不存在');
    return doc;
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
    return this.toDto(doc, version);
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
    const version = await this.versionRepo.findOneBy({ id: versionId, documentId });
    if (!version) throw new NotFoundException('版本不存在');
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

  private async toDto(doc: Document, latest?: DocumentVersion): Promise<DocumentDto> {
    const version = latest ?? (await this.versionRepo.findOne({ where: { documentId: doc.id }, order: { versionNo: 'DESC' } }));
    return {
      id: doc.id,
      title: doc.title,
      description: doc.description,
      categoryId: doc.categoryId,
      amount: doc.amount,
      status: doc.status,
      ownerId: doc.ownerId,
      createdAt: doc.createdAt.toISOString(),
      latestVersion: version
        ? { id: version.id, versionNo: version.versionNo, fileName: version.fileName, size: version.size, mimeType: version.mimeType }
        : null
    };
  }
}