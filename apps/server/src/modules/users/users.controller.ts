import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { UserBriefDto } from '@document-flow/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangeOwnPasswordDto } from '../auth/dto/change-own-password.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission('user:manage')
  findAll(@Query() query: ListUsersQueryDto) {
    return this.users.findAll(query);
  }

  @Post()
  @RequirePermission('user:manage')
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  // 当前登录用户获取自己的完整资料
  @Get('me')
  getMe(@CurrentUser() user: { id: string }) {
    return this.users.getMe(user.id);
  }

  // 当前登录用户自助修改资料：用户名/姓名只读
  @Put('me')
  updateMe(@CurrentUser() user: { id: string }, @Body() dto: UpdateMeDto) {
    return this.users.updateMe(user.id, dto);
  }

  // 当前登录用户修改自己的密码
  @Post('me/change-password')
  changeMyPassword(@CurrentUser() user: { id: string }, @Body() dto: ChangeOwnPasswordDto) {
    return this.users.changeOwnPassword(user.id, dto.newPassword);
  }

  @Patch(':id/status')
  @RequirePermission('user:manage')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto, @CurrentUser() user: { id: string }) {
    return this.users.updateStatus(id, dto.status, user.id);
  }

  @Post(':id/reset-password')
  @RequirePermission('user:manage')
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.users.resetPassword(id, dto.newPassword);
  }

  @Delete(':id')
  @RequirePermission('user:manage')
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.users.delete(id, user.id);
  }

  @Patch(':id')
  @RequirePermission('user:manage')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: { id: string }) {
    return this.users.update(id, dto, user.id);
  }

  // 审批通过待激活账号：激活 + 生成初始密码 + 通过邮件发送账号通知
  @Post(':id/approve')
  @RequirePermission('user:manage')
  approve(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.users.approve(id, user.id);
  }
}