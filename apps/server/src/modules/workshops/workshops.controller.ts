import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { WorkshopsService } from './workshops.service';
import { CreateWorkshopDto } from './dto/create-workshop.dto';

@Controller('workshops')
export class WorkshopsController {
  constructor(private readonly workshops: WorkshopsService) {}

  @Get()
  list() {
    return this.workshops.list();
  }

  @Get('tree')
  tree() {
    return this.workshops.tree();
  }

  @Post()
  @RequirePermission('workshop:manage')
  create(@Body() dto: CreateWorkshopDto) {
    return this.workshops.create(dto);
  }

  @Patch(':id')
  @RequirePermission('workshop:manage')
  update(@Param('id') id: string, @Body() dto: CreateWorkshopDto) {
    return this.workshops.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('workshop:manage')
  remove(@Param('id') id: string) {
    return this.workshops.remove(id);
  }
}
