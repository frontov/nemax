import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { createRateLimitGuard } from "../../common/guards/rate-limit.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import type { SessionContext } from "../auth/auth.service";
import { CreateMessageDto } from "./dto/create-message.dto";
import { MessagesService } from "./messages.service";

@Controller("messages")
@UseGuards(SessionGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  listMessages(@CurrentSession() sessionContext: SessionContext) {
    return this.messagesService.listMessages(sessionContext);
  }

  @Post()
  @UseGuards(createRateLimitGuard({ key: "messages", limit: 30, windowMs: 60_000 }))
  sendMessage(
    @CurrentSession() sessionContext: SessionContext,
    @Body() body: CreateMessageDto,
  ) {
    return this.messagesService.sendMessage(sessionContext, body);
  }
}
