import { Injectable } from "@nestjs/common";
import { UnauthorizedException } from "@nestjs/common";
import { parse } from "cookie";
import { SESSION_COOKIE_NAME } from "../../common/constants/auth.constants";
import type { RequestWithSession } from "../../common/utils/request-with-session";
import { AuthRepository } from "./auth.repository";
import type { MeResponseDto } from "./dto/me-response.dto";
import { AuthSessionService } from "./auth.session.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly authSessionService: AuthSessionService,
  ) {}

  async resolveSessionToken(token: string | undefined, ipAddress?: string | null) {
    if (!token) {
      return null;
    }

    const sessionTokenHash = this.authSessionService.hashToken(token);
    const session = await this.authRepository.findSessionByTokenHash(sessionTokenHash);

    if (!session) {
      return null;
    }

    await this.authRepository.touchSession(session.id, ipAddress ?? null);

    const activeMemberships = session.user.memberships.filter((membership) => membership.removedAt === null);
    const currentFamilyId =
      activeMemberships.find((membership) => membership.familyId === session.device.familyId)?.familyId ??
      activeMemberships[0]?.familyId ??
      null;
    const currentMember =
      activeMemberships.find((membership) => membership.familyId === currentFamilyId) ??
      activeMemberships[0] ??
      null;

    return {
      session,
      user: session.user,
      device: session.device,
      family: currentMember?.family ?? null,
      member: currentMember,
      familyId: currentFamilyId,
      memberships: activeMemberships,
    };
  }

  async resolveSessionFromRequest(request: RequestWithSession) {
    const cookies = parse(request.headers.cookie ?? "");
    return this.resolveSessionToken(cookies[SESSION_COOKIE_NAME], request.ip);
  }

  buildMePayload(sessionContext: SessionContext): MeResponseDto {
    return {
      user: {
        id: sessionContext.user.id,
        displayName: sessionContext.user.displayName,
        status: sessionContext.user.status,
      },
      family: sessionContext.family
        ? {
            id: sessionContext.family.id,
            name: sessionContext.family.name,
          }
        : null,
      member: sessionContext.member
        ? {
            id: sessionContext.member.id,
            role: sessionContext.member.role,
          }
        : null,
      session: {
        id: sessionContext.session.id,
        deviceId: sessionContext.device.id,
        expiresAt: sessionContext.session.expiresAt.toISOString(),
      },
    };
  }

  assertFamilyAccess(sessionContext: SessionContext, familyId?: string | null) {
    const targetFamilyId = familyId ?? sessionContext.familyId;

    if (!targetFamilyId) {
      throw new UnauthorizedException("No active family access");
    }

    const member = sessionContext.memberships.find((membership) => membership.familyId === targetFamilyId);

    if (!member) {
      throw new UnauthorizedException("Active membership required");
    }

    return member;
  }
}

export type SessionContext = NonNullable<Awaited<ReturnType<AuthService["resolveSessionToken"]>>>;
