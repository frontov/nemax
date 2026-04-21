import { BadRequestException, Injectable } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import { AuditService } from "../audit/audit.service";
import { AuthSessionService } from "../auth/auth.session.service";
import { AuthService } from "../auth/auth.service";
import type { SessionContext } from "../auth/auth.service";
import { CreateDeviceLinkDto } from "./dto/create-device-link.dto";
import { DevicesRepository } from "./devices.repository";

@Injectable()
export class DevicesService {
  constructor(
    private readonly devicesRepository: DevicesRepository,
    private readonly auditService: AuditService,
    private readonly authService: AuthService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  private getDeviceLinkSecret() {
    return process.env.SESSION_SECRET || "replace-me";
  }

  private createDeviceLinkToken(input: {
    userId: string;
    familyId: string;
    deviceName: string;
    platform: string;
  }) {
    const payload = {
      ...input,
      exp: Date.now() + 15 * 60 * 1000,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", this.getDeviceLinkSecret())
      .update(encodedPayload)
      .digest("base64url");

    return `${encodedPayload}.${signature}`;
  }

  private parseDeviceLinkToken(token: string) {
    const [encodedPayload, signature] = token.split(".");

    if (!encodedPayload || !signature) {
      throw new BadRequestException("Device link token is invalid");
    }

    const expectedSignature = createHmac("sha256", this.getDeviceLinkSecret())
      .update(encodedPayload)
      .digest("base64url");

    if (
      expectedSignature.length !== signature.length ||
      !timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))
    ) {
      throw new BadRequestException("Device link token is invalid");
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
      userId: string;
      familyId: string;
      deviceName: string;
      platform: string;
      exp: number;
    };

    if (!payload.userId || !payload.familyId || !payload.deviceName || !payload.exp || payload.exp <= Date.now()) {
      throw new BadRequestException("Device link token expired");
    }

    return payload;
  }

  listDevices(sessionContext: SessionContext) {
    this.authService.assertFamilyAccess(sessionContext);
    return this.devicesRepository.listUserDevices(sessionContext.user.id);
  }

  async revokeDevice(sessionContext: SessionContext, deviceId: string) {
    this.authService.assertFamilyAccess(sessionContext);
    const result = await this.devicesRepository.revokeDevice(sessionContext.user.id, deviceId);

    await this.auditService.log({
      familyId: sessionContext.familyId,
      actorUserId: sessionContext.user.id,
      userId: sessionContext.user.id,
      eventType: "device.revoked",
      payloadJson: {
        deviceId,
      },
    });

    return result;
  }

  async createDeviceLink(sessionContext: SessionContext, input: CreateDeviceLinkDto) {
    const member = this.authService.assertFamilyAccess(sessionContext);
    const deviceName = input.deviceName?.trim() || "Новое устройство";
    const platform = input.platform?.trim() || "web";

    const token = this.createDeviceLinkToken({
      userId: sessionContext.user.id,
      familyId: member.familyId,
      deviceName,
      platform,
    });

    await this.auditService.log({
      familyId: member.familyId,
      actorUserId: sessionContext.user.id,
      userId: sessionContext.user.id,
      eventType: "device.link.created",
      payloadJson: {
        deviceName,
      },
    });

    return {
      token,
      expiresInSeconds: 15 * 60,
    };
  }

  async joinDeviceWithToken(token: string, ipAddress?: string | null) {
    const payload = this.parseDeviceLinkToken(token);
    const sessionPair = this.authSessionService.generateTokenPair();
    const result = await this.devicesRepository.createLinkedDeviceSession({
      userId: payload.userId,
      familyId: payload.familyId,
      deviceName: payload.deviceName,
      platform: payload.platform,
      sessionTokenHash: sessionPair.sessionTokenHash,
      expiresAt: sessionPair.expiresAt,
      ipAddress,
    });

    if (!result) {
      throw new BadRequestException("Device link expired or unavailable");
    }

    await this.auditService.log({
      familyId: payload.familyId,
      actorUserId: payload.userId,
      userId: payload.userId,
      eventType: "device.link.joined",
      payloadJson: {
        deviceId: result.device.id,
      },
    });

    return {
      ...result,
      sessionToken: sessionPair.token,
    };
  }
}
