import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  list() {
    return this.departments.list();
  }

  @Get('tree')
  tree() {
    return this.departments.tree();
  }

  @Post()
  @RequirePermission('department:manage')
  create(@Body() dto: CreateDepartmentDto) {
    return this.departments.create(dto);
  }

  @Patch(':id')
  @RequirePermission('department:manage')
  update(@Param('id') id: string, @Body() dto: CreateDepartmentDto) {
    return this.departments.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('department:manage')
  remove(@Param('id') id: string) {
    return this.departments.remove(id);
  }
}