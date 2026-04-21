import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";
import { Client } from "minio";
import type { Readable } from "stream";
import { AuthService, type SessionContext } from "../auth/auth.service";
import { MessagesService } from "../messages/messages.service";
import { AttachmentsRepository } from "./attachments.repository";

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_ALBUM_IMAGES = 10;
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

    if (!encryptedText) {
      throw new BadRequestException("Encrypted image caption is required");
    }

    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
        throw new BadRequestException("Only JPEG, PNG, WebP and GIF images are supported");
      }

      const detectedMimeType = detectImageMimeType(file.buffer);

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
        await this.client.putObject(this.bucket, storageKey, file.buffer, file.size, {
          "Content-Type": file.mimetype,
          "X-Original-Name": encodeURIComponent(file.originalname),
        });

        return {
          storageKey,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: BigInt(file.size),
        };
      }),
    );

    return this.messagesService.sendImageAlbumMessage(sessionContext, {
      text: encryptedText,
      replyToMessageId,
      attachments,
    });
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
