import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApplicationFile } from '../applications/entities/application-file.entity';
import { ApprovalRecord } from '../approvals/entities/approval-record.entity';
import { UserSignatureService } from './user-signature.service';

const CJK_FONT_PATH = '/usr/share/fonts/truetype/noto-cjk/NotoSansCJK-Bold-SC.ttf';
const SEAL_COLOR = rgb(0.82, 0.10, 0.10);
const SEAL_RADIUS = 56;
const STAMP_SIZE = 112; // user image stamp side length in pt

@Injectable()
export class SignatureService {
  private readonly log = new Logger(SignatureService.name);
  private fontBytes: Buffer | null = null;

  constructor(
    @InjectRepository(ApplicationFile) private readonly fileRepo: Repository<ApplicationFile>,
    @InjectRepository(ApprovalRecord) private readonly recordRepo: Repository<ApprovalRecord>,
    private readonly userSig: UserSignatureService
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
      // Try to load the final approver's personal signature image (if uploaded)
      const userStamp = signer.id && signer.id !== '00000000-0000-0000-0000-000000000000'
        ? await this.userSig.getRawForUser(signer.id)
        : null;
      const signedAt = new Date();
      for (const f of pdfs) {
        try {
          const outPath = this.makeSignedPath(f.filePath);
          await fs.mkdir(path.dirname(outPath), { recursive: true });
          await this.signPdf(f.filePath, outPath, signer.name, signedAt, userStamp ?? undefined);
          await this.fileRepo.update({ id: f.id }, {
            signedPath: outPath,
            signedAt,
            signedBy: signer.id,
            signedByName: signer.name
          });
          this.log.log(`signed ${f.fileName} -> ${outPath} (customStamp=${userStamp ? 'yes' : 'no'})`);
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

  /** Stamp a single PDF: red round seal + signer info on the last page. */
  private async signPdf(
    input: string,
    output: string,
    signerName: string,
    signedAt: Date,
    userStamp?: { bytes: Buffer; mimeType: string }
  ): Promise<void> {
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

    if (userStamp) {
      // User uploaded a personal signature image; draw it centered on the stamp spot.
      let img;
      try {
        if (/png/i.test(userStamp.mimeType)) {
          img = await pdfDoc.embedPng(userStamp.bytes);
        } else if (/jpe?g/i.test(userStamp.mimeType)) {
          img = await pdfDoc.embedJpg(userStamp.bytes);
        } else {
          throw new Error(`unsupported signature mime: ${userStamp.mimeType}`);
        }
      } catch (e) {
        this.log.warn(`user signature image failed to embed, falling back to text stamp: ${(e as Error).message}`);
        this.drawTextStamp(lastPage, font, cx, cy, signerName, signedAt);
        const out = await pdfDoc.save();
        await fs.writeFile(output, out);
        return;
      }
      const dims = img.scaleToFit(STAMP_SIZE, STAMP_SIZE);
      lastPage.drawImage(img, {
        x: cx - dims.width / 2,
        y: cy - dims.height / 2,
        width: dims.width,
        height: dims.height
      });
      // Small caption under the image showing who signed + date
      const dateStr = signedAt.toISOString().slice(0, 10);
      const cap = `${signerName}  ${dateStr}`;
      const capSize = 7;
      const capWidth = font.widthOfTextAtSize(cap, capSize);
      lastPage.drawText(cap, {
        x: cx - capWidth / 2,
        y: cy - STAMP_SIZE / 2 - 10,
        size: capSize,
        font,
        color: rgb(0.35, 0.35, 0.35)
      });
    } else {
      this.drawTextStamp(lastPage, font, cx, cy, signerName, signedAt);
    }

    const out = await pdfDoc.save();
    await fs.writeFile(output, out);
  }

  /** Default red round seal with embedded Chinese label, used when no personal signature uploaded. */
  private drawTextStamp(
    lastPage: any,
    font: any,
    cx: number,
    cy: number,
    signerName: string,
    signedAt: Date
  ): void {
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

    // Small star under label (using the same CJK font which includes basic symbols)
    const star = '\u2605';
    const starSize = 10;
    const starWidth = font.widthOfTextAtSize(star, starSize);
    lastPage.drawText(star, {
      x: cx - starWidth / 2,
      y: cy - 18,
      size: starSize,
      font,
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
  }
}
