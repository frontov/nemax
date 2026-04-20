import { Module } from "@nestjs/common";
import { ReadsController } from "./reads.controller";
import { ReadsRepository } from "./reads.repository";
import { ReadsService } from "./reads.service";

@Module({
  controllers: [ReadsController],
  providers: [ReadsRepository, ReadsService],
})
export class ReadsModule {}
