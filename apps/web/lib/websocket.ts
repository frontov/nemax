import { io, type Socket } from "socket.io-client";

let socketInstance: Socket | null = null;

export const websocketClient = {
  connect(): Socket | null {
    if (typeof window === "undefined") {
      return null;
    }

    if (socketInstance) {
      if (!socketInstance.connected) {
        socketInstance.connect();
      }

      return socketInstance;
    }

    const url = process.env.NEXT_PUBLIC_WS_URL ?? window.location.origin;

    socketInstance = io(url, {
      path: "/ws",
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    return socketInstance;
  },
};
