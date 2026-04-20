import { Injectable } from "@nestjs/common";
import { randomBytes, createHash } from "crypto";
import { SESSION_TTL_DAYS } from "../../common/constants/auth.constants";
import { AuthRepository } from "./auth.repository";

@Injectable()
export class AuthSessionService {
  constructor(private readonly authRepository: AuthRepository) {}

  hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  getExpiryDate() {
    return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  }

  generateTokenPair() {
    const token = randomBytes(32).toString("hex");

    return {
      token,
      sessionTokenHash: this.hashToken(token),
      expiresAt: this.getExpiryDate(),
    };
  }

  async createSession(input: {
    userId: string;
    deviceId: string;
    ipAddress?: string | null;
  }) {
    const { token, sessionTokenHash, expiresAt } = this.generateTokenPair();

    const session = await this.authRepository.createSession({
      userId: input.userId,
      deviceId: input.deviceId,
      sessionTokenHash,
      expiresAt,
      ipCreated: input.ipAddress ?? null,
      ipLastSeen: input.ipAddress ?? null,
    });

    return {
      token,
      session,
    };
  }

  async rotateSession(sessionId: string, ipAddress?: string | null) {
    const { token, sessionTokenHash, expiresAt } = this.generateTokenPair();

    const session = await this.authRepository.rotateSession(sessionId, sessionTokenHash, expiresAt, ipAddress);

    return {
      token,
      session,
    };
  }

  revokeSession(sessionId: string) {
    return this.authRepository.revokeSession(sessionId);
  }
}
