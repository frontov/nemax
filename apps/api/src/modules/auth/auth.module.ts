import { Global, Module } from "@nestjs/common";
import { SessionGuard } from "../../common/guards/session.guard";
import { AuthRepository } from "./auth.repository";
import { AuthController } from "./auth.controller";
import { AuthCookieService } from "./auth.cookie.service";
import { AuthService } from "./auth.service";
import { AuthSessionService } from "./auth.session.service";

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthRepository, AuthService, AuthSessionService, AuthCookieService, SessionGuard],
  exports: [AuthService, AuthSessionService, AuthCookieService, SessionGuard],
})
export class AuthModule {}
