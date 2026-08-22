import { Test } from "@nestjs/testing";
import { describe, it, expect, beforeAll } from "vitest";
import { TerminusModule } from "@nestjs/terminus";
import { HealthController } from "./health.controller.js";
import { HealthService } from "./health.service.js";

describe("HealthController", () => {
  let controller: HealthController;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();
    controller = module.get(HealthController);
  });
  it("returns ok from live endpoint", () => {
    const result = controller.live();
    expect(result.status).toBe("ok");
    expect(result.timestamp).toBeTypeOf("string");
  });
  it("returns ok from ready endpoint", async () => {
    const result = await controller.ready();
    expect(result.status).toBe("ok");
  });
});
