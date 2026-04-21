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

type MessageWithRelations = Awaited<ReturnType<MessagesRepository["listFamilyMessages"]>>[number];

function serializeMessage(message: MessageWithRelations) {
  return {
    ...message,
    attachments: message.attachments.map((attachment) => ({
      ...attachment,
      sizeBytes: attachment.sizeBytes.toString(),
      url: `/api/attachments/${attachment.id}`,
    })),
    replyToMessage: message.replyToMessage
      ? {
          ...message.replyToMessage,
          attachments: message.replyToMessage.attachments.map((attachment) => ({
            ...attachment,
            sizeBytes: attachment.sizeBytes.toString(),
            url: `/api/attachments/${attachment.id}`,
          })),
        }
      : null,
  };
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
    const messages = await this.messagesRepository.listFamilyMessages(member.familyId);
    return messages.map(serializeMessage);
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

    const serializedMessage = serializeMessage(message);

    this.messagesEventsService.emitMessageCreated(member.familyId, {
      id: serializedMessage.id,
      text: serializedMessage.text,
      familyId: serializedMessage.familyId,
      senderUserId: serializedMessage.senderUserId,
      createdAt: serializedMessage.createdAt,
      attachments: serializedMessage.attachments,
      sender: {
        id: serializedMessage.sender.id,
        displayName: serializedMessage.sender.displayName,
      },
      replyToMessage: serializedMessage.replyToMessage
        ? {
            id: serializedMessage.replyToMessage.id,
            text: serializedMessage.replyToMessage.text,
            sender: {
              id: serializedMessage.replyToMessage.sender.id,
              displayName: serializedMessage.replyToMessage.sender.displayName,
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

    return serializedMessage;
  }

  async sendImageMessage(
    sessionContext: SessionContext,
    input: {
      text: string;
      storageKey: string;
      originalName: string;
      mimeType: string;
      sizeBytes: bigint;
    },
  ) {
    return this.sendImageAlbumMessage(sessionContext, {
      text: input.text,
      attachments: [
        {
          storageKey: input.storageKey,
          originalName: input.originalName,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
        },
      ],
    });
  }

  async sendImageAlbumMessage(
    sessionContext: SessionContext,
    input: {
      text: string;
      replyToMessageId?: string;
      attachments: Array<{
        storageKey: string;
        originalName: string;
        mimeType: string;
        sizeBytes: bigint;
      }>;
    },
  ) {
    const member = this.authService.assertFamilyAccess(sessionContext);

    if (!isEncryptedText(input.text)) {
      throw new BadRequestException("Message must be end-to-end encrypted");
    }

    if (input.attachments.length === 0) {
      throw new BadRequestException("Image file is required");
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
      text: input.text,
      replyToMessageId: replyToMessage?.id,
      attachments: input.attachments,
    });

    const serializedMessage = serializeMessage(message);

    this.messagesEventsService.emitMessageCreated(member.familyId, {
      id: serializedMessage.id,
      text: serializedMessage.text,
      familyId: serializedMessage.familyId,
      senderUserId: serializedMessage.senderUserId,
      createdAt: serializedMessage.createdAt,
      attachments: serializedMessage.attachments,
      sender: {
        id: serializedMessage.sender.id,
        displayName: serializedMessage.sender.displayName,
      },
      replyToMessage: serializedMessage.replyToMessage
        ? {
            id: serializedMessage.replyToMessage.id,
            text: serializedMessage.replyToMessage.text,
            sender: {
              id: serializedMessage.replyToMessage.sender.id,
              displayName: serializedMessage.replyToMessage.sender.displayName,
            },
          }
        : null,
    });

    await this.notificationsService.enqueueMessageNotification({
      familyId: member.familyId,
      senderUserId: sessionContext.user.id,
      senderDisplayName: sessionContext.user.displayName,
      messageId: message.id,
      text: "Новое изображение",
    });

    await this.auditService.log({
      familyId: member.familyId,
      userId: sessionContext.user.id,
      actorUserId: sessionContext.user.id,
      eventType: "message.image.created",
      payloadJson: {
        messageId: message.id,
        attachmentCount: input.attachments.length,
      },
    });

    return serializedMessage;
  }
}
