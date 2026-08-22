import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
@ApiTags("Version")
@Controller({ path: "version", version: "1" })
export class VersionController {
  @Get()
  @ApiOperation({ summary: "Application version" })
  getVersion(): { version: string } {
    return { version: process.env["npm_package_version"] ?? "0.0.0" };
  }
}
