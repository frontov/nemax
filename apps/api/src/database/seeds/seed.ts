import { createHash } from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_OWNER_ID = "11111111-1111-1111-1111-111111111111";
const DEMO_FAMILY_ID = "22222222-2222-2222-2222-222222222222";
const DEMO_DEVICE_ID = "33333333-3333-3333-3333-333333333333";
const DEMO_SESSION_ID = "44444444-4444-4444-4444-444444444444";
const DEMO_MESSAGE_ID = "55555555-5555-5555-5555-555555555555";

async function main() {
  if (process.env.DEMO_SEED === "false") {
    console.log("Skipping demo seed because DEMO_SEED=false");
    return;
  }

  const owner = await prisma.user.upsert({
    where: { id: DEMO_OWNER_ID },
    update: {
      displayName: "Roman",
      status: "active",
    },
    create: {
      id: DEMO_OWNER_ID,
      displayName: "Roman",
      status: "active",
    },
  });

  const family = await prisma.family.upsert({
    where: { id: DEMO_FAMILY_ID },
    update: {
      name: "Demo Family",
      ownerUserId: owner.id,
    },
    create: {
      id: DEMO_FAMILY_ID,
      name: "Demo Family",
      ownerUserId: owner.id,
    },
  });

  await prisma.familyMember.upsert({
    where: {
      familyId_userId: {
        familyId: family.id,
        userId: owner.id,
      },
    },
    update: {
      role: "owner",
      removedAt: null,
    },
    create: {
      familyId: family.id,
      userId: owner.id,
      role: "owner",
    },
  });

  const device = await prisma.device.upsert({
    where: { id: DEMO_DEVICE_ID },
    update: {
      userId: owner.id,
      familyId: family.id,
      deviceName: "Demo Browser",
      platform: "web",
      isTrusted: true,
      revokedAt: null,
      lastSeenAt: new Date(),
    },
    create: {
      id: DEMO_DEVICE_ID,
      userId: owner.id,
      familyId: family.id,
      deviceName: "Demo Browser",
      platform: "web",
      isTrusted: true,
      lastSeenAt: new Date(),
    },
  });

  await prisma.session.upsert({
    where: { id: DEMO_SESSION_ID },
    update: {
      userId: owner.id,
      deviceId: device.id,
      sessionTokenHash: createHash("sha256").update("demo-session-token").digest("hex"),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      revokedAt: null,
    },
    create: {
      id: DEMO_SESSION_ID,
      userId: owner.id,
      deviceId: device.id,
      sessionTokenHash: createHash("sha256").update("demo-session-token").digest("hex"),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  const message = await prisma.message.upsert({
    where: { id: DEMO_MESSAGE_ID },
    update: {
      familyId: family.id,
      senderUserId: owner.id,
      text: "Welcome to the demo family chat.",
      type: "text",
      deletedAt: null,
    },
    create: {
      id: DEMO_MESSAGE_ID,
      familyId: family.id,
      senderUserId: owner.id,
      text: "Welcome to the demo family chat.",
      type: "text",
    },
  });

  await prisma.familyReadState.upsert({
    where: {
      familyId_userId: {
        familyId: family.id,
        userId: owner.id,
      },
    },
    update: {
      lastReadMessageId: message.id,
      lastReadAt: new Date(),
    },
    create: {
      familyId: family.id,
      userId: owner.id,
      lastReadMessageId: message.id,
      lastReadAt: new Date(),
    },
  });

  await prisma.notificationSetting.upsert({
    where: {
      userId_familyId: {
        userId: owner.id,
        familyId: family.id,
      },
    },
    update: {
      pushEnabled: true,
      showPreview: true,
      muteUntil: null,
    },
    create: {
      userId: owner.id,
      familyId: family.id,
      pushEnabled: true,
      showPreview: true,
    },
  });

  console.log("Seeded demo family data idempotently.");
  console.log("Demo session token value: demo-session-token");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
