import type { Request } from "express";
import type { SessionContext } from "../../modules/auth/auth.service";

export type RequestWithSession = Request & {
  sessionContext?: SessionContext;
};
