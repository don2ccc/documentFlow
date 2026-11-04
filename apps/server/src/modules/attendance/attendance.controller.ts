import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UploadedFile, UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthUser } from '@document-flow/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AttendanceService, MAX_ATTENDANCE_FILE_SIZE } from './attendance.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { ListResultsQueryDto } from './dto/list-results-query.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  // ---------------- 班次 ----------------

  @Get('shifts')
  @RequirePermission('hr:attendance:view')
  listShifts() {
    return this.attendance.listShifts();
  }

  @Post('shifts')
  @RequirePermission('hr:attendance:manage')
  createShift(@Body() dto: CreateShiftDto, @CurrentUser() user: AuthUser) {
    return this.attendance.createShift(dto, user);
  }

  @Patch('shifts/:id')
  @RequirePermission('hr:attendance:manage')
  updateShift(@Param('id') id: string, @Body() dto: UpdateShiftDto, @CurrentUser() user: AuthUser) {
    return this.attendance.updateShift(id, dto, user);
  }

  @Delete('shifts/:id')
  @RequirePermission('hr:attendance:manage')
  removeShift(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.attendance.removeShift(id, user);
  }

  // ---------------- 上传批次 ----------------

  @Get('uploads')
  @RequirePermission('hr:attendance:view')
  listUploads() {
    return this.attendance.listUploads();
  }

  @Post('uploads')
  @RequirePermission('hr:attendance:manage')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ATTENDANCE_FILE_SIZE } }))
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('shiftId') shiftId: string | undefined,
    @CurrentUser() user: AuthUser
  ) {
    return this.attendance.upload(file, shiftId || undefined, user);
  }

  @Delete('uploads/:id')
  @RequirePermission('hr:attendance:manage')
  removeUpload(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.attendance.removeUpload(id, user);
  }

  @Get('uploads/:id/export')
  @RequirePermission('hr:attendance:view')
  async exportUpload(
    @Param('id') id: string,
    @Query() query: ListResultsQueryDto,
    @Res() res: Response
  ) {
    const { buffer, fileName } = await this.attendance.exportResults(id, query);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="attendance.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    res.send(buffer);
  }

  // ---------------- 结果 ----------------

  @Get('results')
  @RequirePermission('hr:attendance:view')
  results(@Query() query: ListResultsQueryDto) {
    return this.attendance.results(query);
  }
}
