import { IsUUID } from "class-validator";

export class SetActiveFamilyDto {
  @IsUUID()
  familyId!: string;
}
