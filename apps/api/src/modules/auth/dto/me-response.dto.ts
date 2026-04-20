export type MeResponseDto = {
  user: {
    id: string;
    displayName: string;
    status: string;
  };
  family: {
    id: string;
    name: string;
  } | null;
  member: {
    id: string;
    role: string;
  } | null;
  session: {
    id: string;
    deviceId: string;
    expiresAt: string;
  };
};
