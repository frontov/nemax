import { Injectable } from "@nestjs/common";
import type { Server } from "socket.io";

@Injectable()
export class RealtimeService {
  private server: Server | null = null;

  attachServer(server: Server) {
    this.server = server;
  }

  getFamilyRoom(familyId: string) {
    return `family:${familyId}`;
  }

  emitToFamily(familyId: string, event: string, payload: unknown) {
    this.server?.to(this.getFamilyRoom(familyId)).emit(event, payload);
  }
}
