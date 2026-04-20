import { Injectable } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { AuthService } from "../auth/auth.service";
import type { SessionContext } from "../auth/auth.service";
import { DevicesRepository } from "./devices.repository";

@Injectable()
export class DevicesService {
  constructor(
    private readonly devicesRepository: DevicesRepository,
    private readonly auditService: AuditService,
    private readonly authService: AuthService,
  ) {}

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
}
