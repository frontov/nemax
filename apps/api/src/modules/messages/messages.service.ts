import { Injectable } from "@nestjs/common";
import { BadRequestException } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { AuthService, type SessionContext } from "../auth/auth.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CreateMessageDto } from "./dto/create-message.dto";
import { MessagesEventsService } from "./messages.events.service";
import { MessagesRepository } from "./messages.repository";

function isEncryptedText(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  try {
    const parsed = JSON.parse(value) as { v?: number; alg?: string };
    return parsed.v === 1 && parsed.alg === "AES-GCM";
  } catch {
    return false;
  }
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly messagesRepository: MessagesRepository,
    private readonly messagesEventsService: MessagesEventsService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    private readonly authService: AuthService,
  ) {}

  async listMessages(sessionContext: SessionContext) {
    const member = this.authService.assertFamilyAccess(sessionContext);
    return this.messagesRepository.listFamilyMessages(member.familyId);
  }

  async sendMessage(sessionContext: SessionContext, input: CreateMessageDto) {
    const member = this.authService.assertFamilyAccess(sessionContext);

    if (!input.text.trim()) {
      throw new BadRequestException("Message text is required");
    }

    if (!isEncryptedText(input.text)) {
      throw new BadRequestException("Message must be end-to-end encrypted");
    }

    let replyToMessage = null;

    if (input.replyToMessageId) {
      replyToMessage = await this.messagesRepository.findActiveMessageForFamily(
        input.replyToMessageId,
        member.familyId,
      );

      if (!replyToMessage) {
        throw new BadRequestException("Reply target message was not found");
      }
    }

    const message = await this.messagesRepository.createMessage({
      familyId: member.familyId,
      senderUserId: sessionContext.user.id,
      text: input.text.trim(),
      replyToMessageId: replyToMessage?.id,
      clientTempId: input.clientTempId,
    });

    this.messagesEventsService.emitMessageCreated(member.familyId, {
      id: message.id,
      text: message.text,
      familyId: message.familyId,
      senderUserId: message.senderUserId,
      createdAt: message.createdAt,
      sender: {
        id: message.sender.id,
        displayName: message.sender.displayName,
      },
      replyToMessage: message.replyToMessage
        ? {
            id: message.replyToMessage.id,
            text: message.replyToMessage.text,
            sender: {
              id: message.replyToMessage.sender.id,
              displayName: message.replyToMessage.sender.displayName,
            },
          }
        : null,
    });

    await this.notificationsService.enqueueMessageNotification({
      familyId: member.familyId,
      senderUserId: sessionContext.user.id,
      senderDisplayName: sessionContext.user.displayName,
      messageId: message.id,
      text: isEncryptedText(message.text) ? "Новое зашифрованное сообщение" : (message.text ?? ""),
    });

    await this.auditService.log({
      familyId: member.familyId,
      userId: sessionContext.user.id,
      actorUserId: sessionContext.user.id,
      eventType: "message.created",
      payloadJson: {
        messageId: message.id,
      },
    });

    return message;
  }
}
