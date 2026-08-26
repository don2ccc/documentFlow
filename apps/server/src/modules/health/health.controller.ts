import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/require-permission.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  health() {
    return { status: 'ok', time: new Date().toISOString() };
  }
}