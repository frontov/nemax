import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PushController } from "./push.controller";
import { PushRepository } from "./push.repository";
import { PushService } from "./push.service";
import { PushWebService } from "./push.web.service";

@Module({
  imports: [AuthModule],
  controllers: [PushController],
  providers: [PushRepository, PushService, PushWebService],
  exports: [PushService],
})
export class PushModule {}
