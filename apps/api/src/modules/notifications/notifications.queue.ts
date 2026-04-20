import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Job, Queue, Worker } from "bullmq";
import { PUSH_QUEUE_NAME } from "../../common/constants/notifications.constants";
import { RedisService } from "../../infrastructure/redis/redis.service";

@Injectable()
export class NotificationsQueue implements OnModuleDestroy {
  readonly connection;
  readonly queue: Queue;
  private worker: Worker | null = null;

  constructor(private readonly redisService: RedisService) {
    this.connection = this.redisService.duplicate();
    this.queue = new Queue(PUSH_QUEUE_NAME, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: 50,
        removeOnFail: 50,
      },
    });
  }

  registerWorker(processor: (job: Job) => Promise<unknown>) {
    if (this.worker) {
      return this.worker;
    }

    this.worker = new Worker(PUSH_QUEUE_NAME, processor, {
      connection: this.redisService.duplicate(),
    });

    return this.worker;
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue.close();
    await this.connection.quit();
  }
}
