import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { WorkflowStatus } from '@document-flow/shared';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { SaveWorkflowDto } from './dto/save-workflow.dto';
import { WorkflowsService } from './workflows.service';

@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Get()
  findAll(@Query() query: { status?: string; keyword?: string }) {
    return this.workflows.findAll(query);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.workflows.getById(id);
  }

  @Post()
  @RequirePermission('workflow:manage')
  create(@Body() dto: { name: string; description?: string }) {
    return this.workflows.create(dto);
  }

  @Put(':id/nodes')
  @RequirePermission('workflow:manage')
  saveNodes(@Param('id') id: string, @Body() dto: SaveWorkflowDto) {
    return this.workflows.saveNodes(id, dto);
  }

  @Post(':id/activate')
  @RequirePermission('workflow:manage')
  activate(@Param('id') id: string) {
    return this.workflows.setStatus(id, WorkflowStatus.Active);
  }

  @Post(':id/deactivate')
  @RequirePermission('workflow:manage')
  deactivate(@Param('id') id: string) {
    return this.workflows.setStatus(id, WorkflowStatus.Disabled);
  }
}