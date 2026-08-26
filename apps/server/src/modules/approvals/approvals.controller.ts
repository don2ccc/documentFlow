import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AuthUser } from '@document-flow/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ApprovalEngineService } from './approval-engine.service';
import { ApproveTaskDto } from './dto/approve-task.dto';
import { RejectTaskDto } from './dto/reject-task.dto';
import { TransferTaskDto } from './dto/transfer-task.dto';

@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly engine: ApprovalEngineService) {}

  @Get('instances/:id/progress')
  progress(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.engine.getProgress(user, id);
  }

  @Get('todos')
  todos(@CurrentUser() user: AuthUser, @Query() query: { keyword?: string; page?: number; pageSize?: number }) {
    return this.engine.todos(user, query);
  }

  @Post('tasks/:id/transfer')
  @RequirePermission('approval:handle')
  async transfer(@Param('id') id: string, @Body() dto: TransferTaskDto, @CurrentUser() user: AuthUser) {
    await this.engine.transfer(id, user.id, dto.toUserId, dto.comment);
    return { ok: true };
  }

  @Post('tasks/:id/approve')
  @RequirePermission('approval:handle')
  async approve(@Param('id') id: string, @Body() dto: ApproveTaskDto, @CurrentUser() user: AuthUser) {
    await this.engine.handleTask(id, user.id, 'approve', dto.comment);
    return { ok: true };
  }

  @Post('tasks/:id/reject')
  @RequirePermission('approval:handle')
  async reject(@Param('id') id: string, @Body() dto: RejectTaskDto, @CurrentUser() user: AuthUser) {
    await this.engine.handleTask(id, user.id, 'reject', dto.comment);
    return { ok: true };
  }
}