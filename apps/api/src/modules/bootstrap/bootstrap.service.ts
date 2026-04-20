import { Injectable } from "@nestjs/common";

@Injectable()
export class BootstrapService {
  getHealth() {
    return {
      status: "ok" as const,
      service: "api" as const,
      timestamp: new Date().toISOString(),
    };
  }
}
