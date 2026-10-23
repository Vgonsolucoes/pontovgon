-- Keep different original device events; only their calculation is deduplicated.
DROP INDEX "time_entries_origin_employeeId_date_time_key";
CREATE INDEX "time_entries_origin_employeeId_date_time_idx" ON "time_entries"("origin", "employeeId", "date", "time");
ALTER TABLE "time_entries" ADD COLUMN "reviewFlags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], ADD COLUMN "duplicateOfId" TEXT;
ALTER TABLE "time_entry_requests" ADD COLUMN "targetEntryId" TEXT;
ALTER TABLE "hour_bank" ADD COLUMN "calculationKey" TEXT, ADD COLUMN "reversalOfId" TEXT, ADD COLUMN "needsRecalculation" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "hour_bank_calculationKey_key" ON "hour_bank"("calculationKey");
CREATE UNIQUE INDEX "hour_bank_reversalOfId_key" ON "hour_bank"("reversalOfId");
CREATE TABLE "attendance_settings" (
  "id" TEXT NOT NULL DEFAULT 'default', "windowEnabled" BOOLEAN NOT NULL DEFAULT true,
  "minutesBefore" INTEGER NOT NULL DEFAULT 30, "minutesAfter" INTEGER NOT NULL DEFAULT 30,
  "duplicateMinutes" INTEGER NOT NULL DEFAULT 2, "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "attendance_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_settings_minutes_check" CHECK ("minutesBefore" BETWEEN 0 AND 240 AND "minutesAfter" BETWEEN 0 AND 240 AND "duplicateMinutes" BETWEEN 0 AND 30)
);
