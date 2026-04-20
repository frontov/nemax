import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { SessionGuard } from "../../common/guards/session.guard";
import type { SessionContext } from "../auth/auth.service";
import { MarkReadDto } from "./dto/mark-read.dto";
import { ReadsService } from "./reads.service";

@Controller("reads")
@UseGuards(SessionGuard)
export class ReadsController {
  constructor(private readonly readsService: ReadsService) {}

  @Post()
  markRead(
    @CurrentSession() sessionContext: SessionContext,
    @Body() body: MarkReadDto,
  ) {
    return this.readsService.markRead(sessionContext, body);
  }
}
