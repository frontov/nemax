import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { DevicesController, DevicesLinkController } from "./devices.controller";
import { DevicesRepository } from "./devices.repository";
import { DevicesService } from "./devices.service";

@Module({
  imports: [AuditModule],
  controllers: [DevicesController, DevicesLinkController],
  providers: [DevicesRepository, DevicesService],
})
export class DevicesModule {}
