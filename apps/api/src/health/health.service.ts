import { Injectable } from "@nestjs/common";

@Injectable()
export class HealthService {
  isHealthy(): { status: string } {
    return { status: "ok" };
  }
}
