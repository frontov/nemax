import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import webpush from "web-push";
import { PushRepository } from "./push.repository";

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly pushRepository: PushRepository,
  ) {
    const publicKey = this.configService.get<string>("push.publicKey");
    const privateKey = this.configService.get<string>("push.privateKey");

    if (publicKey && privateKey) {
      try {
        webpush.setVapidDetails("mailto:family-chat@example.com", publicKey, privateKey);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown VAPID configuration error";
        this.logger.warn(`Skipping web-push VAPID setup: ${message}`);
      }
    }
  }

  listFamilySubscriptions(familyId: string, excludeUserId?: string) {
    return this.pushRepository.listActiveSubscriptionsForFamily(familyId, excludeUserId);
  }

  async sendNotification(
    subscription: { endpoint: string; p256dh: string; auth: string },
    payload: Record<string, unknown>,
  ) {
    return webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload),
    );
  }
}
