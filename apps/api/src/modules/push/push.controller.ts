import { Body, Controller, Delete, Post, UseGuards } from "@nestjs/common";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { SessionGuard } from "../../common/guards/session.guard";
import type { SessionContext } from "../auth/auth.service";
import { DeletePushSubscriptionDto } from "./dto/delete-push-subscription.dto";
import { CreatePushSubscriptionDto } from "./dto/create-push-subscription.dto";
import { PushWebService } from "./push.web.service";

@Controller("push")
@UseGuards(SessionGuard)
export class PushController {
  constructor(private readonly pushWebService: PushWebService) {}

  @Post("subscriptions")
  createSubscription(
    @CurrentSession() sessionContext: SessionContext,
    @Body() body: CreatePushSubscriptionDto,
  ) {
    return this.pushWebService.createSubscription(sessionContext, body);
  }

  @Delete("subscriptions")
  deleteSubscription(
    @CurrentSession() sessionContext: SessionContext,
    @Body() body: DeletePushSubscriptionDto,
  ) {
    return this.pushWebService.deleteSubscription(sessionContext, body.endpoint);
  }
}
