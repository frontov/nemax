import { IsString } from "class-validator";

export class DeletePushSubscriptionDto {
  @IsString()
  endpoint!: string;
}
