import { Injectable } from "@nestjs/common";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { SESSION_TTL_DAYS } from "../../common/constants/auth.constants";
import { AuditService } from "../audit/audit.service";
import { AuthService, type SessionContext } from "../auth/auth.service";
import { CreateInviteDto } from "./dto/create-invite.dto";
import { JoinInviteDto } from "./dto/join-invite.dto";
import { InvitesRepository } from "./invites.repository";

@Injectable()
export class InvitesService {
  constructor(
    private readonly invitesRepository: InvitesRepository,
    private readonly auditService: AuditService,
    private readonly authService: AuthService,
  ) {}

  private hashInviteCode(code: string) {
    return createHash("sha256").update(code).digest("hex");
  }

  private getDirectJoinSecret() {
    return process.env.SESSION_SECRET || "replace-me";
  }

  private createDirectJoinToken(input: {
    code: string;
    displayName: string;
    deviceName: string;
    platform: string;
  }) {
    const payload = {
      code: input.code,
      displayName: input.displayName,
      deviceName: input.deviceName,
      platform: input.platform,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", this.getDirectJoinSecret())
      .update(encodedPayload)
      .digest("base64url");

    return `${encodedPayload}.${signature}`;
  }

  private parseDirectJoinToken(token: string) {
    const [encodedPayload, signature] = token.split(".");

    if (!encodedPayload || !signature) {
      throw new BadRequestException("Direct join token is invalid");
    }

    const expectedSignature = createHmac("sha256", this.getDirectJoinSecret())
      .update(encodedPayload)
      .digest("base64url");

    if (
      expectedSignature.length !== signature.length ||
      !timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))
    ) {
      throw new BadRequestException("Direct join token is invalid");
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
      code: string;
      displayName: string;
      deviceName: string;
      platform: string;
      exp: number;
    };

    if (!payload.code || !payload.displayName || !payload.exp || payload.exp <= Date.now()) {
      throw new BadRequestException("Direct join token expired");
    }

    return payload;
  }

  async createInvite(sessionContext: SessionContext, input: CreateInviteDto) {
    const member = this.authService.assertFamilyAccess(sessionContext);

    const code = randomBytes(12).toString("hex");
    const invite = await this.invitesRepository.createInvite({
      familyId: member.familyId,
      createdByUserId: sessionContext.user.id,
      codeHash: this.hashInviteCode(code),
      role: input.role ?? "member",
      maxUses: input.maxUses ?? 1,
      expiresAt: new Date(Date.now() + (input.expiresInDays ?? 7) * 24 * 60 * 60 * 1000),
    });

    await this.auditService.log({
      familyId: member.familyId,
      userId: sessionContext.user.id,
      actorUserId: sessionContext.user.id,
      eventType: "invite.created",
      payloadJson: {
        inviteId: invite.id,
        role: invite.role,
      },
    });

    return {
      id: invite.id,
      code,
      role: invite.role,
      maxUses: invite.maxUses,
      usedCount: invite.usedCount,
      expiresAt: invite.expiresAt.toISOString(),
      directJoinToken: input.directJoinDisplayName?.trim()
        ? this.createDirectJoinToken({
            code,
            displayName: input.directJoinDisplayName.trim(),
            deviceName: input.directJoinDeviceName?.trim() || `${input.directJoinDisplayName.trim()} device`,
            platform: "web",
          })
        : null,
    };
  }

  async validateInvite(code: string) {
    const invite = await this.invitesRepository.findActiveInvite(this.hashInviteCode(code));

    if (!invite) {
      throw new NotFoundException("Invite not found");
    }

    const isExpired = invite.expiresAt.getTime() <= Date.now();
    const isExhausted = invite.usedCount >= invite.maxUses;

    return {
      valid: !isExpired && !isExhausted,
      family: {
        id: invite.family.id,
        name: invite.family.name,
      },
      role: invite.role,
      expiresAt: invite.expiresAt.toISOString(),
      remainingUses: Math.max(invite.maxUses - invite.usedCount, 0),
    };
  }

  async joinInvite(
    code: string,
    input: JoinInviteDto,
    ipAddress?: string | null,
    sessionContext?: SessionContext | null,
  ) {
    const codeHash = this.hashInviteCode(code);

    if (sessionContext) {
      const result = await this.invitesRepository.acceptInviteForExistingUser({
        codeHash,
        userId: sessionContext.user.id,
        deviceId: sessionContext.device.id,
      });

      if (!result) {
        throw new BadRequestException("Invite expired or exhausted");
      }

      await this.auditService.log({
        familyId: result.invite.familyId,
        userId: result.user.id,
        actorUserId: result.user.id,
        eventType: "invite.joined",
        payloadJson: {
          inviteId: result.invite.id,
          memberId: result.member.id,
        },
      });

      return {
        ...result,
        family: result.invite.family,
        sessionToken: null,
      };
    }

    const invite = await this.invitesRepository.findActiveInvite(codeHash);

    if (!invite) {
      throw new NotFoundException("Invite not found");
    }

    const sessionToken = randomBytes(32).toString("hex");
    const sessionTokenHash = createHash("sha256").update(sessionToken).digest("hex");
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

    const result = await this.invitesRepository.acceptInvite({
      codeHash,
      displayName: input.displayName.trim(),
      deviceName: input.deviceName?.trim() || "Joined device",
      platform: input.platform?.trim() || "web",
      sessionTokenHash,
      expiresAt,
      ipAddress,
    });

    if (!result) {
      throw new BadRequestException("Invite expired or exhausted");
    }

    await this.auditService.log({
      familyId: result.invite.familyId,
      userId: result.user.id,
      actorUserId: result.user.id,
      eventType: "invite.joined",
      payloadJson: {
        inviteId: result.invite.id,
        memberId: result.member.id,
      },
    });

    return {
      ...result,
      family: result.invite.family,
      sessionToken,
    };
  }

  async joinInviteWithToken(token: string, ipAddress?: string | null, sessionContext?: SessionContext | null) {
    const payload = this.parseDirectJoinToken(token);

    return this.joinInvite(
      payload.code,
      {
        displayName: payload.displayName,
        deviceName: payload.deviceName,
        platform: payload.platform,
      },
      ipAddress,
      sessionContext,
    );
  }
}
