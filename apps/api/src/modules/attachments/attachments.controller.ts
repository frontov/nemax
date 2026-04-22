import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { randomBytes } from "crypto";
import type { Response } from "express";
import { tmpdir } from "os";
import { extname } from "path";
import { diskStorage } from "multer";
import { createRateLimitGuard } from "../../common/guards/rate-limit.guard";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { SessionGuard } from "../../common/guards/session.guard";
import type { SessionContext } from "../auth/auth.service";
import { AttachmentsService } from "./attachments.service";

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_ALBUM_IMAGES = 10;

function sanitizeDownloadName(name: string) {
  return name.replace(/["\r\n\\]/g, "_").slice(0, 180) || "attachment";
}

function createUploadStorage() {
  return diskStorage({
    destination: tmpdir(),
    filename: (_request, file, callback) => {
      const extension = extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, "").slice(0, 12) || ".bin";
      callback(null, `${Date.now()}-${randomBytes(8).toString("hex")}${extension}`);
    },
  });
}

@Controller("attachments")
@UseGuards(SessionGuard)
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post("images")
  @UseInterceptors(
    FileInterceptor("image", {
      storage: createUploadStorage(),
      limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
    }),
  )
  uploadImage(
    @CurrentSession() sessionContext: SessionContext,
    @UploadedFile() file: Express.Multer.File,
    @Body("text") encryptedText?: string,
  ) {
    return this.attachmentsService.uploadImageMessage(sessionContext, file, encryptedText);
  }

  @Post("images/album")
  @UseGuards(createRateLimitGuard({ key: "attachments-album", limit: 8, windowMs: 60_000 }))
  @UseInterceptors(
    FilesInterceptor("images", MAX_ALBUM_IMAGES, {
      storage: createUploadStorage(),
      limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
    }),
  )
  uploadImageAlbum(
    @CurrentSession() sessionContext: SessionContext,
    @UploadedFiles() files: Express.Multer.File[],
    @Body("text") encryptedText?: string,
    @Body("replyToMessageId") replyToMessageId?: string,
  ) {
    return this.attachmentsService.uploadImageAlbumMessage(sessionContext, files, encryptedText, replyToMessageId);
  }

  @Get(":id")
  @Header("Cache-Control", "private, max-age=3600")
  async getAttachment(
    @CurrentSession() sessionContext: SessionContext,
    @Param("id") attachmentId: string,
    @Res() response: Response,
  ) {
    const { stream, attachment } = await this.attachmentsService.getAttachmentStream(sessionContext, attachmentId);
    response.setHeader("Content-Type", attachment.mimeType);
    response.setHeader("Content-Length", attachment.sizeBytes.toString());
    response.setHeader("Content-Disposition", `inline; filename="${sanitizeDownloadName(attachment.originalName)}"`);
    stream.once("error", () => {
      if (!response.headersSent) {
        response.status(502);
      }
      if (!response.writableEnded) {
        response.end();
      }
    });
    response.once("close", () => {
      stream.destroy();
    });
    stream.pipe(response);
  }
}
