import { Controller, Get, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { createRateLimitGuard } from "../../common/guards/rate-limit.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import type { SessionContext } from "./auth.service";
import { AuthCookieService } from "./auth.cookie.service";
import { AuthService } from "./auth.service";
import { AuthSessionService } from "./auth.session.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authSessionService: AuthSessionService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  @UseGuards(SessionGuard)
  @UseGuards(createRateLimitGuard({ key: "auth-me", limit: 120, windowMs: 60_000 }))
  @Get("me")
  getMe(@CurrentSession() sessionContext: SessionContext) {
    return this.authService.buildMePayload(sessionContext);
  }

  @UseGuards(SessionGuard)
  @UseGuards(createRateLimitGuard({ key: "auth-logout", limit: 30, windowMs: 60_000 }))
  @Post("logout")
  async logout(
    @CurrentSession() sessionContext: SessionContext,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authSessionService.revokeSession(sessionContext.session.id);
    response.setHeader("Set-Cookie", this.authCookieService.clearSessionCookie());

    return {
      status: "ok" as const,
    };
  }
}
