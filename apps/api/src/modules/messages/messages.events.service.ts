import { Injectable } from "@nestjs/common";
import { RealtimeService } from "../realtime/realtime.service";

@Injectable()
export class MessagesEventsService {
  constructor(private readonly realtimeService: RealtimeService) {}

  emitMessageCreated(familyId: string, message: unknown) {
    this.realtimeService.emitToFamily(familyId, "message.created", message);
  }
}
