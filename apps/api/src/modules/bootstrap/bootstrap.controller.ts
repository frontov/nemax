import { Controller, Get } from "@nestjs/common";
import { BootstrapService } from "./bootstrap.service";

@Controller()
export class BootstrapController {
  constructor(private readonly bootstrapService: BootstrapService) {}

  @Get("health")
  getHealth() {
    return this.bootstrapService.getHealth();
  }
}
