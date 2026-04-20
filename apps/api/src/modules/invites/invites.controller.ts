import { Body, Controller, Get, Param, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { createRateLimitGuard } from "../../common/guards/rate-limit.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import { AuthSessionService } from "../auth/auth.session.service";
import type { SessionContext } from "../auth/auth.service";
import { AuthCookieService } from "../auth/auth.cookie.service";
import { CreateInviteDto } from "./dto/create-invite.dto";
import { JoinInviteDto } from "./dto/join-invite.dto";
import { InvitesService } from "./invites.service";

@Controller("invites")
export class InvitesController {
  constructor(
    private readonly invitesService: InvitesService,
    private readonly authSessionService: AuthSessionService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  @UseGuards(SessionGuard)
  @UseGuards(createRateLimitGuard({ key: "invite-create", limit: 10, windowMs: 60_000 }))
  @Post()
  async createInvite(
    @CurrentSession() sessionContext: SessionContext,
    @Body() body: CreateInviteDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.invitesService.createInvite(sessionContext, body);
    const rotated = await this.authSessionService.rotateSession(sessionContext.session.id, response.req.ip);
    response.setHeader("Set-Cookie", this.authCookieService.createSessionCookie(rotated.token));
    return result;
  }

  @Get(":code")
  @UseGuards(createRateLimitGuard({ key: "invite-validate", limit: 30, windowMs: 60_000 }))
  validateInvite(@Param("code") code: string) {
    return this.invitesService.validateInvite(code);
  }

  @UseGuards(createRateLimitGuard({ key: "invite-join", limit: 10, windowMs: 60_000 }))
  @Post(":code/join")
  async joinInvite(
    @Param("code") code: string,
    @Body() body: JoinInviteDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.invitesService.joinInvite(code, body, response.req.ip);
    response.setHeader("Set-Cookie", this.authCookieService.createSessionCookie(result.sessionToken));

    return {
      user: result.user,
      member: result.member,
      family: result.family,
    };
  }
}
