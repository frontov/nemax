import { Body, Controller, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { createRateLimitGuard } from "../../common/guards/rate-limit.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import { AuthCookieService } from "../auth/auth.cookie.service";
import { AuthSessionService } from "../auth/auth.session.service";
import type { SessionContext } from "../auth/auth.service";
import { CreateFamilyDto } from "./dto/create-family.dto";
import { SetActiveFamilyDto } from "./dto/set-active-family.dto";
import { FamiliesService } from "./families.service";

@Controller("families")
export class FamiliesController {
  constructor(
    private readonly familiesService: FamiliesService,
    private readonly authCookieService: AuthCookieService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  @UseGuards(createRateLimitGuard({ key: "family-create", limit: 10, windowMs: 60_000 }))
  @Post()
  async createFamily(
    @Body() body: CreateFamilyDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.familiesService.createFamily(body, response.req.ip);
    response.setHeader("Set-Cookie", this.authCookieService.createSessionCookie(result.sessionToken));

    return {
      user: result.user,
      family: result.family,
      member: result.member,
    };
  }

  @UseGuards(SessionGuard)
  @Post("active")
  async setActiveFamily(
    @CurrentSession() sessionContext: SessionContext,
    @Body() body: SetActiveFamilyDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.familiesService.setActiveFamily(sessionContext, body);
    const rotated = await this.authSessionService.rotateSession(sessionContext.session.id, response.req.ip);
    response.setHeader("Set-Cookie", this.authCookieService.createSessionCookie(rotated.token));
    return result;
  }
}
