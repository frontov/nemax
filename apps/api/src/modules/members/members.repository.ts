import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";

@Injectable()
export class MembersRepository {
  constructor(private readonly prisma: PrismaService) {}

  listFamilyMembers(familyId: string) {
    return this.prisma.familyMember.findMany({
      where: {
        familyId,
        removedAt: null,
      },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async removeMember(familyId: string, memberId: string) {
    return this.prisma.$transaction(async (tx) => {
      const member = await tx.familyMember.findFirst({
        where: {
          id: memberId,
          familyId,
          removedAt: null,
        },
      });

      if (!member) {
        return null;
      }

      await tx.familyMember.update({
        where: {
          id: member.id,
        },
        data: {
          removedAt: new Date(),
        },
      });

      const devices = await tx.device.findMany({
        where: {
          userId: member.userId,
          familyId,
          revokedAt: null,
        },
        select: {
          id: true,
        },
      });

      const deviceIds = devices.map((device) => device.id);

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
          },
          data: {
            revokedAt: new Date(),
            isTrusted: false,
          },
        });
      }

      return member;
    });
  }
}
