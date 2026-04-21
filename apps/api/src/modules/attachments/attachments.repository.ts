import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";

@Injectable()
export class AttachmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAttachmentForFamily(attachmentId: string, familyId: string) {
    return this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        message: {
          familyId,
          deletedAt: null,
        },
      },
      include: {
        message: true,
      },
    });
  }
}
