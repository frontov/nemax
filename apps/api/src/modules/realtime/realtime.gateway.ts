import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { corsOrigin } from "../../common/utils/cors-origin";
import { AuthService } from "../auth/auth.service";
import { RealtimeService } from "./realtime.service";

@WebSocketGateway({
  path: "/ws",
  cors: {
    origin: corsOrigin,
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly authService: AuthService,
    private readonly realtimeService: RealtimeService,
  ) {}

  afterInit(server: Server) {
    this.realtimeService.attachServer(server);
  }

  async handleConnection(client: Socket) {
    const sessionContext = await this.authService.resolveSessionToken(this.extractSessionToken(client), client.handshake.address);

    if (!sessionContext) {
      client.disconnect(true);
      return;
    }

    client.data.sessionContext = sessionContext;

    if (sessionContext.familyId) {
      client.join(this.realtimeService.getFamilyRoom(sessionContext.familyId));
    }

    client.emit("session.ready", {
      familyId: sessionContext.familyId,
      userId: sessionContext.user.id,
    });

    this.logger.debug(`Socket connected for family ${sessionContext.familyId}`);
  }

  @SubscribeMessage("family.subscribe")
  handleFamilySubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { familyId?: string },
  ) {
    if (!body.familyId) {
      return { ok: false };
    }

    const sessionContext = client.data.sessionContext as Awaited<ReturnType<AuthService["resolveSessionToken"]>>;

    if (!sessionContext) {
      return { ok: false };
    }

    const hasMembership = sessionContext.memberships.some(
      (membership) => membership.familyId === body.familyId && membership.removedAt === null,
    );

    if (!hasMembership) {
      return { ok: false };
    }

    client.join(this.realtimeService.getFamilyRoom(body.familyId));
    return { ok: true, familyId: body.familyId };
  }

  private extractSessionToken(client: Socket) {
    const authToken =
      typeof client.handshake.auth?.sessionToken === "string" ? client.handshake.auth.sessionToken : undefined;

    if (authToken) {
      return authToken;
    }

    const queryToken =
      typeof client.handshake.query.sessionToken === "string" ? client.handshake.query.sessionToken : undefined;

    if (queryToken) {
      return queryToken;
    }

    const cookieHeader = client.handshake.headers.cookie;

    if (cookieHeader) {
      const match = cookieHeader.match(/family_chat_session=([^;]+)/);
      if (match?.[1]) {
        return match[1];
      }
    }

    return undefined;
  }
}
