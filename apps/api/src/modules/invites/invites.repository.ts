import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";

@Injectable()
export class InvitesRepository {
  constructor(private readonly prisma: PrismaService) {}

  createInvite(input: {
    familyId: string;
    createdByUserId: string;
    codeHash: string;
    role: string;
    maxUses: number;
    expiresAt: Date;
  }) {
    return this.prisma.invite.create({
      data: input,
    });
  }

  findActiveInvite(codeHash: string) {
    return this.prisma.invite.findFirst({
      where: {
        codeHash,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        family: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async acceptInvite(input: {
    codeHash: string;
    displayName: string;
    deviceName: string;
    platform: string;
    sessionTokenHash: string;
    expiresAt: Date;
    ipAddress?: string | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const invite = await tx.invite.findFirst({
        where: {
          codeHash: input.codeHash,
          revokedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        include: {
          family: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (!invite) {
        return null;
      }

      const claimed = await tx.invite.updateMany({
        where: {
          id: invite.id,
          revokedAt: null,
          expiresAt: {
            gt: new Date(),
          },
          usedCount: {
            lt: invite.maxUses,
          },
        },
        data: {
          usedCount: {
            increment: 1,
          },
        },
      });

      if (claimed.count !== 1) {
        return null;
      }

      const user = await tx.user.create({
        data: {
          displayName: input.displayName,
        },
      });

      const member = await tx.familyMember.create({
        data: {
          familyId: invite.familyId,
          userId: user.id,
          role: invite.role,
        },
      });

      const device = await tx.device.create({
        data: {
          userId: user.id,
          familyId: invite.familyId,
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

      return { user, member, device, session, invite };
    });
  }

  async acceptInviteForExistingUser(input: {
    codeHash: string;
    userId: string;
    deviceId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const invite = await tx.invite.findFirst({
        where: {
          codeHash: input.codeHash,
          revokedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        include: {
          family: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (!invite) {
        return null;
      }

      const existingMember = await tx.familyMember.findUnique({
        where: {
          familyId_userId: {
            familyId: invite.familyId,
            userId: input.userId,
          },
        },
      });

      if (existingMember?.removedAt === null) {
        await tx.device.update({
          where: {
            id: input.deviceId,
          },
          data: {
            familyId: invite.familyId,
          },
        });

        const user = await tx.user.findUniqueOrThrow({
          where: {
            id: input.userId,
          },
        });

        return { user, member: existingMember, invite };
      }

      const claimed = await tx.invite.updateMany({
        where: {
          id: invite.id,
          revokedAt: null,
          expiresAt: {
            gt: new Date(),
          },
          usedCount: {
            lt: invite.maxUses,
          },
        },
        data: {
          usedCount: {
            increment: 1,
          },
        },
      });

      if (claimed.count !== 1) {
        return null;
      }

      const member = existingMember
        ? await tx.familyMember.update({
            where: {
              id: existingMember.id,
            },
            data: {
              removedAt: null,
              role: invite.role,
            },
          })
        : await tx.familyMember.create({
            data: {
              familyId: invite.familyId,
              userId: input.userId,
              role: invite.role,
            },
          });

      await tx.device.update({
        where: {
          id: input.deviceId,
        },
        data: {
          familyId: invite.familyId,
        },
      });

      const user = await tx.user.findUniqueOrThrow({
        where: {
          id: input.userId,
        },
      });

      return { user, member, invite };
    });
  }
}
