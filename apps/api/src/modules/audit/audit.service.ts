import { Injectable } from "@nestjs/common";
import { AuditRepository } from "./audit.repository";

@Injectable()
export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  log(input: {
    familyId?: string | null;
    userId?: string | null;
    actorUserId?: string | null;
    eventType: string;
    payloadJson: Record<string, unknown>;
  }) {
    return this.auditRepository.createLog(input);
  }
}
