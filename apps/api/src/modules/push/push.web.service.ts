import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "../auth/auth.service";
import type { SessionContext } from "../auth/auth.service";
import { CreatePushSubscriptionDto } from "./dto/create-push-subscription.dto";
import { PushRepository } from "./push.repository";

@Injectable()
export class PushWebService {
  constructor(
    private readonly pushRepository: PushRepository,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  getPublicConfig() {
    return {
      vapidPublicKey: this.configService.get<string>("push.publicKey") ?? "",
    };
  }

  createSubscription(sessionContext: SessionContext, input: CreatePushSubscriptionDto) {
    this.authService.assertFamilyAccess(sessionContext);
    return this.pushRepository.upsertSubscription({
      userId: sessionContext.user.id,
      deviceId: sessionContext.device.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
    });
  }

  deleteSubscription(sessionContext: SessionContext, endpoint: string) {
    this.authService.assertFamilyAccess(sessionContext);
    return this.pushRepository.revokeSubscription(endpoint, sessionContext.user.id);
  }
}
