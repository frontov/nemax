import { BadRequestException, Injectable } from "@nestjs/common";
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

type MessageWithRelations = NonNullable<Awaited<ReturnType<MessagesRepository["findActiveMessageForFamily"]>>>;
type MessageRecord =
  | Awaited<ReturnType<MessagesRepository["listRecentFamilyMessages"]>>[number]
  | NonNullable<Awaited<ReturnType<MessagesRepository["listAroundFamilyMessage"]>>>["anchorMessage"];

type ReadState = {
  userId: string;
  lastReadMessageId: string | null;
  lastReadAt: Date | null;
  lastReadMessage: {
    id: string;
    createdAt: Date;
  } | null;
};

function serializeMessage(message: MessageRecord) {
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

function withReadReceipts(
  messages: Array<ReturnType<typeof serializeMessage>>,
  readStates: ReadState[],
) {
  function compareMessagePosition(
    left: { createdAt: Date | string; id: string },
    right: { createdAt: Date | string; id: string },
  ) {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return left.id.localeCompare(right.id);
  }

  return messages.map((message) => {
    const readByUserIds = readStates
      .filter((state) => state.userId !== message.senderUserId)
      .filter((state) => {
        if (!state.lastReadMessageId || !state.lastReadMessage) {
          return false;
        }

        return compareMessagePosition(state.lastReadMessage, message) >= 0;
      })
      .map((state) => state.userId);

    return {
      ...message,
      readByUserIds,
    };
  });
}

function clampTake(value: number | undefined) {
  if (!value || Number.isNaN(value)) {
    return 40;
  }

  return Math.min(Math.max(value, 20), 80);
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

  async listMessages(
    sessionContext: SessionContext,
    input?: {
      beforeMessageId?: string;
      afterMessageId?: string;
      take?: number;
    },
  ) {
    const member = this.authService.assertFamilyAccess(sessionContext);
    const take = clampTake(input?.take);
    const readStates = await this.messagesRepository.listFamilyReadStates(member.familyId);
    const viewerLastReadMessageId =
      readStates.find((state) => state.userId === sessionContext.user.id)?.lastReadMessageId ?? null;
    let pageMessages: MessageRecord[] = [];
    let olderCursor: string | null = null;
    let newerCursor: string | null = null;

    if (input?.beforeMessageId) {
      const result = await this.messagesRepository.listOlderFamilyMessages(
        member.familyId,
        input.beforeMessageId,
        take,
      );

      if (result) {
        const hasOlder = result.messages.length > take;
        pageMessages = result.messages.slice(0, take).reverse();
        olderCursor = hasOlder ? pageMessages[0]?.id ?? null : null;
      }
    } else if (input?.afterMessageId) {
      const result = await this.messagesRepository.listNewerFamilyMessages(
        member.familyId,
        input.afterMessageId,
        take,
      );

      if (result) {
        const hasNewer = result.messages.length > take;
        pageMessages = result.messages.slice(0, take);
        newerCursor = hasNewer ? pageMessages.at(-1)?.id ?? null : null;
      }
    } else if (viewerLastReadMessageId) {
      const aroundBefore = Math.max(Math.floor(take * 0.4), 8);
      const aroundAfter = Math.max(take - aroundBefore - 1, 8);
      const result = await this.messagesRepository.listAroundFamilyMessage(
        member.familyId,
        viewerLastReadMessageId,
        aroundBefore,
        aroundAfter,
      );

      if (result) {
        const hasOlder = result.olderMessages.length > aroundBefore;
        const hasNewer = result.newerMessages.length > aroundAfter;
        pageMessages = [
          ...result.olderMessages.slice(0, aroundBefore).reverse(),
          result.anchorMessage,
          ...result.newerMessages.slice(0, aroundAfter),
        ];
        olderCursor = hasOlder ? pageMessages[0]?.id ?? null : null;
        newerCursor = hasNewer ? pageMessages.at(-1)?.id ?? null : null;
      }
    }

    if (pageMessages.length === 0) {
      const recentMessages = await this.messagesRepository.listRecentFamilyMessages(member.familyId, take);
      const hasOlder = recentMessages.length > take;
      pageMessages = recentMessages.slice(0, take).reverse();
      olderCursor = hasOlder ? pageMessages[0]?.id ?? null : null;
      newerCursor = null;
    }

    return {
      messages: withReadReceipts(pageMessages.map(serializeMessage), readStates),
      viewerLastReadMessageId,
      page: {
        olderCursor,
        newerCursor,
      },
    };
  }

  private async finalizeMessageCreation(
    sessionContext: SessionContext,
    message: MessageWithRelations,
    notificationText: string,
    audit: {
      eventType: string;
      payloadJson: Record<string, unknown>;
    },
  ) {
    const member = this.authService.assertFamilyAccess(sessionContext);
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
      readByUserIds: [],
    });

    await this.notificationsService.enqueueMessageNotification({
      familyId: member.familyId,
      senderUserId: sessionContext.user.id,
      senderDisplayName: sessionContext.user.displayName,
      messageId: message.id,
      text: notificationText,
    });

    await this.auditService.log({
      familyId: member.familyId,
      userId: sessionContext.user.id,
      actorUserId: sessionContext.user.id,
      eventType: audit.eventType,
      payloadJson: audit.payloadJson,
    });

    return serializedMessage;
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

    return this.finalizeMessageCreation(sessionContext, message, "Новое зашифрованное сообщение", {
      eventType: "message.created",
      payloadJson: {
        messageId: message.id,
      },
    });
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

    return this.finalizeMessageCreation(sessionContext, message, "Новое изображение", {
      eventType: "message.image.created",
      payloadJson: {
        messageId: message.id,
        attachmentCount: input.attachments.length,
      },
    });
  }

  async deleteMessage(sessionContext: SessionContext, messageId: string) {
    const member = this.authService.assertFamilyAccess(sessionContext);

    if (member.role !== "owner") {
      throw new BadRequestException("Only family owner can delete messages");
    }

    const result = await this.messagesRepository.deleteMessageForFamily(messageId, member.familyId);

    if (result.count === 0) {
      throw new BadRequestException("Message not found or already deleted");
    }

    const payload = {
      id: messageId,
      familyId: member.familyId,
      deletedAt: new Date().toISOString(),
    };

    this.messagesEventsService.emitMessageDeleted(member.familyId, payload);

    await this.auditService.log({
      familyId: member.familyId,
      userId: sessionContext.user.id,
      actorUserId: sessionContext.user.id,
      eventType: "message.deleted",
      payloadJson: {
        messageId,
      },
    });

    return payload;
  }
}
