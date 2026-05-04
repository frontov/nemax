import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
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
  listMessages(
    @CurrentSession() sessionContext: SessionContext,
    @Query("beforeMessageId") beforeMessageId?: string,
    @Query("afterMessageId") afterMessageId?: string,
    @Query("take") takeValue?: string,
  ) {
    const parsedTake = takeValue ? Number.parseInt(takeValue, 10) : undefined;

    return this.messagesService.listMessages(sessionContext, {
      beforeMessageId,
      afterMessageId,
      take: parsedTake,
    });
  }

  @Post()
  @UseGuards(createRateLimitGuard({ key: "messages", limit: 30, windowMs: 60_000 }))
  sendMessage(
    @CurrentSession() sessionContext: SessionContext,
    @Body() body: CreateMessageDto,
  ) {
    return this.messagesService.sendMessage(sessionContext, body);
  }

  @Delete(":id")
  deleteMessage(
    @CurrentSession() sessionContext: SessionContext,
    @Param("id") messageId: string,
  ) {
    return this.messagesService.deleteMessage(sessionContext, messageId);
  }
}
