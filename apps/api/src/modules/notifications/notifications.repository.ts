import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  getNotificationSettings(userId: string, familyId: string) {
    return this.prisma.notificationSetting.findUnique({
      where: {
        userId_familyId: {
          userId,
          familyId,
        },
      },
    });
  }

  upsertNotificationSettings(input: {
    userId: string;
    familyId: string;
    pushEnabled: boolean;
    showPreview: boolean;
    muteUntil?: Date | null;
    quietHoursFrom?: string | null;
    quietHoursTo?: string | null;
  }) {
    return this.prisma.notificationSetting.upsert({
      where: {
        userId_familyId: {
          userId: input.userId,
          familyId: input.familyId,
        },
      },
      update: {
        pushEnabled: input.pushEnabled,
        showPreview: input.showPreview,
        muteUntil: input.muteUntil ?? null,
        quietHoursFrom: input.quietHoursFrom ?? null,
        quietHoursTo: input.quietHoursTo ?? null,
      },
      create: input,
    });
  }

  findPushEligibleUserIds(familyId: string, userIds: string[]) {
    return this.prisma.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
        notificationSettings: {
          where: {
            familyId,
          },
          take: 1,
        },
      },
    });
  }
}
