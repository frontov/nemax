import { Injectable } from "@nestjs/common";
import { Job } from "bullmq";
import { PUSH_QUEUE_NAME } from "../../common/constants/notifications.constants";
import { AuthService } from "../auth/auth.service";
import type { SessionContext } from "../auth/auth.service";
import { PushService } from "../push/push.service";
import { NotificationsQueue } from "./notifications.queue";
import { NotificationsRepository } from "./notifications.repository";
import type { UpdateNotificationSettingsDto } from "./dto/update-notification-settings.dto";

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsQueue: NotificationsQueue,
    private readonly notificationsRepository: NotificationsRepository,
    private readonly pushService: PushService,
    private readonly authService: AuthService,
  ) {}

  async enqueueMessageNotification(input: {
    familyId: string;
    senderUserId: string;
    senderDisplayName: string;
    messageId: string;
    text: string;
  }) {
    await this.notificationsQueue.queue.add(
      PUSH_QUEUE_NAME,
      {
        type: "message.created",
        ...input,
      },
      {
        jobId: `message-${input.messageId}`,
      },
    );
  }

  getSettings(sessionContext: SessionContext) {
    const member = this.authService.assertFamilyAccess(sessionContext);
    return this.notificationsRepository.getNotificationSettings(
      sessionContext.user.id,
      member.familyId,
    );
  }

  updateSettings(sessionContext: SessionContext, input: UpdateNotificationSettingsDto) {
    const member = this.authService.assertFamilyAccess(sessionContext);
    return this.notificationsRepository.upsertNotificationSettings({
      userId: sessionContext.user.id,
      familyId: member.familyId,
      pushEnabled: input.pushEnabled,
      showPreview: input.showPreview,
      muteUntil: input.muteUntil ? new Date(input.muteUntil) : null,
      quietHoursFrom: input.quietHoursFrom ?? null,
      quietHoursTo: input.quietHoursTo ?? null,
    });
  }

  async processPushJob(job: Job) {
    const payload = job.data as {
      type: "message.created";
      familyId: string;
      senderUserId: string;
      senderDisplayName: string;
      messageId: string;
      text: string;
    };

    const subscriptions = await this.pushService.listFamilySubscriptions(
      payload.familyId,
      payload.senderUserId,
    );
    const eligibleUsers = await this.notificationsRepository.findPushEligibleUserIds(
      payload.familyId,
      subscriptions.map((subscription) => subscription.userId),
    );
    const allowedUserIds = new Set(
      eligibleUsers
        .filter(({ notificationSettings }) => {
          const setting = notificationSettings[0];

          if (!setting) {
            return true;
          }

          if (!setting.pushEnabled) {
            return false;
          }

          if (setting.muteUntil && setting.muteUntil.getTime() > Date.now()) {
            return false;
          }

          return true;
        })
        .map(({ id }) => id),
    );

    await Promise.all(
      subscriptions
        .filter((subscription) => allowedUserIds.has(subscription.userId))
        .map((subscription) =>
          this.pushService.sendNotification(subscription, {
            type: payload.type,
            familyId: payload.familyId,
            messageId: payload.messageId,
            title: payload.senderDisplayName,
            body: payload.text,
          }),
        ),
    );
  }
}
