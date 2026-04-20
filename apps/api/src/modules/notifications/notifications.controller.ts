import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { SessionGuard } from "../../common/guards/session.guard";
import type { SessionContext } from "../auth/auth.service";
import { UpdateNotificationSettingsDto } from "./dto/update-notification-settings.dto";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(SessionGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get("settings")
  getSettings(@CurrentSession() sessionContext: SessionContext) {
    return this.notificationsService.getSettings(sessionContext);
  }

  @Put("settings")
  updateSettings(
    @CurrentSession() sessionContext: SessionContext,
    @Body() body: UpdateNotificationSettingsDto,
  ) {
    return this.notificationsService.updateSettings(sessionContext, body);
  }
}
