import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { FamiliesController } from "./families.controller";
import { FamiliesRepository } from "./families.repository";
import { FamiliesService } from "./families.service";

@Module({
  imports: [AuditModule],
  controllers: [FamiliesController],
  providers: [FamiliesRepository, FamiliesService],
})
export class FamiliesModule {}
