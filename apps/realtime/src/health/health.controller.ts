import { Controller, Get, HttpException, HttpStatus } from "@nestjs/common";
import { HealthService } from "./health.service.js";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  live(): { status: string; timestamp: string } {
    return { ...this.healthService.isLive(), timestamp: new Date().toISOString() };
  }

  @Get("live")
  liveProbe(): { status: string; timestamp: string } {
    return this.live();
  }

  @Get("ready")
  async ready(): Promise<{ status: string; redis: string }> {
    try {
      return await this.healthService.isReady();
    } catch (err) {
      throw new HttpException(
        {
          status: "error",
          message: err instanceof Error ? err.message : "unknown error",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
