import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { InvitesDirectController } from "./invites.direct.controller";
import { InvitesController } from "./invites.controller";
import { InvitesRepository } from "./invites.repository";
import { InvitesService } from "./invites.service";
import { InvitesQrService } from "./invites.qr.service";

@Module({
  imports: [AuditModule],
  controllers: [InvitesController, InvitesDirectController],
  providers: [InvitesRepository, InvitesService, InvitesQrService],
})
export class InvitesModule {}
