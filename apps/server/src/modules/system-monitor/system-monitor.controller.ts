import { Controller, Get } from "@nestjs/common";
import { SystemMonitorService, StorageInfo } from "./system-monitor.service";

@Controller("system-monitor")
export class SystemMonitorController {
  constructor(private readonly monitor: SystemMonitorService) {}

  @Get("storage")
  storage(): Promise<StorageInfo> {
    return this.monitor.getStorage();
  }
}
