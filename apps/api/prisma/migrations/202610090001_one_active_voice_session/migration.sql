CREATE UNIQUE INDEX "VoiceSession_one_active_per_user_idx"
ON "VoiceSession" ("userId")
WHERE "status" = 'active';
