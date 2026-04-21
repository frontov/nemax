import { Module } from "@nestjs/common";
import { MessagesModule } from "../messages/messages.module";
import { AttachmentsController } from "./attachments.controller";
import { AttachmentsRepository } from "./attachments.repository";
import { AttachmentsService } from "./attachments.service";

@Module({
  imports: [MessagesModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsRepository, AttachmentsService],
})
export class AttachmentsModule {}
