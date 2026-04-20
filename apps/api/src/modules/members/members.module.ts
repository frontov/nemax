import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { MembersController } from "./members.controller";
import { MembersRepository } from "./members.repository";
import { MembersService } from "./members.service";

@Module({
  imports: [AuditModule],
  controllers: [MembersController],
  providers: [MembersRepository, MembersService],
})
export class MembersModule {}
