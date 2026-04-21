import type { Prisma } from "../../database/prisma/client";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  createLog(input: {
    familyId?: string | null;
    userId?: string | null;
    actorUserId?: string | null;
    eventType: string;
    payloadJson: Record<string, unknown>;
  }) {
    return this.prisma.auditLog.create({
      data: {
        familyId: input.familyId ?? null,
        userId: input.userId ?? null,
        actorUserId: input.actorUserId ?? null,
        eventType: input.eventType,
        payloadJson: input.payloadJson as Prisma.InputJsonValue,
      },
    });
  }
}
