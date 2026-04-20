export type AuthUser = {
  id: string;
  displayName: string;
  phoneNumber?: string | null;
};

export type SessionSummary = {
  id: string;
  userId: string;
  familyId?: string | null;
  expiresAt: string;
};
