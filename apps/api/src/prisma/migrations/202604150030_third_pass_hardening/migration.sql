ALTER TABLE "NotificationSetting"
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_revokedAt_idx" ON "PushSubscription"("userId", "revokedAt");
CREATE INDEX "Invite_familyId_createdAt_idx" ON "Invite"("familyId", "createdAt");
CREATE INDEX "FamilyMember_familyId_removedAt_idx" ON "FamilyMember"("familyId", "removedAt");
CREATE INDEX "Device_userId_revokedAt_idx" ON "Device"("userId", "revokedAt");
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");
CREATE INDEX "NotificationSetting_userId_familyId_idx" ON "NotificationSetting"("userId", "familyId");
