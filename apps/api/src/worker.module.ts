import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import appConfig from "./config/app.config";
import dbConfig from "./config/db.config";
import pushConfig from "./config/push.config";
import redisConfig from "./config/redis.config";
import sessionConfig from "./config/session.config";
import storageConfig from "./config/storage.config";
import { PrismaModule } from "./database/prisma/prisma.module";
import { RedisModule } from "./infrastructure/redis/redis.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { NotificationsWorker } from "./modules/notifications/notifications.worker";
import { PushModule } from "./modules/push/push.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, dbConfig, redisConfig, sessionConfig, storageConfig, pushConfig],
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    PushModule,
    AuditModule,
    NotificationsModule,
  ],
  providers: [NotificationsWorker],
})
export class WorkerModule {}
