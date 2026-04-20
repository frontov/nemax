import { Module } from "@nestjs/common";
import { PushModule } from "../push/push.module";
import { NotificationsController } from "./notifications.controller";
import { NotificationsQueue } from "./notifications.queue";
import { NotificationsRepository } from "./notifications.repository";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [PushModule],
  controllers: [NotificationsController],
  providers: [NotificationsQueue, NotificationsRepository, NotificationsService],
  exports: [NotificationsQueue, NotificationsService],
})
export class NotificationsModule {}
