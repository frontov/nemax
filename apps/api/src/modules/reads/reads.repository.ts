import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";

@Injectable()
export class ReadsRepository {
  constructor(private readonly prisma: PrismaService) {}

  markRead(input: {
    familyId: string;
    userId: string;
    messageId: string;
  }) {
    return this.prisma.familyReadState.upsert({
      where: {
        familyId_userId: {
          familyId: input.familyId,
          userId: input.userId,
        },
      },
      update: {
        lastReadMessageId: input.messageId,
        lastReadAt: new Date(),
      },
      create: {
        familyId: input.familyId,
        userId: input.userId,
        lastReadMessageId: input.messageId,
        lastReadAt: new Date(),
      },
    });
  }
}
