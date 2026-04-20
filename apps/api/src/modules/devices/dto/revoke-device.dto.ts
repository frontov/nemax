import { IsUUID } from "class-validator";

export class RevokeDeviceDto {
  @IsUUID()
  deviceId!: string;
}
