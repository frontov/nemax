import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../../modules/auth/auth.service";
import type { RequestWithSession } from "../utils/request-with-session";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithSession>();
    const sessionContext = await this.authService.resolveSessionFromRequest(request);

    if (!sessionContext) {
      throw new UnauthorizedException("Authentication required");
    }

    request.sessionContext = sessionContext;
    return true;
  }
}
