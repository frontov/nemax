import { Injectable } from "@nestjs/common";
import { serialize } from "cookie";
import { SESSION_COOKIE_NAME, SESSION_TTL_DAYS } from "../../common/constants/auth.constants";

@Injectable()
export class AuthCookieService {
  createSessionCookie(token: string) {
    return serialize(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      domain: this.resolveCookieDomain(),
      path: "/",
      maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
    });
  }

  clearSessionCookie() {
    return serialize(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      domain: this.resolveCookieDomain(),
      path: "/",
      expires: new Date(0),
    });
  }

  private resolveCookieDomain() {
    const domain = process.env.COOKIE_DOMAIN?.trim();

    if (!domain || domain === "localhost") {
      return undefined;
    }

    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(domain)) {
      return undefined;
    }

    return domain;
  }
}
