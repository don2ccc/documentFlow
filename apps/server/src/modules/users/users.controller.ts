import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UserBriefDto } from '@document-flow/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
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
}