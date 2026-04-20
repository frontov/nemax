import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateInviteDto {
  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxUses?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  expiresInDays?: number;

  @IsOptional()
  @IsString()
  directJoinDisplayName?: string;

  @IsOptional()
  @IsString()
  directJoinDeviceName?: string;
}
