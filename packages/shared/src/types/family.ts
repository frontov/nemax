export type FamilySummary = {
  id: string;
  name: string;
  slug: string;
};

export type FamilyMemberSummary = {
  id: string;
  userId: string;
  familyId: string;
  role: string;
  nickname?: string | null;
};
