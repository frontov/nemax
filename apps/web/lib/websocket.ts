import { io, type Socket } from "socket.io-client";

export const websocketClient = {
  connect(): Socket | null {
    if (typeof window === "undefined") {
      return null;
    }

    const url = process.env.NEXT_PUBLIC_WS_URL ?? window.location.origin;

    return io(url, {
      path: "/ws",
      withCredentials: true,
      transports: ["websocket"],
    });
  },
};
