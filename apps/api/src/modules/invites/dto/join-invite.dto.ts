import { IsOptional, IsString, MinLength } from "class-validator";

export class JoinInviteDto {
  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  deviceName?: string;

  @IsOptional()
  @IsString()
  platform?: string;
}
