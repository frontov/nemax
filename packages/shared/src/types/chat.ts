export type ChatMessage = {
  id: string;
  familyId: string;
  senderId?: string | null;
  body: string;
  createdAt: string;
};
