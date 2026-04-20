import { Injectable } from "@nestjs/common";
import { BadRequestException } from "@nestjs/common";
import { RealtimeService } from "../realtime/realtime.service";
import { AuthService, type SessionContext } from "../auth/auth.service";
import { MarkReadDto } from "./dto/mark-read.dto";
import { ReadsRepository } from "./reads.repository";

@Injectable()
export class ReadsService {
  constructor(
    private readonly readsRepository: ReadsRepository,
    private readonly realtimeService: RealtimeService,
    private readonly authService: AuthService,
  ) {}

  async markRead(sessionContext: SessionContext, input: MarkReadDto) {
    const member = this.authService.assertFamilyAccess(sessionContext);

    const result = await this.readsRepository.markRead({
      familyId: member.familyId,
      userId: sessionContext.user.id,
      messageId: input.messageId,
    });

    this.realtimeService.emitToFamily(member.familyId, "messages.read", {
      familyId: member.familyId,
      userId: sessionContext.user.id,
      messageId: input.messageId,
      lastReadAt: result.lastReadAt,
    });

    return result;
  }
}
