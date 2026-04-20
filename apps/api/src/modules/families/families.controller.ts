import { Body, Controller, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { createRateLimitGuard } from "../../common/guards/rate-limit.guard";
import { AuthCookieService } from "../auth/auth.cookie.service";
import { CreateFamilyDto } from "./dto/create-family.dto";
import { FamiliesService } from "./families.service";

@Controller("families")
export class FamiliesController {
  constructor(
    private readonly familiesService: FamiliesService,
    private readonly authCookieService: AuthCookieService,
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
}
