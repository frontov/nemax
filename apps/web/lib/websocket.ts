import { io, type Socket } from "socket.io-client";

export const websocketClient = {
  url: process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:8080",
  connect(): Socket | null {
    if (typeof window === "undefined") {
      return null;
    }

    return io(this.url, {
      path: "/ws",
      withCredentials: true,
      transports: ["websocket"],
    });
  },
};
