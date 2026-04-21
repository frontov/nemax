import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateMessageDto {
  @IsString()
  @MaxLength(12000)
  text!: string;

  @IsOptional()
  @IsString()
  replyToMessageId?: string;

  @IsOptional()
  @IsString()
  clientTempId?: string;
}
