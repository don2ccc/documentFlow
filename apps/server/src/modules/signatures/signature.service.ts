import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApplicationFile } from '../applications/entities/application-file.entity';
import { ApprovalRecord } from '../approvals/entities/approval-record.entity';

const CJK_FONT_PATH = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc';
const SEAL_COLOR = rgb(0.82, 0.10, 0.10);
const SEAL_RADIUS = 56;

@Injectable()
export class SignatureService {
  private readonly log = new Logger(SignatureService.name);
  private fontBytes: Buffer | null = null;

  constructor(
    @InjectRepository(ApplicationFile) private readonly fileRepo: Repository<ApplicationFile>,
    @InjectRepository(ApprovalRecord) private readonly recordRepo: Repository<ApprovalRecord>
  ) {}

  private async loadFont(): Promise<Buffer> {
    if (this.fontBytes) return this.fontBytes;
    this.fontBytes = await fs.readFile(CJK_FONT_PATH);
    return this.fontBytes;
  }

  /** Stamp all PDF files of an application. Idempotent: skips files already signed. */
  async signApplicationFiles(applicationId: string, instanceId: string): Promise<void> {
    try {
      const files = await this.fileRepo.find({
        where: { applicationId },
        order: { createdAt: 'ASC' }
      });
      const pdfs = files.filter((f) => /pdf/i.test(f.mimeType) && !f.signedPath);
      if (pdfs.length === 0) {
        this.log.log(`no pdf files to sign for application ${applicationId}`);
        return;
      }
      const signer = await this.findFinalApprover(instanceId);
      const signedAt = new Date();
      for (const f of pdfs) {
        try {
          const outPath = this.makeSignedPath(f.filePath);
          await fs.mkdir(path.dirname(outPath), { recursive: true });
          await this.signPdf(f.filePath, outPath, signer.name, signedAt);
          await this.fileRepo.update({ id: f.id }, {
            signedPath: outPath,
            signedAt,
            signedBy: signer.id,
            signedByName: signer.name
          });
          this.log.log(`signed ${f.fileName} -> ${outPath}`);
        } catch (e) {
          this.log.error(`failed to sign ${f.fileName}: ${(e as Error).message}`);
        }
      }
    } catch (e) {
      this.log.error(`signApplicationFiles(${applicationId}) failed: ${(e as Error).message}`);
    }
  }

  /** Pick the final approver from the most recent Approve record of this instance. */
  private async findFinalApprover(instanceId: string): Promise<{ id: string; name: string }> {
    const rows = await this.recordRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.actor', 'u')
      .where('r.instanceId = :iid', { iid: instanceId })
      .andWhere("r.action = 'approve'")
      .orderBy('r.createdAt', 'DESC')
      .limit(1)
      .getMany();
    if (rows.length > 0) {
      const r = rows[0] as any;
      return { id: r.actorId, name: r.actor?.name || r.actorId.slice(0, 8) };
    }
    return { id: '00000000-0000-0000-0000-000000000000', name: '系统' };
  }

  /** Output path for a signed version: <orig>-signed.pdf in same dir. */
  private makeSignedPath(orig: string): string {
    const ext = path.extname(orig);
    const base = orig.slice(0, orig.length - ext.length);
    return `${base}-signed${ext}`;
  }

  /** Stamp a single PDF: draw a red round seal + signer info on the last page. */
  private async signPdf(input: string, output: string, signerName: string, signedAt: Date): Promise<void> {
    const fontBytes = await this.loadFont();
    const pdfBytes = await fs.readFile(input);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    pdfDoc.registerFontkit(fontkit);
    const font = await pdfDoc.embedFont(fontBytes, { subset: true });
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const { width, height } = lastPage.getSize();

    // Anchor: bottom-right with 30pt margin
    const cx = width - 90;
    const cy = 100;

    // Outer red circle (thicker line)
    lastPage.drawCircle({ x: cx, y: cy, size: SEAL_RADIUS, borderColor: SEAL_COLOR, borderWidth: 2.5 });
    // Inner thinner ring for the look of a real seal
    lastPage.drawCircle({ x: cx, y: cy, size: SEAL_RADIUS - 8, borderColor: SEAL_COLOR, borderWidth: 0.8 });

    // Top arc text: company line (kept short to fit the ring)
    const topText = 'SPO 审批专用章';
    const topSize = 8;
    const topWidth = font.widthOfTextAtSize(topText, topSize);
    lastPage.drawText(topText, {
      x: cx - topWidth / 2,
      y: cy + SEAL_RADIUS - 14,
      size: topSize,
      font,
      color: SEAL_COLOR
    });

    // Center: bold Chinese label
    const label = '\u5ba1\u6279\u901a\u8fc7';
    const labelSize = 14;
    const labelWidth = font.widthOfTextAtSize(label, labelSize);
    lastPage.drawText(label, {
      x: cx - labelWidth / 2,
      y: cy - labelSize / 2 + 2,
      size: labelSize,
      font,
      color: SEAL_COLOR
    });

    // Small star under label
    lastPage.drawText('\u2605', {
      x: cx - 4,
      y: cy - 18,
      size: 10,
      font: StandardFonts.HelveticaBold,
      color: SEAL_COLOR
    });

    // Bottom arc-ish: signature line (signer + date)
    const dateStr = signedAt.toISOString().slice(0, 10);
    const signLine = `${signerName}  ${dateStr}`;
    const signSize = 7;
    const signWidth = font.widthOfTextAtSize(signLine, signSize);
    lastPage.drawText(signLine, {
      x: cx - signWidth / 2,
      y: cy - SEAL_RADIUS + 8,
      size: signSize,
      font,
      color: SEAL_COLOR
    });

    const out = await pdfDoc.save();
    await fs.writeFile(output, out);
  }
}
