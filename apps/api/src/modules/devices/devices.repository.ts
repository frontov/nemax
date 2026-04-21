import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";

@Injectable()
export class DevicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  listUserDevices(userId: string) {
    return this.prisma.device.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  revokeDevice(userId: string, deviceId: string) {
    return this.prisma.$transaction(async (tx) => {
      const device = await tx.device.updateMany({
        where: {
          id: deviceId,
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          isTrusted: false,
        },
      });

      await tx.session.updateMany({
        where: {
          deviceId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      return device;
    });
  }

  async createLinkedDeviceSession(input: {
    userId: string;
    familyId: string;
    deviceName: string;
    platform: string;
    sessionTokenHash: string;
    expiresAt: Date;
    ipAddress?: string | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.familyMember.findFirst({
        where: {
          userId: input.userId,
          familyId: input.familyId,
          removedAt: null,
        },
        include: {
          family: true,
          user: true,
        },
      });

      if (!membership) {
        return null;
      }

      const device = await tx.device.create({
        data: {
          userId: input.userId,
          familyId: input.familyId,
          deviceName: input.deviceName,
          platform: input.platform,
          isTrusted: true,
          lastSeenAt: new Date(),
        },
      });

      const session = await tx.session.create({
        data: {
          userId: input.userId,
          deviceId: device.id,
          sessionTokenHash: input.sessionTokenHash,
          expiresAt: input.expiresAt,
          ipCreated: input.ipAddress ?? null,
          ipLastSeen: input.ipAddress ?? null,
        },
      });

      return {
        device,
        session,
        user: membership.user,
        family: membership.family,
        member: membership,
      };
    });
  }
}
