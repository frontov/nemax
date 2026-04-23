import { Body, Controller, Delete, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { SessionGuard } from "../../common/guards/session.guard";
import type { SessionContext } from "../auth/auth.service";
import { DeletePushSubscriptionDto } from "./dto/delete-push-subscription.dto";
import { CreatePushSubscriptionDto } from "./dto/create-push-subscription.dto";
import { PushWebService } from "./push.web.service";

@Controller("push")
export class PushController {
  constructor(private readonly pushWebService: PushWebService) {}

  @Get("public-key")
  getPublicKey() {
    return this.pushWebService.getPublicConfig();
  }

  @Post("subscriptions")
  @UseGuards(SessionGuard)
  createSubscription(
    @CurrentSession() sessionContext: SessionContext,
    @Body() body: CreatePushSubscriptionDto,
  ) {
    return this.pushWebService.createSubscription(sessionContext, body);
  }

  @Delete("subscriptions")
  @UseGuards(SessionGuard)
  deleteSubscription(
    @CurrentSession() sessionContext: SessionContext,
    @Body() body: DeletePushSubscriptionDto,
  ) {
    return this.pushWebService.deleteSubscription(sessionContext, body.endpoint);
  }
}
