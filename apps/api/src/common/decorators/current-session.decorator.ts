import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { RequestWithSession } from "../utils/request-with-session";

export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<RequestWithSession>();
    return request.sessionContext;
  },
);
