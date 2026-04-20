import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";

@Injectable()
export class FamiliesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createFamilyWithOwner(input: {
    familyName: string;
    displayName: string;
    deviceName: string;
    platform: string;
    sessionTokenHash: string;
    expiresAt: Date;
    ipAddress?: string | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          displayName: input.displayName,
        },
      });

      const family = await tx.family.create({
        data: {
          name: input.familyName,
          ownerUserId: user.id,
        },
      });

      const member = await tx.familyMember.create({
        data: {
          familyId: family.id,
          userId: user.id,
          role: "owner",
        },
      });

      const device = await tx.device.create({
        data: {
          userId: user.id,
          familyId: family.id,
          deviceName: input.deviceName,
          platform: input.platform,
          isTrusted: true,
          lastSeenAt: new Date(),
        },
      });

      const session = await tx.session.create({
        data: {
          userId: user.id,
          deviceId: device.id,
          sessionTokenHash: input.sessionTokenHash,
          expiresAt: input.expiresAt,
          ipCreated: input.ipAddress ?? null,
          ipLastSeen: input.ipAddress ?? null,
        },
      });

      return { user, family, member, device, session };
    });
  }
}
