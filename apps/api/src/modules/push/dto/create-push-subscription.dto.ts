import { IsString } from "class-validator";

export class CreatePushSubscriptionDto {
  @IsString()
  endpoint!: string;

  @IsString()
  p256dh!: string;

  @IsString()
  auth!: string;
}
