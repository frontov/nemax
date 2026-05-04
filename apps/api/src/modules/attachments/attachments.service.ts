import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";
import { createReadStream, promises as fs } from "fs";
import { Client } from "minio";
import type { Readable } from "stream";
import { AuthService, type SessionContext } from "../auth/auth.service";
import { MessagesService } from "../messages/messages.service";
import { AttachmentsRepository } from "./attachments.repository";

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_ALBUM_IMAGES = 10;
const MAX_ALBUM_TOTAL_SIZE_BYTES = 24 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function detectImageMimeType(buffer: Buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  if (
    buffer.length >= 6 &&
    (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a")
  ) {
    return "image/gif";
  }

  return undefined;
}

async function detectImageMimeTypeFromFile(filePath: string) {
  const file = await fs.open(filePath, "r");

  try {
    const signatureBuffer = Buffer.alloc(16);
    const { bytesRead } = await file.read(signatureBuffer, 0, signatureBuffer.length, 0);
    return detectImageMimeType(signatureBuffer.subarray(0, bytesRead));
  } finally {
    await file.close();
  }
}

async function getImageDimensionsFromFile(filePath: string, mimeType: string) {
  const fileBuffer = await fs.readFile(filePath);

  if (mimeType === "image/png" && fileBuffer.length >= 24) {
    return {
      width: fileBuffer.readUInt32BE(16),
      height: fileBuffer.readUInt32BE(20),
    };
  }

  if (mimeType === "image/gif" && fileBuffer.length >= 10) {
    return {
      width: fileBuffer.readUInt16LE(6),
      height: fileBuffer.readUInt16LE(8),
    };
  }

  if (mimeType === "image/webp" && fileBuffer.length >= 30) {
    const chunkType = fileBuffer.subarray(12, 16).toString("ascii");

    if (chunkType === "VP8X") {
      return {
        width: 1 + fileBuffer.readUIntLE(24, 3),
        height: 1 + fileBuffer.readUIntLE(27, 3),
      };
    }

    if (chunkType === "VP8 " && fileBuffer.length >= 30) {
      return {
        width: fileBuffer.readUInt16LE(26),
        height: fileBuffer.readUInt16LE(28),
      };
    }

    if (chunkType === "VP8L" && fileBuffer.length >= 25) {
      const bits = fileBuffer.readUInt32LE(21);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
  }

  if (mimeType === "image/jpeg") {
    let offset = 2;

    while (offset + 9 < fileBuffer.length) {
      if (fileBuffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }

      const marker = fileBuffer[offset + 1];
      const isStartOfFrame =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;

      if (isStartOfFrame) {
        return {
          height: fileBuffer.readUInt16BE(offset + 5),
          width: fileBuffer.readUInt16BE(offset + 7),
        };
      }

      if (offset + 4 > fileBuffer.length) {
        break;
      }

      const segmentLength = fileBuffer.readUInt16BE(offset + 2);

      if (segmentLength < 2) {
        break;
      }

      offset += 2 + segmentLength;
    }
  }

  return {
    width: null,
    height: null,
  };
}

@Injectable()
export class AttachmentsService {
  private readonly client: Client;
  private readonly bucket: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    private readonly messagesService: MessagesService,
    private readonly attachmentsRepository: AttachmentsRepository,
  ) {
    this.bucket = this.configService.get<string>("storage.bucket") ?? "family-chat";
    this.client = new Client({
      endPoint: this.configService.get<string>("storage.endpoint") ?? "minio",
      port: this.configService.get<number>("storage.port") ?? 9000,
      useSSL: this.configService.get<boolean>("storage.useSSL") ?? false,
      accessKey: this.configService.get<string>("storage.accessKey") ?? "",
      secretKey: this.configService.get<string>("storage.secretKey") ?? "",
    });
  }

  private async ensureBucket() {
    const exists = await this.client.bucketExists(this.bucket).catch(() => false);

    if (!exists) {
      await this.client.makeBucket(this.bucket);
    }
  }

  private createStorageKey(sessionContext: SessionContext, originalName: string) {
    const extension = originalName.includes(".") ? originalName.split(".").pop() : "image";
    const safeExtension = extension?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "image";

    return [
      "families",
      sessionContext.familyId ?? "unknown",
      "images",
      `${new Date().toISOString().slice(0, 10)}-${randomBytes(12).toString("hex")}.${safeExtension}`,
    ].join("/");
  }

  async uploadImageMessage(
    sessionContext: SessionContext,
    file: Express.Multer.File | undefined,
    encryptedText: string | undefined,
  ) {
    return this.uploadImageAlbumMessage(sessionContext, file ? [file] : [], encryptedText);
  }

  async uploadImageAlbumMessage(
    sessionContext: SessionContext,
    files: Express.Multer.File[] | undefined,
    encryptedText: string | undefined,
    replyToMessageId?: string,
  ) {
    this.authService.assertFamilyAccess(sessionContext);

    if (!files?.length) {
      throw new BadRequestException("Image file is required");
    }

    if (files.length > MAX_ALBUM_IMAGES) {
      throw new BadRequestException(`Album can contain up to ${MAX_ALBUM_IMAGES} images`);
    }

    const totalAlbumSize = files.reduce((sum, file) => sum + file.size, 0);

    if (totalAlbumSize > MAX_ALBUM_TOTAL_SIZE_BYTES) {
      throw new BadRequestException("Album is too large");
    }

    if (!encryptedText) {
      throw new BadRequestException("Encrypted image caption is required");
    }

    const uploadedKeys: string[] = [];
    const temporaryPaths = files.map((file) => file.path).filter((filePath): filePath is string => Boolean(filePath));

    try {
      if (temporaryPaths.length !== files.length) {
        throw new BadRequestException("Uploaded files were not persisted on disk");
      }

      for (const file of files) {
        if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
          throw new BadRequestException("Only JPEG, PNG, WebP and GIF images are supported");
        }

        const detectedMimeType = await detectImageMimeTypeFromFile(file.path);

        if (detectedMimeType !== file.mimetype) {
          throw new BadRequestException("Image content does not match its declared type");
        }

        if (file.size > MAX_IMAGE_SIZE_BYTES) {
          throw new BadRequestException("Image is too large");
        }
      }

      await this.ensureBucket();

      const attachments = await Promise.all(
        files.map(async (file) => {
          const storageKey = this.createStorageKey(sessionContext, file.originalname);
          const dimensions = await getImageDimensionsFromFile(file.path, file.mimetype);
          await this.client.putObject(this.bucket, storageKey, createReadStream(file.path), file.size, {
            "Content-Type": file.mimetype,
            "X-Original-Name": encodeURIComponent(file.originalname),
          });
          uploadedKeys.push(storageKey);

          return {
            storageKey,
            originalName: file.originalname,
            mimeType: file.mimetype,
            sizeBytes: BigInt(file.size),
            width: dimensions.width,
            height: dimensions.height,
          };
        }),
      );

      return this.messagesService.sendImageAlbumMessage(sessionContext, {
        text: encryptedText,
        replyToMessageId,
        attachments,
      });
    } catch (error) {
      await Promise.all(
        uploadedKeys.map((storageKey) => this.client.removeObject(this.bucket, storageKey).catch(() => undefined)),
      );
      throw error;
    } finally {
      await Promise.all(temporaryPaths.map((filePath) => fs.unlink(filePath).catch(() => undefined)));
    }
  }

  async getAttachmentStream(sessionContext: SessionContext, attachmentId: string) {
    const member = this.authService.assertFamilyAccess(sessionContext);
    const attachment = await this.attachmentsRepository.findAttachmentForFamily(attachmentId, member.familyId);

    if (!attachment) {
      throw new NotFoundException("Attachment not found");
    }

    const stream = await this.client.getObject(this.bucket, attachment.storageKey);

    return {
      stream: stream as Readable,
      attachment,
    };
  }
}
