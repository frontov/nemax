import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { MessagesController } from "./messages.controller";
import { MessagesService } from "./messages.service";
import { MessagesEventsService } from "./messages.events.service";
import { MessagesRepository } from "./messages.repository";

@Module({
  imports: [NotificationsModule, AuditModule],
  controllers: [MessagesController],
  providers: [MessagesRepository, MessagesService, MessagesEventsService],
})
export class MessagesModule {}
