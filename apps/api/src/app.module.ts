import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import appConfig from "./config/app.config";
import dbConfig from "./config/db.config";
import pushConfig from "./config/push.config";
import redisConfig from "./config/redis.config";
import sessionConfig from "./config/session.config";
import storageConfig from "./config/storage.config";
import { validateEnv } from "./config/validation";
import { PrismaModule } from "./database/prisma/prisma.module";
import { RedisModule } from "./infrastructure/redis/redis.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AttachmentsModule } from "./modules/attachments/attachments.module";
import { BootstrapModule } from "./modules/bootstrap/bootstrap.module";
import { DevicesModule } from "./modules/devices/devices.module";
import { FamiliesModule } from "./modules/families/families.module";
import { InvitesModule } from "./modules/invites/invites.module";
import { MembersModule } from "./modules/members/members.module";
import { MessagesModule } from "./modules/messages/messages.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { PushModule } from "./modules/push/push.module";
import { ReadsModule } from "./modules/reads/reads.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"],
      validate: validateEnv,
      load: [appConfig, dbConfig, redisConfig, sessionConfig, storageConfig, pushConfig],
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    BootstrapModule,
    FamiliesModule,
    MembersModule,
    DevicesModule,
    InvitesModule,
    MessagesModule,
    AttachmentsModule,
    ReadsModule,
    RealtimeModule,
    NotificationsModule,
    PushModule,
    AuditModule,
  ],
})
export class AppModule {}
