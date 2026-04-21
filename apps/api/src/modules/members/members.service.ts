import { Injectable } from "@nestjs/common";
import { BadRequestException } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import type { SessionContext } from "../auth/auth.service";
import { AuthService } from "../auth/auth.service";
import { MembersRepository } from "./members.repository";

@Injectable()
export class MembersService {
  constructor(
    private readonly membersRepository: MembersRepository,
    private readonly auditService: AuditService,
    private readonly authService: AuthService,
  ) {}

  async listMembers(sessionContext: SessionContext) {
    const member = this.authService.assertFamilyAccess(sessionContext);
    return this.membersRepository.listFamilyMembers(member.familyId);
  }

  async removeMember(sessionContext: SessionContext, memberId: string) {
    const actorMember = this.authService.assertFamilyAccess(sessionContext);

    if (actorMember.role !== "owner") {
      throw new BadRequestException("Only family owner can remove members");
    }

    if (memberId === actorMember.id) {
      throw new BadRequestException("Owner cannot remove themselves");
    }

    const result = await this.membersRepository.removeMember(actorMember.familyId, memberId);

    if (!result) {
      throw new BadRequestException("Member not found or already removed");
    }

    await this.auditService.log({
      familyId: actorMember.familyId,
      actorUserId: sessionContext.user.id,
      userId: result.userId,
      eventType: "member.removed",
      payloadJson: {
        memberId,
      },
    });

    return result;
  }
}
