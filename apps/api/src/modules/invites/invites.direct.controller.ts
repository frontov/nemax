import { Controller, Param, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { createRateLimitGuard } from "../../common/guards/rate-limit.guard";
import { AuthCookieService } from "../auth/auth.cookie.service";
import { AuthSessionService } from "../auth/auth.session.service";
import { AuthService } from "../auth/auth.service";
import { InvitesService } from "./invites.service";

@Controller("invites")
export class InvitesDirectController {
  constructor(
    private readonly invitesService: InvitesService,
    private readonly authCookieService: AuthCookieService,
    private readonly authService: AuthService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  @UseGuards(createRateLimitGuard({ key: "invite-direct-join", limit: 10, windowMs: 60_000 }))
  @Post("direct/:token/join")
  async joinInviteWithToken(
    @Param("token") token: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const sessionContext = await this.authService.resolveSessionFromRequest(response.req);
    const result = await this.invitesService.joinInviteWithToken(token, response.req.ip, sessionContext);

    if (result.sessionToken) {
      response.setHeader("Set-Cookie", this.authCookieService.createSessionCookie(result.sessionToken));
    } else if (sessionContext) {
      const rotated = await this.authSessionService.rotateSession(sessionContext.session.id, response.req.ip);
      response.setHeader("Set-Cookie", this.authCookieService.createSessionCookie(rotated.token));
    }

    return {
      user: result.user,
      member: result.member,
      family: result.family,
    };
  }
}
