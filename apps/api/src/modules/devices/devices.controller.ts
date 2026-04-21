import { Body, Controller, Get, Param, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { SessionGuard } from "../../common/guards/session.guard";
import { AuthCookieService } from "../auth/auth.cookie.service";
import { AuthSessionService } from "../auth/auth.session.service";
import type { SessionContext } from "../auth/auth.service";
import { CreateDeviceLinkDto } from "./dto/create-device-link.dto";
import { RevokeDeviceDto } from "./dto/revoke-device.dto";
import { DevicesService } from "./devices.service";

@Controller("devices")
@UseGuards(SessionGuard)
export class DevicesController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly authSessionService: AuthSessionService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  @Get()
  listDevices(@CurrentSession() sessionContext: SessionContext) {
    return this.devicesService.listDevices(sessionContext);
  }

  @Post("link")
  async createDeviceLink(
    @CurrentSession() sessionContext: SessionContext,
    @Body() body: CreateDeviceLinkDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.devicesService.createDeviceLink(sessionContext, body);
    const rotated = await this.authSessionService.rotateSession(sessionContext.session.id, response.req.ip);
    response.setHeader("Set-Cookie", this.authCookieService.createSessionCookie(rotated.token));
    return result;
  }

  @Post("revoke")
  async revokeDevice(
    @CurrentSession() sessionContext: SessionContext,
    @Body() body: RevokeDeviceDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.devicesService.revokeDevice(sessionContext, body.deviceId);

    if (body.deviceId === sessionContext.device.id) {
      response.setHeader("Set-Cookie", this.authCookieService.clearSessionCookie());
      return result;
    }

    const rotated = await this.authSessionService.rotateSession(sessionContext.session.id, response.req.ip);
    response.setHeader("Set-Cookie", this.authCookieService.createSessionCookie(rotated.token));
    return result;
  }
}

@Controller("devices")
export class DevicesLinkController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  @Post("link/:token/join")
  async joinDevice(
    @Param("token") token: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.devicesService.joinDeviceWithToken(token, response.req.ip);
    response.setHeader("Set-Cookie", this.authCookieService.createSessionCookie(result.sessionToken));

    return {
      user: result.user,
      member: result.member,
      family: result.family,
      device: result.device,
    };
  }
}
