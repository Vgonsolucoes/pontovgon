-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MASTER', 'ADMIN', 'RH', 'GESTOR', 'FUNCIONARIO');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ATIVO', 'FERIAS', 'AFASTADO', 'DESLIGADO');

-- CreateEnum
CREATE TYPE "TimeEntryOrigin" AS ENUM ('IDFACE', 'MANUAL', 'ADMINISTRATIVO', 'WEB', 'APP');

-- CreateEnum
CREATE TYPE "TimeEntryStatus" AS ENUM ('VALIDO', 'AJUSTADO', 'INCONSISTENTE', 'EXCLUIDO_LOGICAMENTE');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDENTE', 'APROVADO', 'REPROVADO');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('FERIAS', 'ATESTADO', 'AFASTAMENTO', 'FOLGA', 'COMPENSACAO');

-- CreateEnum
CREATE TYPE "CommandStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'MANUTENCAO', 'DESATIVADO');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('ONLINE', 'OFFLINE', 'SYNCING', 'AUTH_ERROR', 'API_OFFLINE');

-- CreateEnum
CREATE TYPE "WorkScheduleModel" AS ENUM ('CINCOXDOIS', 'SEISXUM', 'DOZEXTRINTASEIS', 'PERSONALIZADA');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'SOFT_DELETE', 'RESTORE', 'APPROVE', 'REJECT', 'ADJUST', 'MANUAL_ENTRY', 'SYNC');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'FUNCIONARIO',
    "employeeId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMPTZ,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "departmentId" TEXT,
    "cbo" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_schedules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" "WorkScheduleModel" NOT NULL DEFAULT 'CINCOXDOIS',
    "toleranceMinutes" INTEGER NOT NULL DEFAULT 5,
    "dailyLoadMinutes" INTEGER NOT NULL DEFAULT 480,
    "weeklyLoadMinutes" INTEGER NOT NULL DEFAULT 2200,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "observations" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "work_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_schedule_days" (
    "id" TEXT NOT NULL,
    "workScheduleId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "isDayOff" BOOLEAN NOT NULL DEFAULT false,
    "entryTime" TEXT,
    "breakStartTime" TEXT,
    "breakEndTime" TEXT,
    "departureTime" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "work_schedule_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "photoUrl" TEXT,
    "cpf" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "positionId" TEXT,
    "departmentId" TEXT,
    "workScheduleId" TEXT,
    "managerId" TEXT,
    "admissionDate" DATE,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ATIVO',
    "externalIdDevice" TEXT,
    "observations" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL DEFAULT 'Control iD',
    "model" TEXT NOT NULL DEFAULT 'iDFace',
    "serialNumber" TEXT NOT NULL,
    "firmwareVersion" TEXT,
    "firmwareSecBox" TEXT,
    "macAddress" TEXT,
    "deviceUniqueId" TEXT,
    "location" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'ONLINE',
    "agentId" TEXT,
    "lastCommunication" TIMESTAMPTZ,
    "lastEntryAt" TIMESTAMPTZ,
    "config" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_users" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "employeeId" TEXT,
    "externalId" TEXT NOT NULL,
    "biometricsRegistered" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "device_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT,
    "computerName" TEXT,
    "localIp" TEXT,
    "osVersion" TEXT,
    "lastHeartbeatAt" TIMESTAMPTZ,
    "lastSyncAt" TIMESTAMPTZ,
    "status" "AgentStatus" NOT NULL DEFAULT 'OFFLINE',
    "syncIntervalSec" INTEGER NOT NULL DEFAULT 30,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_heartbeats" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "sentAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" TEXT,
    "computerName" TEXT,
    "localIp" TEXT,
    "osVersion" TEXT,
    "deviceStatus" "DeviceStatus",
    "deviceLastComm" TIMESTAMPTZ,
    "deviceLastSync" TIMESTAMPTZ,
    "pendingEvents" INTEGER NOT NULL DEFAULT 0,
    "agentStatus" "AgentStatus",
    "raw" JSONB,

    CONSTRAINT "agent_heartbeats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_sync_logs" (
    "id" TEXT NOT NULL,
    "agentId" TEXT,
    "deviceId" TEXT,
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ,
    "eventsCount" INTEGER NOT NULL DEFAULT 0,
    "newEvents" INTEGER NOT NULL DEFAULT 0,
    "duplicate" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commands" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "commandType" TEXT NOT NULL,
    "payload" JSONB,
    "status" "CommandStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "error" TEXT,
    "pickedAt" TIMESTAMPTZ,
    "finishedAt" TIMESTAMPTZ,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entries" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT,
    "deviceId" TEXT,
    "externalEventId" TEXT,
    "date" DATE NOT NULL,
    "time" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ,
    "kind" TEXT,
    "origin" "TimeEntryOrigin" NOT NULL DEFAULT 'IDFACE',
    "originalEventRef" TEXT,
    "importedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "TimeEntryStatus" NOT NULL DEFAULT 'VALIDO',
    "note" TEXT,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entry_requests" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "evaluatedById" TEXT,
    "date" DATE NOT NULL,
    "time" TEXT,
    "type" TEXT NOT NULL,
    "justification" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDENTE',
    "evaluatorNote" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluatedAt" TIMESTAMPTZ,

    CONSTRAINT "time_entry_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entry_adjustments" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "requestId" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "date" DATE NOT NULL,
    "target" TEXT NOT NULL,
    "previousTime" TEXT,
    "newTime" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMPTZ,

    CONSTRAINT "time_entry_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_days" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "expectedMinutes" INTEGER NOT NULL DEFAULT 0,
    "workedMinutes" INTEGER NOT NULL DEFAULT 0,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "earlyLeaveMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "debitMinutes" INTEGER NOT NULL DEFAULT 0,
    "dailyBalanceMinutes" INTEGER NOT NULL DEFAULT 0,
    "absenceJustified" BOOLEAN NOT NULL DEFAULT false,
    "absenceReason" TEXT,
    "hasIncompleteRecords" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "recalculatedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "work_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hour_bank" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "deltaMinutes" INTEGER NOT NULL,
    "balanceMinutes" INTEGER NOT NULL,
    "origin" TEXT NOT NULL,
    "workDayId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hour_bank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vacations" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "daysCount" INTEGER NOT NULL,
    "bonusAmount" DECIMAL(12,2),
    "allowance" DECIMAL(12,2),
    "status" "RequestStatus" NOT NULL DEFAULT 'APROVADO',
    "observations" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "vacations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaves" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "daysCount" INTEGER NOT NULL,
    "hoursCount" INTEGER NOT NULL DEFAULT 0,
    "justificationDoc" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'APROVADO',
    "approvedById" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'NACIONAL',
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "actorEmail" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_time_entriesTotime_entry_adjustments" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeId_key" ON "users"("employeeId");

-- CreateIndex
CREATE INDEX "departments_active_idx" ON "departments"("active");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE INDEX "positions_active_idx" ON "positions"("active");

-- CreateIndex
CREATE UNIQUE INDEX "positions_name_departmentId_key" ON "positions"("name", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "work_schedules_name_key" ON "work_schedules"("name");

-- CreateIndex
CREATE INDEX "work_schedule_days_workScheduleId_idx" ON "work_schedule_days"("workScheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "work_schedule_days_workScheduleId_weekday_key" ON "work_schedule_days"("workScheduleId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "employees_cpf_key" ON "employees"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "employees_registration_key" ON "employees"("registration");

-- CreateIndex
CREATE INDEX "employees_departmentId_idx" ON "employees"("departmentId");

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "employees"("status");

-- CreateIndex
CREATE UNIQUE INDEX "devices_serialNumber_key" ON "devices"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "devices_deviceUniqueId_key" ON "devices"("deviceUniqueId");

-- CreateIndex
CREATE INDEX "device_users_employeeId_idx" ON "device_users"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "device_users_deviceId_externalId_key" ON "device_users"("deviceId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "agents_token_key" ON "agents"("token");

-- CreateIndex
CREATE INDEX "agent_heartbeats_agentId_sentAt_idx" ON "agent_heartbeats"("agentId", "sentAt");

-- CreateIndex
CREATE INDEX "device_sync_logs_startedAt_idx" ON "device_sync_logs"("startedAt");

-- CreateIndex
CREATE INDEX "commands_agentId_status_idx" ON "commands"("agentId", "status");

-- CreateIndex
CREATE INDEX "commands_status_idx" ON "commands"("status");

-- CreateIndex
CREATE INDEX "time_entries_employeeId_date_idx" ON "time_entries"("employeeId", "date");

-- CreateIndex
CREATE INDEX "time_entries_deviceId_importedAt_idx" ON "time_entries"("deviceId", "importedAt");

-- CreateIndex
CREATE UNIQUE INDEX "time_entries_deviceId_externalEventId_key" ON "time_entries"("deviceId", "externalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "time_entries_origin_employeeId_date_time_key" ON "time_entries"("origin", "employeeId", "date", "time");

-- CreateIndex
CREATE INDEX "time_entry_requests_employeeId_status_idx" ON "time_entry_requests"("employeeId", "status");

-- CreateIndex
CREATE INDEX "time_entry_requests_status_createdAt_idx" ON "time_entry_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "time_entry_adjustments_employeeId_date_idx" ON "time_entry_adjustments"("employeeId", "date");

-- CreateIndex
CREATE INDEX "work_days_date_idx" ON "work_days"("date");

-- CreateIndex
CREATE UNIQUE INDEX "work_days_employeeId_date_key" ON "work_days"("employeeId", "date");

-- CreateIndex
CREATE INDEX "hour_bank_employeeId_date_idx" ON "hour_bank"("employeeId", "date");

-- CreateIndex
CREATE INDEX "vacations_employeeId_startDate_idx" ON "vacations"("employeeId", "startDate");

-- CreateIndex
CREATE INDEX "leaves_employeeId_startDate_idx" ON "leaves"("employeeId", "startDate");

-- CreateIndex
CREATE INDEX "leaves_type_startDate_idx" ON "leaves"("type", "startDate");

-- CreateIndex
CREATE INDEX "holidays_date_idx" ON "holidays"("date");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_date_scope_key" ON "holidays"("date", "scope");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "_time_entriesTotime_entry_adjustments_AB_unique" ON "_time_entriesTotime_entry_adjustments"("A", "B");

-- CreateIndex
CREATE INDEX "_time_entriesTotime_entry_adjustments_B_index" ON "_time_entriesTotime_entry_adjustments"("B");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedule_days" ADD CONSTRAINT "work_schedule_days_workScheduleId_fkey" FOREIGN KEY ("workScheduleId") REFERENCES "work_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_workScheduleId_fkey" FOREIGN KEY ("workScheduleId") REFERENCES "work_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_users" ADD CONSTRAINT "device_users_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_users" ADD CONSTRAINT "device_users_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_heartbeats" ADD CONSTRAINT "agent_heartbeats_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sync_logs" ADD CONSTRAINT "device_sync_logs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sync_logs" ADD CONSTRAINT "device_sync_logs_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commands" ADD CONSTRAINT "commands_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry_requests" ADD CONSTRAINT "time_entry_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry_requests" ADD CONSTRAINT "time_entry_requests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry_requests" ADD CONSTRAINT "time_entry_requests_evaluatedById_fkey" FOREIGN KEY ("evaluatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry_adjustments" ADD CONSTRAINT "time_entry_adjustments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry_adjustments" ADD CONSTRAINT "time_entry_adjustments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "time_entry_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry_adjustments" ADD CONSTRAINT "time_entry_adjustments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry_adjustments" ADD CONSTRAINT "time_entry_adjustments_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_days" ADD CONSTRAINT "work_days_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hour_bank" ADD CONSTRAINT "hour_bank_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hour_bank" ADD CONSTRAINT "hour_bank_workDayId_fkey" FOREIGN KEY ("workDayId") REFERENCES "work_days"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacations" ADD CONSTRAINT "vacations_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_time_entriesTotime_entry_adjustments" ADD CONSTRAINT "_time_entriesTotime_entry_adjustments_A_fkey" FOREIGN KEY ("A") REFERENCES "time_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_time_entriesTotime_entry_adjustments" ADD CONSTRAINT "_time_entriesTotime_entry_adjustments_B_fkey" FOREIGN KEY ("B") REFERENCES "time_entry_adjustments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

