import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AppPrismaClient } from "./client";

@Injectable()
export class PrismaService extends AppPrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
