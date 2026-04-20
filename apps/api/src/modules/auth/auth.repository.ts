import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSessionByTokenHash(sessionTokenHash: string) {
    return this.prisma.session.findFirst({
      where: {
        sessionTokenHash,
        revokedAt: null,
        device: {
          revokedAt: null,
        },
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: {
          include: {
            memberships: {
              where: {
                removedAt: null,
              },
              include: {
                family: true,
              },
            },
          },
        },
        device: true,
      },
    });
  }

  async createSession(input: {
    userId: string;
    deviceId: string;
    sessionTokenHash: string;
    expiresAt: Date;
    ipCreated?: string | null;
    ipLastSeen?: string | null;
  }) {
    return this.prisma.session.create({
      data: input,
    });
  }

  async touchSession(sessionId: string, ipLastSeen?: string | null) {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        ipLastSeen: ipLastSeen ?? undefined,
        lastRotatedAt: new Date(),
      },
    });
  }

  async revokeSession(sessionId: string) {
    return this.prisma.session.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async revokeSessionsForUserInFamily(userId: string, familyId: string) {
    const devices = await this.prisma.device.findMany({
      where: {
        userId,
        familyId,
      },
      select: {
        id: true,
      },
    });

    const deviceIds = devices.map((device) => device.id);

    return this.prisma.$transaction(async (tx) => {
      if (deviceIds.length > 0) {
        await tx.session.updateMany({
          where: {
            deviceId: {
              in: deviceIds,
            },
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
          },
        });

        await tx.device.updateMany({
          where: {
            id: {
              in: deviceIds,
            },
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
            isTrusted: false,
          },
        });
      }
    });
  }

  async rotateSession(sessionId: string, sessionTokenHash: string, expiresAt: Date, ipLastSeen?: string | null) {
    return this.prisma.session.update({
      where: {
        id: sessionId,
      },
      data: {
        sessionTokenHash,
        expiresAt,
        lastRotatedAt: new Date(),
        ipLastSeen: ipLastSeen ?? undefined,
      },
    });
  }
}
