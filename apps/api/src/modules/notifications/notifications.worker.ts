import { Injectable, OnModuleInit } from "@nestjs/common";
import { NotificationsQueue } from "./notifications.queue";
import { NotificationsService } from "./notifications.service";

@Injectable()
export class NotificationsWorker implements OnModuleInit {
  constructor(
    private readonly notificationsQueue: NotificationsQueue,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit() {
    this.notificationsQueue.registerWorker((job) => this.notificationsService.processPushJob(job));
  }
}
