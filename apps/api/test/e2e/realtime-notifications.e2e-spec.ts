import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppPrismaClient } from "../../src/database/prisma/client";
import { AppModule } from "../../src/app.module";

function toCookieHeader(cookies: string[] | string | undefined) {
  if (!cookies) {
    return "";
  }

  if (Array.isArray(cookies)) {
    return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
  }

  return cookies.split(";")[0];
}

describe("api infrastructure e2e", () => {
  let app: INestApplication;
  let prisma: AppPrismaClient;

  beforeAll(async () => {
    prisma = new AppPrismaClient();
    await prisma.$connect();
    await prisma.auditLog.deleteMany();
    await prisma.pushSubscription.deleteMany();
    await prisma.notificationSetting.deleteMany();
    await prisma.familyReadState.deleteMany();
    await prisma.attachment.deleteMany();
    await prisma.message.deleteMany();
    await prisma.session.deleteMany();
    await prisma.device.deleteMany();
    await prisma.invite.deleteMany();
    await prisma.familyMember.deleteMany();
    await prisma.family.deleteMany();
    await prisma.user.deleteMany();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api", { exclude: ["health"] });
    await app.listen(0);
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it("runs family-chat flow against real Postgres/Redis infrastructure", async () => {
    const owner = await request(app.getHttpServer()).post("/api/families").send({
      familyName: "E2E House",
      displayName: "Owner",
      deviceName: "Owner Device",
      platform: "web",
    });

    expect(owner.status).toBe(201);
    const ownerCookie = owner.headers["set-cookie"] ?? [];

    const invite = await request(app.getHttpServer())
      .post("/api/invites")
      .set("Cookie", toCookieHeader(ownerCookie))
      .send({
        role: "member",
        maxUses: 1,
        expiresInDays: 7,
      });

    expect(invite.status).toBe(201);

    const guest = await request(app.getHttpServer())
      .post(`/api/invites/${invite.body.code}/join`)
      .send({
        displayName: "Guest",
        deviceName: "Guest Device",
        platform: "web",
      });

    expect(guest.status).toBe(201);
    const guestCookie = guest.headers["set-cookie"] ?? [];

    const encryptedText = JSON.stringify({
      v: 1,
      alg: "AES-GCM",
      iv: "e2e-iv",
      data: "Realtime hello",
    });

    const sent = await request(app.getHttpServer())
      .post("/api/messages")
      .set("Cookie", toCookieHeader(guestCookie))
      .send({
        text: encryptedText,
      });

    expect(sent.status).toBe(201);

    const listed = await request(app.getHttpServer())
      .get("/api/messages")
      .set("Cookie", toCookieHeader(guestCookie));

    expect(listed.status).toBe(200);
    expect(listed.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: encryptedText,
        }),
      ]),
    );
  });
});
