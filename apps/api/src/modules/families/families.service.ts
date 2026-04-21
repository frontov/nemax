import { Injectable } from "@nestjs/common";
import { BadRequestException } from "@nestjs/common";
import { randomBytes, createHash } from "crypto";
import { SESSION_TTL_DAYS } from "../../common/constants/auth.constants";
import { AuditService } from "../audit/audit.service";
import type { SessionContext } from "../auth/auth.service";
import { CreateFamilyDto } from "./dto/create-family.dto";
import { SetActiveFamilyDto } from "./dto/set-active-family.dto";
import { FamiliesRepository } from "./families.repository";

@Injectable()
export class FamiliesService {
  constructor(
    private readonly familiesRepository: FamiliesRepository,
    private readonly auditService: AuditService,
  ) {}

  async createFamily(input: CreateFamilyDto, ipAddress?: string | null) {
    if (!input.familyName.trim() || !input.displayName.trim()) {
      throw new BadRequestException("Family name and display name are required");
    }

    const sessionToken = randomBytes(32).toString("hex");
    const sessionTokenHash = createHash("sha256").update(sessionToken).digest("hex");
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

    const result = await this.familiesRepository.createFamilyWithOwner({
      familyName: input.familyName.trim(),
      displayName: input.displayName.trim(),
      deviceName: input.deviceName?.trim() || "Primary device",
      platform: input.platform?.trim() || "web",
      sessionTokenHash,
      expiresAt,
      ipAddress,
    });

    await this.auditService.log({
      familyId: result.family.id,
      userId: result.user.id,
      actorUserId: result.user.id,
      eventType: "family.created",
      payloadJson: {
        familyId: result.family.id,
        memberId: result.member.id,
      },
    });

    return {
      ...result,
      sessionToken,
    };
  }

  async createFamilyForExistingUser(sessionContext: SessionContext, input: CreateFamilyDto) {
    if (!input.familyName.trim()) {
      throw new BadRequestException("Family name is required");
    }

    const result = await this.familiesRepository.createFamilyForExistingUser({
      userId: sessionContext.user.id,
      deviceId: sessionContext.device.id,
      familyName: input.familyName.trim(),
    });

    await this.auditService.log({
      familyId: result.family.id,
      userId: result.user.id,
      actorUserId: result.user.id,
      eventType: "family.created",
      payloadJson: {
        familyId: result.family.id,
        memberId: result.member.id,
      },
    });

    return result;
  }

  async setActiveFamily(sessionContext: SessionContext, input: SetActiveFamilyDto) {
    const membership = await this.familiesRepository.setActiveFamily({
      userId: sessionContext.user.id,
      deviceId: sessionContext.device.id,
      familyId: input.familyId,
    });

    if (!membership) {
      throw new BadRequestException("Family is not available for this user");
    }

    await this.auditService.log({
      familyId: membership.familyId,
      userId: sessionContext.user.id,
      actorUserId: sessionContext.user.id,
      eventType: "family.active.changed",
      payloadJson: {
        familyId: membership.familyId,
      },
    });

    return {
      family: membership.family,
      member: membership,
    };
  }
}
