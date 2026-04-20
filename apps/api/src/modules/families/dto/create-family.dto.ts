import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateFamilyDto {
  @IsString()
  @MinLength(2)
  familyName!: string;

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
