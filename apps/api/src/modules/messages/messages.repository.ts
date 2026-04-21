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

  listFamilyMessages(familyId: string) {
    return this.prisma.message.findMany({
      where: {
        familyId,
        deletedAt: null,
      },
      include: this.messageInclude,
      orderBy: {
        createdAt: "asc",
      },
      take: 100,
    });
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
          attachments: input.attachment
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
