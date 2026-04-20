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
}
