import { Body, Controller, Get, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { SessionGuard } from "../../common/guards/session.guard";
import { AuthCookieService } from "../auth/auth.cookie.service";
import { AuthSessionService } from "../auth/auth.session.service";
import type { SessionContext } from "../auth/auth.service";
import { RemoveMemberDto } from "./dto/remove-member.dto";
import { MembersService } from "./members.service";

@Controller("members")
@UseGuards(SessionGuard)
export class MembersController {
  constructor(
    private readonly membersService: MembersService,
    private readonly authSessionService: AuthSessionService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  @Get()
  listMembers(
    @CurrentSession() sessionContext: SessionContext,
    @Query("familyId") familyId?: string,
  ) {
    return this.membersService.listMembers(sessionContext, familyId);
  }

  @Post("remove")
  async removeMember(
    @CurrentSession() sessionContext: SessionContext,
    @Body() body: RemoveMemberDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.membersService.removeMember(sessionContext, body.memberId, body.familyId);

    if (result.userId === sessionContext.user.id) {
      response.setHeader("Set-Cookie", this.authCookieService.clearSessionCookie());
      return result;
    }

    const rotated = await this.authSessionService.rotateSession(sessionContext.session.id, response.req.ip);
    response.setHeader("Set-Cookie", this.authCookieService.createSessionCookie(rotated.token));
    return result;
  }
}
