import {
  Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, Res, UploadedFile, UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { AuthUser } from '@document-flow/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { ListEmployeesQueryDto } from './dto/list-employees-query.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService, MAX_PHOTO_SIZE } from './employees.service';

@Controller('hr/employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @RequirePermission('hr:view')
  list(@Query() query: ListEmployeesQueryDto) {
    return this.employees.list(query);
  }

  @Get(':id')
  @RequirePermission('hr:view')
  get(@Param('id') id: string) {
    return this.employees.get(id);
  }

  /** 照片走带鉴权的接口，不下发文件系统路径 */
  @Get(':id/photo')
  @RequirePermission('hr:view')
  async photo(@Param('id') id: string, @Res() res: Response) {
    const file = await this.employees.getPhotoFile(id);
    if (!file) throw new NotFoundException('照片不存在');
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Cache-Control', 'private, max-age=300');
    fs.createReadStream(file.absolutePath).pipe(res);
  }

  @Post()
  @RequirePermission('hr:manage')
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: AuthUser) {
    return this.employees.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermission('hr:manage')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto, @CurrentUser() user: AuthUser) {
    return this.employees.update(id, dto, user.id);
  }

  @Patch(':id/active')
  @RequirePermission('hr:manage')
  setActive(@Param('id') id: string, @Body() body: { active?: boolean }, @CurrentUser() user: AuthUser) {
    return this.employees.setActive(id, !!body?.active, user.id);
  }

  /**
 * 停用（逻辑删除）：置 active=false，记录仍在库中，可在「已停用」筛选下查到。
 * 保留历史，避免旧档案断链。
 */
@Delete(':id')
  @RequirePermission('hr:manage')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.employees.remove(id, user.id);
  }

  /**
 * 彻底删除：物理移除行与照片文件，删除后无法再查询到。
 * 仅允许删除已停用的档案，避免误删在职员工。
 */
@Delete(':id/permanent')
  @RequirePermission('hr:manage')
  removePermanent(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.employees.removePermanent(id, user.id);
  }

  @Post(':id/photo')
  @RequirePermission('hr:manage')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PHOTO_SIZE } }))
  uploadPhoto(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthUser) {
    return this.employees.uploadPhoto(id, file, user.id);
  }
}