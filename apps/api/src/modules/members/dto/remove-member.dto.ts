import { IsOptional, IsUUID } from "class-validator";

export class RemoveMemberDto {
  @IsUUID()
  memberId!: string;

  @IsOptional()
  @IsUUID()
  familyId?: string;
}
