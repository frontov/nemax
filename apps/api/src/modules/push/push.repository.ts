import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";

@Injectable()
export class PushRepository {
  constructor(private readonly prisma: PrismaService) {}

  upsertSubscription(input: {
    userId: string;
    deviceId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }) {
    return this.prisma.pushSubscription.upsert({
      where: {
        endpoint: input.endpoint,
      },
      update: {
        userId: input.userId,
        deviceId: input.deviceId,
        p256dh: input.p256dh,
        auth: input.auth,
        revokedAt: null,
        lastUsedAt: new Date(),
      },
      create: {
        userId: input.userId,
        deviceId: input.deviceId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        lastUsedAt: new Date(),
      },
    });
  }

  revokeSubscription(endpoint: string, userId: string) {
    return this.prisma.pushSubscription.updateMany({
      where: {
        endpoint,
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  listActiveSubscriptionsForFamily(familyId: string, excludeUserId?: string) {
    return this.prisma.pushSubscription.findMany({
      where: {
        revokedAt: null,
        user: {
          memberships: {
            some: {
              familyId,
              removedAt: null,
            },
          },
        },
        ...(excludeUserId
          ? {
              userId: {
                not: excludeUserId,
              },
            }
          : {}),
      },
    });
  }
}
