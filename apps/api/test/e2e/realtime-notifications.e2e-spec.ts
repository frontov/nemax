import { io as ioClient, type Socket } from "socket.io-client";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../../src/app.module";
import { WorkerModule } from "../../src/worker.module";
import { PushService } from "../../src/modules/push/push.service";

const runE2E = process.env.RUN_E2E === "true" && Boolean(process.env.DATABASE_URL) && Boolean(process.env.REDIS_URL);

const describeE2E = runE2E ? describe : describe.skip;

describeE2E("realtime and notifications e2e", () => {
  let app: INestApplication;
  let workerApp: INestApplication | null = null;
  let prisma: PrismaClient;
  const sendNotification = jest.fn().mockResolvedValue(undefined);

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    await prisma.auditLog.deleteMany();
    await prisma.pushSubscription.deleteMany();
    await prisma.notificationSetting.deleteMany();
    await prisma.familyReadState.deleteMany();
    await prisma.message.deleteMany();
    await prisma.session.deleteMany();
    await prisma.device.deleteMany();
    await prisma.invite.deleteMany();
    await prisma.familyMember.deleteMany();
    await prisma.family.deleteMany();
    await prisma.user.deleteMany();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PushService)
      .useValue({
        listFamilySubscriptions: jest.fn().mockImplementation(async () => {
          return prisma.pushSubscription.findMany({
            where: {
              revokedAt: null,
            },
          });
        }),
        sendNotification,
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api", { exclude: ["health"] });
    await app.listen(0);

    const workerModuleRef = await Test.createTestingModule({
      imports: [WorkerModule],
    })
      .overrideProvider(PushService)
      .useValue({
        listFamilySubscriptions: jest.fn().mockImplementation(async () => {
          return prisma.pushSubscription.findMany({
            where: {
              revokedAt: null,
            },
          });
        }),
        sendNotification,
      })
      .compile();

    workerApp = workerModuleRef.createNestApplication();
    await workerApp.init();
  });

  afterAll(async () => {
    await workerApp?.close();
    await app.close();
    await prisma.$disconnect();
  });

  it("authenticates websocket by session cookie, isolates rooms, and processes push queue", async () => {
    const owner = await request(app.getHttpServer()).post("/api/families").send({
      familyName: "Realtime House",
      displayName: "Owner",
      deviceName: "Owner Browser",
      platform: "web",
    });

    const ownerCookie = owner.headers["set-cookie"] ?? [];
    const invite = await request(app.getHttpServer())
      .post("/api/invites")
      .set("Cookie", ownerCookie)
      .send({
        role: "member",
        maxUses: 1,
        expiresInDays: 7,
      });

    const guest = await request(app.getHttpServer())
      .post(`/api/invites/${invite.body.code}/join`)
      .send({
        displayName: "Guest",
        deviceName: "Guest Phone",
        platform: "web",
      });

    const guestCookie = guest.headers["set-cookie"] ?? [];

    await request(app.getHttpServer())
      .put("/api/notifications/settings")
      .set("Cookie", guestCookie)
      .send({
        pushEnabled: true,
        showPreview: true,
      });

    await request(app.getHttpServer())
      .post("/api/push/subscriptions")
      .set("Cookie", guestCookie)
      .send({
        endpoint: "https://example.com/push/guest",
        p256dh: "guest-key",
        auth: "guest-auth",
      });

    const address = app.getHttpServer().address();
    const port = typeof address === "string" ? 0 : address.port;

    const ownerSocket = await new Promise<Socket>((resolve, reject) => {
      const socket = ioClient(`http://127.0.0.1:${port}`, {
        path: "/ws",
        transports: ["websocket"],
        extraHeaders: {
          Cookie: Array.isArray(ownerCookie) ? ownerCookie.join("; ") : ownerCookie,
        },
      });

      socket.on("session.ready", () => resolve(socket));
      socket.on("connect_error", reject);
    });

    const unauthorized = await new Promise<{ ok: boolean }>((resolve) => {
      ownerSocket.emit("family.subscribe", { familyId: "00000000-0000-0000-0000-000000000000" }, resolve);
    });

    expect(unauthorized.ok).toBe(false);

    const messageCreated = new Promise<{ id: string; text: string }>((resolve) => {
      ownerSocket.on("message.created", resolve);
    });

    const readEvent = new Promise<{ messageId: string }>((resolve) => {
      ownerSocket.on("messages.read", resolve);
    });

    const send = await request(app.getHttpServer())
      .post("/api/messages")
      .set("Cookie", guestCookie)
      .send({
        text: "Realtime hello",
      });

    expect(send.status).toBe(201);
    expect((await messageCreated).text).toBe("Realtime hello");

    const markRead = await request(app.getHttpServer())
      .post("/api/reads")
      .set("Cookie", ownerCookie)
      .send({
        messageId: send.body.id,
      });

    expect(markRead.status).toBe(201);
    expect((await readEvent).messageId).toBe(send.body.id);

    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(sendNotification).toHaveBeenCalled();

    ownerSocket.close();
  });
});
