import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";

@Injectable()
export class MessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly messageInclude = {
    sender: true,
    attachments: true,
    replyToMessage: {
      include: {
        sender: true,
        attachments: true,
      },
    },
  } as const;

  private async findMessageCursor(familyId: string, messageId: string) {
    return this.prisma.message.findFirst({
      where: {
        id: messageId,
        familyId,
        deletedAt: null,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });
  }

  async listRecentFamilyMessages(familyId: string, take: number) {
    return this.prisma.message.findMany({
      where: {
        familyId,
        deletedAt: null,
      },
      include: this.messageInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
    });
  }

  async listOlderFamilyMessages(familyId: string, beforeMessageId: string, take: number) {
    const cursor = await this.findMessageCursor(familyId, beforeMessageId);

    if (!cursor) {
      return null;
    }

    const messages = await this.prisma.message.findMany({
      where: {
        familyId,
        deletedAt: null,
        OR: [
          {
            createdAt: {
              lt: cursor.createdAt,
            },
          },
          {
            createdAt: cursor.createdAt,
            id: {
              lt: cursor.id,
            },
          },
        ],
      },
      include: this.messageInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
    });

    return {
      cursor,
      messages,
    };
  }

  async listNewerFamilyMessages(familyId: string, afterMessageId: string, take: number) {
    const cursor = await this.findMessageCursor(familyId, afterMessageId);

    if (!cursor) {
      return null;
    }

    const messages = await this.prisma.message.findMany({
      where: {
        familyId,
        deletedAt: null,
        OR: [
          {
            createdAt: {
              gt: cursor.createdAt,
            },
          },
          {
            createdAt: cursor.createdAt,
            id: {
              gt: cursor.id,
            },
          },
        ],
      },
      include: this.messageInclude,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: take + 1,
    });

    return {
      cursor,
      messages,
    };
  }

  async listAroundFamilyMessage(
    familyId: string,
    anchorMessageId: string,
    beforeTake: number,
    afterTake: number,
  ) {
    const cursor = await this.findMessageCursor(familyId, anchorMessageId);

    if (!cursor) {
      return null;
    }

    const [anchorMessage, olderMessages, newerMessages] = await Promise.all([
      this.prisma.message.findFirst({
        where: {
          id: anchorMessageId,
          familyId,
          deletedAt: null,
        },
        include: this.messageInclude,
      }),
      this.prisma.message.findMany({
        where: {
          familyId,
          deletedAt: null,
          OR: [
            {
              createdAt: {
                lt: cursor.createdAt,
              },
            },
            {
              createdAt: cursor.createdAt,
              id: {
                lt: cursor.id,
              },
            },
          ],
        },
        include: this.messageInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: beforeTake + 1,
      }),
      this.prisma.message.findMany({
        where: {
          familyId,
          deletedAt: null,
          OR: [
            {
              createdAt: {
                gt: cursor.createdAt,
              },
            },
            {
              createdAt: cursor.createdAt,
              id: {
                gt: cursor.id,
              },
            },
          ],
        },
        include: this.messageInclude,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: afterTake + 1,
      }),
    ]);

    if (!anchorMessage) {
      return null;
    }

    return {
      cursor,
      anchorMessage,
      olderMessages,
      newerMessages,
    };
  }

  listFamilyReadStates(familyId: string) {
    return this.prisma.familyReadState.findMany({
      where: {
        familyId,
      },
      select: {
        userId: true,
        lastReadMessageId: true,
        lastReadAt: true,
        lastReadMessage: {
          select: {
            id: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async resolveReadableMessageIdAtTime(
    familyId: string,
    lastReadAt: Date | null | undefined,
    fallbackUserId?: string,
  ) {
    if (lastReadAt) {
      const matchedMessage = await this.prisma.message.findFirst({
        where: {
          familyId,
          deletedAt: null,
          createdAt: {
            lte: lastReadAt,
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
        },
      });

      if (matchedMessage) {
        return matchedMessage.id;
      }
    }

    if (fallbackUserId) {
      const ownMessage = await this.prisma.message.findFirst({
        where: {
          familyId,
          senderUserId: fallbackUserId,
          deletedAt: null,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
        },
      });

      if (ownMessage) {
        return ownMessage.id;
      }
    }

    const latestFamilyMessage = await this.prisma.message.findFirst({
      where: {
        familyId,
        deletedAt: null,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
      },
    });

    return latestFamilyMessage?.id ?? null;
  }

  findActiveMessageForFamily(messageId: string, familyId: string) {
    return this.prisma.message.findFirst({
      where: {
        id: messageId,
        familyId,
        deletedAt: null,
      },
      include: this.messageInclude,
    });
  }

  deleteMessageForFamily(messageId: string, familyId: string) {
    return this.prisma.message.updateMany({
      where: {
        id: messageId,
        familyId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async createMessage(input: {
    familyId: string;
    senderUserId: string;
    text: string;
    replyToMessageId?: string;
    clientTempId?: string;
    attachment?: {
      storageKey: string;
      originalName: string;
      mimeType: string;
      sizeBytes: bigint;
      width?: number | null;
      height?: number | null;
    };
    attachments?: Array<{
      storageKey: string;
      originalName: string;
      mimeType: string;
      sizeBytes: bigint;
      width?: number | null;
      height?: number | null;
    }>;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          familyId: input.familyId,
          senderUserId: input.senderUserId,
          type: "text",
          text: input.text,
          replyToMessageId: input.replyToMessageId,
          clientTempId: input.clientTempId,
          attachments: input.attachments?.length
            ? {
                create: input.attachments,
              }
            : input.attachment
            ? {
                create: input.attachment,
              }
            : undefined,
        },
        include: this.messageInclude,
      });

      await tx.familyReadState.upsert({
        where: {
          familyId_userId: {
            familyId: input.familyId,
            userId: input.senderUserId,
          },
        },
        update: {
          lastReadMessageId: message.id,
          lastReadAt: new Date(),
        },
        create: {
          familyId: input.familyId,
          userId: input.senderUserId,
          lastReadMessageId: message.id,
          lastReadAt: new Date(),
        },
      });

      return message;
    });
  }
}
