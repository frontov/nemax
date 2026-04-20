import { Controller, Param, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { createRateLimitGuard } from "../../common/guards/rate-limit.guard";
import { AuthCookieService } from "../auth/auth.cookie.service";
import { InvitesService } from "./invites.service";

@Controller("invites")
export class InvitesDirectController {
  constructor(
    private readonly invitesService: InvitesService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  @UseGuards(createRateLimitGuard({ key: "invite-direct-join", limit: 10, windowMs: 60_000 }))
  @Post("direct/:token/join")
  async joinInviteWithToken(
    @Param("token") token: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.invitesService.joinInviteWithToken(token, response.req.ip);
    response.setHeader("Set-Cookie", this.authCookieService.createSessionCookie(result.sessionToken));

    return {
      user: result.user,
      member: result.member,
      family: result.family,
    };
  }
}
