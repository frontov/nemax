import { IsBoolean, IsOptional, IsString, IsISO8601 } from "class-validator";

export class UpdateNotificationSettingsDto {
  @IsBoolean()
  pushEnabled!: boolean;

  @IsBoolean()
  showPreview!: boolean;

  @IsOptional()
  @IsISO8601()
  muteUntil?: string | null;

  @IsOptional()
  @IsString()
  quietHoursFrom?: string | null;

  @IsOptional()
  @IsString()
  quietHoursTo?: string | null;
}
