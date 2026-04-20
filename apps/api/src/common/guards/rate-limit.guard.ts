import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Type,
  mixin,
} from "@nestjs/common";
import { RedisService } from "../../infrastructure/redis/redis.service";

type RateLimitGuardOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

export function createRateLimitGuard(options: RateLimitGuardOptions): Type<CanActivate> {
  @Injectable()
  class RateLimitGuardMixin implements CanActivate {
    constructor(private readonly redisService: RedisService) {}

    async canActivate(context: ExecutionContext) {
      const request = context.switchToHttp().getRequest<{ ip?: string; path: string }>();
      const bucketKey = `${options.key}:${request.ip ?? "unknown"}:${request.path}`;
      const count = await this.redisService.incrementWithinWindow(bucketKey, options.windowMs);

      if (count > options.limit) {
        throw new HttpException("Rate limit exceeded", HttpStatus.TOO_MANY_REQUESTS);
      }
      return true;
    }
  }

  return mixin(RateLimitGuardMixin);
}
