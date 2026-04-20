export type WebSession = {
  sessionId: string;
  userId: string;
  familyId?: string;
};

export async function getSession(): Promise<WebSession | null> {
  return null;
}
