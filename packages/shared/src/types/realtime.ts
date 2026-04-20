export type RealtimeEvent =
  | { type: "message.created"; messageId: string; familyId: string }
  | { type: "member.joined"; memberId: string; familyId: string }
  | { type: "typing.started"; userId: string; familyId: string };
