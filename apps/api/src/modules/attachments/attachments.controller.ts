import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { SessionGuard } from "../../common/guards/session.guard";
import type { SessionContext } from "../auth/auth.service";
import { AttachmentsService } from "./attachments.service";

function sanitizeDownloadName(name: string) {
  return name.replace(/["\r\n\\]/g, "_").slice(0, 180) || "attachment";
}

@Controller("attachments")
@UseGuards(SessionGuard)
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post("images")
  @UseInterceptors(FileInterceptor("image", { limits: { fileSize: 8 * 1024 * 1024 } }))
  uploadImage(
    @CurrentSession() sessionContext: SessionContext,
    @UploadedFile() file: Express.Multer.File,
    @Body("text") encryptedText?: string,
  ) {
    return this.attachmentsService.uploadImageMessage(sessionContext, file, encryptedText);
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
    stream.pipe(response);
  }
}
