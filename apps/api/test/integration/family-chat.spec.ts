import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/database/prisma/prisma.service";
import { AuthRepository } from "../../src/modules/auth/auth.repository";
import { DevicesRepository } from "../../src/modules/devices/devices.repository";
import { FamiliesRepository } from "../../src/modules/families/families.repository";
import { InvitesRepository } from "../../src/modules/invites/invites.repository";
import { MembersRepository } from "../../src/modules/members/members.repository";
import { MessagesRepository } from "../../src/modules/messages/messages.repository";
import { ReadsRepository } from "../../src/modules/reads/reads.repository";
import { AuditService } from "../../src/modules/audit/audit.service";
import { NotificationsQueue } from "../../src/modules/notifications/notifications.queue";
import { NotificationsService } from "../../src/modules/notifications/notifications.service";
import { PushRepository } from "../../src/modules/push/push.repository";
import { RealtimeService } from "../../src/modules/realtime/realtime.service";
import { RedisService } from "../../src/infrastructure/redis/redis.service";

type UserRecord = {
  id: string;
  displayName: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt: Date | null;
};

type FamilyRecord = {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

type MemberRecord = {
  id: string;
  familyId: string;
  userId: string;
  role: string;
  createdAt: Date;
  removedAt: Date | null;
};

type DeviceRecord = {
  id: string;
  userId: string;
  familyId: string | null;
  deviceName: string;
  platform: string;
  browserName: string | null;
  userAgentHash: string | null;
  isTrusted: boolean;
  createdAt: Date;
  lastSeenAt: Date | null;
  revokedAt: Date | null;
};

type SessionRecord = {
  id: string;
  userId: string;
  deviceId: string;
  sessionTokenHash: string;
  createdAt: Date;
  lastRotatedAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
  ipCreated: string | null;
  ipLastSeen: string | null;
};

type InviteRecord = {
  id: string;
  familyId: string;
  createdByUserId: string;
  codeHash: string;
  role: string;
  maxUses: number;
  usedCount: number;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
};

type MessageRecord = {
  id: string;
  familyId: string;
  senderUserId: string;
  type: string;
  text: string | null;
  replyToMessageId: string | null;
  clientTempId: string | null;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
};

type FamilyReadStateRecord = {
  id: string;
  familyId: string;
  userId: string;
  lastReadMessageId: string | null;
  lastReadAt: Date | null;
};

type PushRecord = {
  id: string;
  deviceId: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

type NotificationSettingRecord = {
  id: string;
  userId: string;
  familyId: string;
  pushEnabled: boolean;
  showPreview: boolean;
  muteUntil: Date | null;
  quietHoursFrom: string | null;
  quietHoursTo: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type AuditRecord = {
  id: string;
  familyId: string | null;
  userId: string | null;
  actorUserId: string | null;
  eventType: string;
  payloadJson: Record<string, unknown>;
  createdAt: Date;
};

function createState() {
  return {
    users: [] as UserRecord[],
    families: [] as FamilyRecord[],
    members: [] as MemberRecord[],
    devices: [] as DeviceRecord[],
    sessions: [] as SessionRecord[],
    invites: [] as InviteRecord[],
    messages: [] as MessageRecord[],
    reads: [] as FamilyReadStateRecord[],
    pushes: [] as PushRecord[],
    notificationSettings: [] as NotificationSettingRecord[],
    auditLogs: [] as AuditRecord[],
  };
}

describe("family-chat MVP flows", () => {
  let app: INestApplication;
  const state = createState();

  const prismaStub = {};
  const realtimeStub = {
    attachServer: jest.fn(),
    getFamilyRoom: jest.fn((familyId: string) => `family:${familyId}`),
    emitToFamily: jest.fn(),
  };
  const notificationsQueueStub = {
    queue: {
      add: jest.fn(),
    },
    registerWorker: jest.fn(),
  };
  const redisServiceStub: Pick<RedisService, "incrementWithinWindow" | "duplicate"> = {
    async incrementWithinWindow() {
      return 1;
    },
    duplicate() {
      return {
        quit: jest.fn(),
      } as never;
    },
  };
  const auditServiceStub = {
    async log(input: {
      familyId?: string | null;
      userId?: string | null;
      actorUserId?: string | null;
      eventType: string;
      payloadJson: Record<string, unknown>;
    }) {
      state.auditLogs.push({
        id: randomUUID(),
        familyId: input.familyId ?? null,
        userId: input.userId ?? null,
        actorUserId: input.actorUserId ?? null,
        eventType: input.eventType,
        payloadJson: input.payloadJson,
        createdAt: new Date(),
      });
      return state.auditLogs[state.auditLogs.length - 1];
    },
  } as unknown as Pick<AuditService, "log">;
  const notificationsServiceStub: Pick<
    NotificationsService,
    "enqueueMessageNotification" | "getSettings" | "updateSettings" | "processPushJob"
  > = {
    async enqueueMessageNotification(input: {
      familyId: string;
      senderUserId: string;
      senderDisplayName: string;
      messageId: string;
      text: string;
    }) {
      await notificationsQueueStub.queue.add("push-delivery", input);
    },
    async getSettings(sessionContext: { user: { id: string }; familyId?: string | null }) {
      return (
        state.notificationSettings.find(
          (item) =>
            item.userId === sessionContext.user.id &&
            item.familyId === (sessionContext.familyId ?? ""),
        ) ?? null
      );
    },
    async updateSettings(
      sessionContext: { user: { id: string }; familyId?: string | null },
      input: {
        pushEnabled: boolean;
        showPreview: boolean;
        muteUntil?: string | null;
        quietHoursFrom?: string | null;
        quietHoursTo?: string | null;
      },
    ) {
      const existing = state.notificationSettings.find(
        (item) =>
          item.userId === sessionContext.user.id &&
          item.familyId === (sessionContext.familyId ?? ""),
      );

      if (existing) {
        existing.pushEnabled = input.pushEnabled;
        existing.showPreview = input.showPreview;
        existing.muteUntil = input.muteUntil ? new Date(input.muteUntil) : null;
        existing.quietHoursFrom = input.quietHoursFrom ?? null;
        existing.quietHoursTo = input.quietHoursTo ?? null;
        existing.updatedAt = new Date();
        return existing;
      }

      const created: NotificationSettingRecord = {
        id: randomUUID(),
        userId: sessionContext.user.id,
        familyId: sessionContext.familyId ?? "",
        pushEnabled: input.pushEnabled,
        showPreview: input.showPreview,
        muteUntil: input.muteUntil ? new Date(input.muteUntil) : null,
        quietHoursFrom: input.quietHoursFrom ?? null,
        quietHoursTo: input.quietHoursTo ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      state.notificationSettings.push(created);
      return created;
    },
    async processPushJob() {
      return undefined;
    },
  } as unknown as Pick<
    NotificationsService,
    "enqueueMessageNotification" | "getSettings" | "updateSettings" | "processPushJob"
  >;

  const authRepository = {
    async findSessionByTokenHash(sessionTokenHash: string) {
      const session = state.sessions.find(
        (item) =>
          item.sessionTokenHash === sessionTokenHash &&
          !item.revokedAt &&
          item.expiresAt.getTime() > Date.now(),
      );

      if (!session) {
        return null;
      }

      const user = state.users.find((item) => item.id === session.userId)!;
      const device = state.devices.find((item) => item.id === session.deviceId)!;
      const memberships = state.members
        .filter((item) => item.userId === user.id && !item.removedAt)
        .map((membership) => ({
          ...membership,
          family: state.families.find((family) => family.id === membership.familyId)!,
        }));

      return {
        ...session,
        user: {
          ...user,
          memberships,
        },
        device,
      };
    },
    async createSession(input: {
      userId: string;
      deviceId: string;
      sessionTokenHash: string;
      expiresAt: Date;
      ipCreated?: string | null;
      ipLastSeen?: string | null;
    }) {
      const session: SessionRecord = {
        id: randomUUID(),
        userId: input.userId,
        deviceId: input.deviceId,
        sessionTokenHash: input.sessionTokenHash,
        createdAt: new Date(),
        lastRotatedAt: null,
        expiresAt: input.expiresAt,
        revokedAt: null,
        ipCreated: input.ipCreated ?? null,
        ipLastSeen: input.ipLastSeen ?? null,
      };

      state.sessions.push(session);
      return session;
    },
    async touchSession(sessionId: string, ipLastSeen?: string | null) {
      const session = state.sessions.find((item) => item.id === sessionId)!;
      session.lastRotatedAt = new Date();
      session.ipLastSeen = ipLastSeen ?? null;
      return session;
    },
    async revokeSession(sessionId: string) {
      const session = state.sessions.find((item) => item.id === sessionId);

      if (!session || session.revokedAt) {
        return { count: 0 };
      }

      session.revokedAt = new Date();
      return { count: 1 };
    },
    async rotateSession(
      sessionId: string,
      sessionTokenHash: string,
      expiresAt: Date,
      ipLastSeen?: string | null,
    ) {
      const session = state.sessions.find((item) => item.id === sessionId)!;
      session.sessionTokenHash = sessionTokenHash;
      session.expiresAt = expiresAt;
      session.lastRotatedAt = new Date();
      session.ipLastSeen = ipLastSeen ?? null;
      return session;
    },
  } as unknown as Pick<
    AuthRepository,
    | "findSessionByTokenHash"
    | "createSession"
    | "touchSession"
    | "revokeSession"
    | "rotateSession"
  >;

  const familiesRepository: Pick<FamiliesRepository, "createFamilyWithOwner"> = {
    async createFamilyWithOwner(input: {
      familyName: string;
      displayName: string;
      deviceName: string;
      platform: string;
      sessionTokenHash: string;
      expiresAt: Date;
      ipAddress?: string | null;
    }) {
      const user: UserRecord = {
        id: randomUUID(),
        displayName: input.displayName,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSeenAt: null,
      };
      state.users.push(user);

      const family: FamilyRecord = {
        id: randomUUID(),
        name: input.familyName,
        ownerUserId: user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      state.families.push(family);

      const member: MemberRecord = {
        id: randomUUID(),
        familyId: family.id,
        userId: user.id,
        role: "owner",
        createdAt: new Date(),
        removedAt: null,
      };
      state.members.push(member);

      const device: DeviceRecord = {
        id: randomUUID(),
        userId: user.id,
        familyId: family.id,
        deviceName: input.deviceName,
        platform: input.platform,
        browserName: null,
        userAgentHash: null,
        isTrusted: true,
        createdAt: new Date(),
        lastSeenAt: new Date(),
        revokedAt: null,
      };
      state.devices.push(device);

      const session: SessionRecord = {
        id: randomUUID(),
        userId: user.id,
        deviceId: device.id,
        sessionTokenHash: input.sessionTokenHash,
        createdAt: new Date(),
        lastRotatedAt: null,
        expiresAt: input.expiresAt,
        revokedAt: null,
        ipCreated: input.ipAddress ?? null,
        ipLastSeen: input.ipAddress ?? null,
      };
      state.sessions.push(session);

      return { user, family, member, device, session };
    },
  };

  const invitesRepository = {
    async createInvite(input: {
      familyId: string;
      createdByUserId: string;
      codeHash: string;
      role: string;
      maxUses: number;
      expiresAt: Date;
    }) {
      const invite: InviteRecord = {
        id: randomUUID(),
        familyId: input.familyId,
        createdByUserId: input.createdByUserId,
        codeHash: input.codeHash,
        role: input.role,
        maxUses: input.maxUses,
        usedCount: 0,
        expiresAt: input.expiresAt,
        revokedAt: null,
        createdAt: new Date(),
      };

      state.invites.push(invite);
      return invite;
    },
    async findActiveInvite(codeHash: string) {
      const invite = [...state.invites]
        .reverse()
        .find(
          (item) =>
            item.codeHash === codeHash &&
            !item.revokedAt &&
            item.expiresAt.getTime() > Date.now(),
        );

      if (!invite) {
        return null;
      }

      return {
        ...invite,
        family: state.families.find((family) => family.id === invite.familyId)!,
      };
    },
    async acceptInvite(input: {
      codeHash: string;
      displayName: string;
      deviceName: string;
      platform: string;
      sessionTokenHash: string;
      expiresAt: Date;
      ipAddress?: string | null;
    }) {
      const invite = state.invites.find(
        (item) =>
          item.codeHash === input.codeHash &&
          !item.revokedAt &&
          item.expiresAt.getTime() > Date.now() &&
          item.usedCount < item.maxUses,
      );

      if (!invite) {
        return null;
      }

      invite.usedCount += 1;

      const user: UserRecord = {
        id: randomUUID(),
        displayName: input.displayName,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSeenAt: null,
      };
      state.users.push(user);

      const member: MemberRecord = {
        id: randomUUID(),
        familyId: invite.familyId,
        userId: user.id,
        role: invite.role,
        createdAt: new Date(),
        removedAt: null,
      };
      state.members.push(member);

      const device: DeviceRecord = {
        id: randomUUID(),
        userId: user.id,
        familyId: invite.familyId,
        deviceName: input.deviceName,
        platform: input.platform,
        browserName: null,
        userAgentHash: null,
        isTrusted: true,
        createdAt: new Date(),
        lastSeenAt: new Date(),
        revokedAt: null,
      };
      state.devices.push(device);

      const session: SessionRecord = {
        id: randomUUID(),
        userId: user.id,
        deviceId: device.id,
        sessionTokenHash: input.sessionTokenHash,
        createdAt: new Date(),
        lastRotatedAt: null,
        expiresAt: input.expiresAt,
        revokedAt: null,
        ipCreated: input.ipAddress ?? null,
        ipLastSeen: input.ipAddress ?? null,
      };
      state.sessions.push(session);

      return {
        user,
        member,
        device,
        session,
        invite: {
          ...invite,
          family: state.families.find((family) => family.id === invite.familyId)!,
        },
      };
    },
  } as unknown as Pick<InvitesRepository, "createInvite" | "findActiveInvite" | "acceptInvite">;

  const messagesRepository = {
    async listFamilyMessages(familyId: string) {
      return state.messages
        .filter((message) => message.familyId === familyId && !message.deletedAt)
        .map((message) => ({
          ...message,
          sender: state.users.find((user) => user.id === message.senderUserId)!,
          attachments: [],
          replyToMessage: message.replyToMessageId
            ? {
                ...state.messages.find((item) => item.id === message.replyToMessageId)!,
                sender: state.users.find(
                  (user) =>
                    user.id ===
                    state.messages.find((item) => item.id === message.replyToMessageId)!.senderUserId,
                )!,
              }
            : null,
        }));
    },
    async findActiveMessageForFamily(messageId: string, familyId: string) {
      const message = state.messages.find(
        (item) => item.id === messageId && item.familyId === familyId && !item.deletedAt,
      );

      if (!message) {
        return null;
      }

      return {
        ...message,
        sender: state.users.find((user) => user.id === message.senderUserId)!,
        attachments: [],
        replyToMessage: message.replyToMessageId
          ? {
              ...state.messages.find((item) => item.id === message.replyToMessageId)!,
              sender: state.users.find(
                (user) =>
                  user.id ===
                  state.messages.find((item) => item.id === message.replyToMessageId)!.senderUserId,
              )!,
            }
          : null,
      };
    },
    async createMessage(input: {
      familyId: string;
      senderUserId: string;
      text: string;
      replyToMessageId?: string;
      clientTempId?: string;
    }) {
      const message: MessageRecord = {
        id: randomUUID(),
        familyId: input.familyId,
        senderUserId: input.senderUserId,
        type: "text",
        text: input.text,
        replyToMessageId: input.replyToMessageId ?? null,
        clientTempId: input.clientTempId ?? null,
        createdAt: new Date(),
        editedAt: null,
        deletedAt: null,
      };
      state.messages.push(message);

      const existingRead = state.reads.find(
        (item) => item.familyId === input.familyId && item.userId === input.senderUserId,
      );

      if (existingRead) {
        existingRead.lastReadMessageId = message.id;
        existingRead.lastReadAt = new Date();
      } else {
        state.reads.push({
          id: randomUUID(),
          familyId: input.familyId,
          userId: input.senderUserId,
          lastReadMessageId: message.id,
          lastReadAt: new Date(),
        });
      }

      return {
        ...message,
        sender: state.users.find((user) => user.id === input.senderUserId)!,
        attachments: [],
        replyToMessage: message.replyToMessageId
          ? {
              ...state.messages.find((item) => item.id === message.replyToMessageId)!,
              sender: state.users.find(
                (user) =>
                  user.id ===
                  state.messages.find((item) => item.id === message.replyToMessageId)!.senderUserId,
              )!,
            }
          : null,
      };
    },
  } as unknown as Pick<
    MessagesRepository,
    "listFamilyMessages" | "findActiveMessageForFamily" | "createMessage"
  >;

  const membersRepository = {
    async listFamilyMembers(familyId: string) {
      return state.members
        .filter((member) => member.familyId === familyId && !member.removedAt)
        .map((member) => ({
          ...member,
          user: state.users.find((user) => user.id === member.userId)!,
        }));
    },
  } as unknown as Pick<MembersRepository, "listFamilyMembers">;

  const devicesRepository = {
    async listUserDevices(userId: string) {
      return state.devices.filter((device) => device.userId === userId);
    },
  } as unknown as Pick<DevicesRepository, "listUserDevices">;

  const readsRepository = {
    async markRead(input: { familyId: string; userId: string; messageId: string }) {
      const existing = state.reads.find(
        (item) => item.familyId === input.familyId && item.userId === input.userId,
      );

      if (existing) {
        existing.lastReadMessageId = input.messageId;
        existing.lastReadAt = new Date();
        return existing;
      }

      const created: FamilyReadStateRecord = {
        id: randomUUID(),
        familyId: input.familyId,
        userId: input.userId,
        lastReadMessageId: input.messageId,
        lastReadAt: new Date(),
      };

      state.reads.push(created);
      return created;
    },
  } as unknown as Pick<ReadsRepository, "markRead">;
  const pushRepository = {
    async upsertSubscription(input: {
      userId: string;
      deviceId: string;
      endpoint: string;
      p256dh: string;
      auth: string;
    }) {
      const existing = state.pushes.find((item) => item.endpoint === input.endpoint);

      if (existing) {
        existing.userId = input.userId;
        existing.deviceId = input.deviceId;
        existing.p256dh = input.p256dh;
        existing.auth = input.auth;
        existing.revokedAt = null;
        existing.lastUsedAt = new Date();
        return existing;
      }

      const created: PushRecord = {
        id: randomUUID(),
        userId: input.userId,
        deviceId: input.deviceId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        revokedAt: null,
      };
      state.pushes.push(created);
      return created;
    },
    async revokeSubscription(endpoint: string, userId: string) {
      let count = 0;
      state.pushes.forEach((item) => {
        if (item.endpoint === endpoint && item.userId === userId && !item.revokedAt) {
          item.revokedAt = new Date();
          count += 1;
        }
      });
      return { count };
    },
    async listActiveSubscriptionsForFamily(familyId: string, excludeUserId?: string) {
      const familyUserIds = state.members
        .filter((item) => item.familyId === familyId && !item.removedAt)
        .map((item) => item.userId);

      return state.pushes.filter(
        (item) =>
          !item.revokedAt &&
          familyUserIds.includes(item.userId) &&
          (!excludeUserId || item.userId !== excludeUserId),
      );
    },
  } as unknown as Pick<
    PushRepository,
    "upsertSubscription" | "revokeSubscription" | "listActiveSubscriptionsForFamily"
  >;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .overrideProvider(AuthRepository)
      .useValue(authRepository)
      .overrideProvider(FamiliesRepository)
      .useValue(familiesRepository)
      .overrideProvider(InvitesRepository)
      .useValue(invitesRepository)
      .overrideProvider(MessagesRepository)
      .useValue(messagesRepository)
      .overrideProvider(MembersRepository)
      .useValue(membersRepository)
      .overrideProvider(DevicesRepository)
      .useValue(devicesRepository)
      .overrideProvider(ReadsRepository)
      .useValue(readsRepository)
      .overrideProvider(PushRepository)
      .useValue(pushRepository)
      .overrideProvider(AuditService)
      .useValue(auditServiceStub)
      .overrideProvider(NotificationsService)
      .useValue(notificationsServiceStub)
      .overrideProvider(NotificationsQueue)
      .useValue(notificationsQueueStub)
      .overrideProvider(RealtimeService)
      .useValue(realtimeStub)
      .overrideProvider(RedisService)
      .useValue(redisServiceStub)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api", { exclude: ["health"] });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates a family and authenticates the owner with a cookie", async () => {
    const response = await request(app.getHttpServer()).post("/api/families").send({
      familyName: "The Testers",
      displayName: "Roman",
      deviceName: "MacBook",
      platform: "web",
    });

    expect(response.status).toBe(201);
    expect(response.body.family.name).toBe("The Testers");
    expect(response.headers["set-cookie"]).toBeDefined();

    const me = await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Cookie", response.headers["set-cookie"]);

    expect(me.status).toBe(200);
    expect(me.body.user.displayName).toBe("Roman");
    expect(me.body.family.name).toBe("The Testers");
  });

  it("creates and validates an invite", async () => {
    const familyOwner = await request(app.getHttpServer()).post("/api/families").send({
      familyName: "Invite House",
      displayName: "Owner",
      deviceName: "Owner Device",
      platform: "web",
    });

    const invite = await request(app.getHttpServer())
      .post("/api/invites")
      .set("Cookie", familyOwner.headers["set-cookie"])
      .send({
        role: "member",
        maxUses: 2,
        expiresInDays: 7,
      });

    expect(invite.status).toBe(201);
    expect(invite.body.code).toBeDefined();

    const validation = await request(app.getHttpServer()).get(`/api/invites/${invite.body.code}`);

    expect(validation.status).toBe(200);
    expect(validation.body.valid).toBe(true);
    expect(validation.body.family.name).toBe("Invite House");
  });

  it("joins a family by invite", async () => {
    const owner = await request(app.getHttpServer()).post("/api/families").send({
      familyName: "Join House",
      displayName: "Host",
      deviceName: "Host Device",
      platform: "web",
    });

    const invite = await request(app.getHttpServer())
      .post("/api/invites")
      .set("Cookie", owner.headers["set-cookie"])
      .send({
        role: "member",
        maxUses: 1,
        expiresInDays: 7,
      });

    const joined = await request(app.getHttpServer())
      .post(`/api/invites/${invite.body.code}/join`)
      .send({
        displayName: "Guest",
        deviceName: "Guest phone",
        platform: "web",
      });

    expect(joined.status).toBe(201);
    expect(joined.body.user.displayName).toBe("Guest");
    expect(joined.body.family.name).toBe("Join House");
    expect(joined.headers["set-cookie"]).toBeDefined();
  });

  it("sends and lists messages", async () => {
    const encryptedText = JSON.stringify({
      v: 1,
      alg: "AES-GCM",
      iv: "test-iv",
      data: "Hello from the integration test",
    });

    const owner = await request(app.getHttpServer()).post("/api/families").send({
      familyName: "Chat House",
      displayName: "Writer",
      deviceName: "Writer Device",
      platform: "web",
    });

    const sent = await request(app.getHttpServer())
      .post("/api/messages")
      .set("Cookie", owner.headers["set-cookie"])
      .send({
        text: encryptedText,
      });

    expect(sent.status).toBe(201);
    expect(sent.body.text).toBe(encryptedText);

    const listed = await request(app.getHttpServer())
      .get("/api/messages")
      .set("Cookie", owner.headers["set-cookie"]);

    expect(listed.status).toBe(200);
    expect(listed.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: encryptedText,
        }),
      ]),
    );
  });

  it("clears the session cookie on logout", async () => {
    const owner = await request(app.getHttpServer()).post("/api/families").send({
      familyName: "Logout House",
      displayName: "Closer",
      deviceName: "Closer Device",
      platform: "web",
    });

    const logout = await request(app.getHttpServer())
      .post("/api/auth/logout")
      .set("Cookie", owner.headers["set-cookie"]);

    expect(logout.status).toBe(201);
    expect(String(logout.headers["set-cookie"][0])).toContain("family_chat_session=");

    const meAfterLogout = await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Cookie", logout.headers["set-cookie"]);

    expect(meAfterLogout.status).toBe(401);
  });

  it("stores notification settings and push subscriptions", async () => {
    const owner = await request(app.getHttpServer()).post("/api/families").send({
      familyName: "Notify House",
      displayName: "Notifier",
      deviceName: "Notifier Device",
      platform: "web",
    });

    const updateSettings = await request(app.getHttpServer())
      .put("/api/notifications/settings")
      .set("Cookie", owner.headers["set-cookie"])
      .send({
        pushEnabled: true,
        showPreview: false,
        quietHoursFrom: "22:00",
        quietHoursTo: "07:00",
      });

    expect(updateSettings.status).toBe(200);
    expect(updateSettings.body.showPreview).toBe(false);

    const subscribe = await request(app.getHttpServer())
      .post("/api/push/subscriptions")
      .set("Cookie", owner.headers["set-cookie"])
      .send({
        endpoint: "https://example.com/push/123",
        p256dh: "key",
        auth: "secret",
      });

    expect(subscribe.status).toBe(201);
    expect(subscribe.body.endpoint).toBe("https://example.com/push/123");

    const removeSubscription = await request(app.getHttpServer())
      .delete("/api/push/subscriptions")
      .set("Cookie", owner.headers["set-cookie"])
      .send({
        endpoint: "https://example.com/push/123",
      });

    expect(removeSubscription.status).toBe(200);
    expect(removeSubscription.body.count).toBe(1);
  });
});
