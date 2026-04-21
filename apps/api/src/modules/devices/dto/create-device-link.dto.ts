import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateDeviceLinkDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  platform?: string;
}
