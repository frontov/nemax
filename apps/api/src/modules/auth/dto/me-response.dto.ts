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
  memberships: Array<{
    id: string;
    role: string;
    family: {
      id: string;
      name: string;
    };
  }>;
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
