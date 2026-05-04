import "dotenv/config";
import { Client } from "minio";
import { AppPrismaClient } from "../prisma/client";
import { detectImageMimeType, getImageDimensionsFromBuffer } from "../../modules/attachments/image-metadata";

const prisma = new AppPrismaClient();

const storageClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT ?? "minio",
  port: Number(process.env.MINIO_PORT_INTERNAL ?? 9000),
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY ?? "",
  secretKey: process.env.MINIO_SECRET_KEY ?? "",
});

const storageBucket = process.env.MINIO_BUCKET ?? "family-chat";
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
type AttachmentRecord = Awaited<ReturnType<typeof prisma.attachment.findMany>>[number];
type ReadStateRecord = Awaited<
  ReturnType<
    typeof prisma.familyReadState.findMany<{
      include: {
        lastReadMessage: {
          select: {
            id: true;
            familyId: true;
            deletedAt: true;
          };
        };
      };
    }>
  >
>[number];

function hasArg(flag: string) {
  return process.argv.includes(flag);
}

function readArgValue(prefix: string) {
  return process.argv.find((value) => value.startsWith(`${prefix}=`))?.slice(prefix.length + 1);
}

async function streamToBuffer(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function backfillAttachmentDimensions(batchSize: number) {
  let cursorId: string | null = null;
  let updatedCount = 0;

  while (true) {
    const attachments: AttachmentRecord[] = await prisma.attachment.findMany({
      where: {
        mimeType: {
          in: [...allowedMimeTypes],
        },
        OR: [{ width: null }, { height: null }],
      },
      orderBy: {
        id: "asc",
      },
      take: batchSize,
      ...(cursorId
        ? {
            skip: 1,
            cursor: {
              id: cursorId,
            },
          }
        : {}),
    });

    if (attachments.length === 0) {
      break;
    }

    for (const attachment of attachments as AttachmentRecord[]) {
      cursorId = attachment.id;

      try {
        const stream = await storageClient.getObject(storageBucket, attachment.storageKey);
        const buffer = await streamToBuffer(stream);
        const detectedMimeType = detectImageMimeType(buffer);

        if (detectedMimeType !== attachment.mimeType) {
          console.warn(
            `Skipping attachment ${attachment.id}: declared ${attachment.mimeType}, detected ${detectedMimeType ?? "unknown"}`,
          );
          continue;
        }

        const dimensions = getImageDimensionsFromBuffer(buffer, attachment.mimeType);

        if (!dimensions.width || !dimensions.height) {
          console.warn(`Skipping attachment ${attachment.id}: dimensions not detected`);
          continue;
        }

        await prisma.attachment.update({
          where: {
            id: attachment.id,
          },
          data: {
            width: dimensions.width,
            height: dimensions.height,
          },
        });

        updatedCount += 1;
      } catch (error) {
        console.warn(
          `Attachment backfill failed for ${attachment.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  console.log(`Attachment dimension backfill updated ${updatedCount} records.`);
}

async function resolveSafeLastReadMessageId(input: {
  familyId: string;
  userId: string;
  lastReadAt: Date | null;
}) {
  if (input.lastReadAt) {
    const messageAtTime = await prisma.message.findFirst({
      where: {
        familyId: input.familyId,
        deletedAt: null,
        createdAt: {
          lte: input.lastReadAt,
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
      },
    });

    if (messageAtTime) {
      return messageAtTime.id;
    }
  }

  const latestOwnMessage = await prisma.message.findFirst({
    where: {
      familyId: input.familyId,
      senderUserId: input.userId,
      deletedAt: null,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
    },
  });

  if (latestOwnMessage) {
    return latestOwnMessage.id;
  }

  return null;
}

async function backfillReadStates(batchSize: number) {
  let cursorId: string | null = null;
  let updatedCount = 0;
  let createdCount = 0;

  while (true) {
    const readStates: ReadStateRecord[] = await prisma.familyReadState.findMany({
      include: {
        lastReadMessage: {
          select: {
            id: true,
            familyId: true,
            deletedAt: true,
          },
        },
      },
      orderBy: {
        id: "asc",
      },
      take: batchSize,
      ...(cursorId
        ? {
            skip: 1,
            cursor: {
              id: cursorId,
            },
          }
        : {}),
    });

    if (readStates.length === 0) {
      break;
    }

    for (const state of readStates as ReadStateRecord[]) {
      cursorId = state.id;

      const hasInvalidReference =
        !state.lastReadMessageId ||
        !state.lastReadMessage ||
        state.lastReadMessage.deletedAt !== null ||
        state.lastReadMessage.familyId !== state.familyId;

      if (!hasInvalidReference) {
        continue;
      }

      const resolvedMessageId = await resolveSafeLastReadMessageId({
        familyId: state.familyId,
        userId: state.userId,
        lastReadAt: state.lastReadAt,
      });

      if (!resolvedMessageId) {
        continue;
      }

      await prisma.familyReadState.update({
        where: {
          id: state.id,
        },
        data: {
          lastReadMessageId: resolvedMessageId,
        },
      });

      updatedCount += 1;
    }
  }

  const activeMembers = await prisma.familyMember.findMany({
    where: {
      removedAt: null,
    },
    select: {
      familyId: true,
      userId: true,
    },
  });

  for (const member of activeMembers) {
    const existingState = await prisma.familyReadState.findUnique({
      where: {
        familyId_userId: {
          familyId: member.familyId,
          userId: member.userId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingState) {
      continue;
    }

    const fallbackMessageId = await resolveSafeLastReadMessageId({
      familyId: member.familyId,
      userId: member.userId,
      lastReadAt: null,
    });

    if (!fallbackMessageId) {
      continue;
    }

    await prisma.familyReadState.create({
      data: {
        familyId: member.familyId,
        userId: member.userId,
        lastReadMessageId: fallbackMessageId,
        lastReadAt: new Date(),
      },
    });

    createdCount += 1;
  }

  console.log(`Read-state backfill updated ${updatedCount} records and created ${createdCount} missing states.`);
}

async function main() {
  const batchSize = Number.parseInt(readArgValue("--batch-size") ?? "50", 10);
  const runAttachments = hasArg("--attachments") || !hasArg("--reads");
  const runReads = hasArg("--reads") || !hasArg("--attachments");

  if (runAttachments) {
    await backfillAttachmentDimensions(batchSize);
  }

  if (runReads) {
    await backfillReadStates(batchSize);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
