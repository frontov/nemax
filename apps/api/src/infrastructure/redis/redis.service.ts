import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import IORedis from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: IORedis;

  constructor(configService: ConfigService) {
    const redisUrl = configService.get<string>("redis.url") ?? "redis://redis:6379";
    this.client = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });
  }

  getClient() {
    return this.client;
  }

  duplicate() {
    return this.client.duplicate();
  }

  async incrementWithinWindow(key: string, windowMs: number) {
    const result = await this.client.multi().incr(key).pexpire(key, windowMs, "NX").exec();
    return Number(result?.[0]?.[1] ?? 0);
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
