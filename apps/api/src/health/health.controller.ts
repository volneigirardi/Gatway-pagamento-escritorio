import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from "@nestjs/terminus";
import { HealthService } from "./health.service.js";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly healthService: HealthService,
  ) {}

  @Get("live")
  @ApiOperation({ summary: "Liveness probe" })
  live(): { status: string; timestamp: string } {
    const base = this.healthService.isHealthy();
    return { ...base, timestamp: new Date().toISOString() };
  }

  @Get("ready")
  @ApiOperation({ summary: "Readiness probe" })
  @HealthCheck()
  async ready() {
    return this.health.check([
      () => this.memory.checkHeap("memory_heap", 512 * 1024 * 1024),
    ]);
  }
}
